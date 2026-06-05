import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app } from 'electron';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import { parseStringPromise } from 'xml2js';
import * as cheerio from 'cheerio';
import log from 'electron-log';

export interface FileChunk {
    text: string;
    metadata: {
        file_path: string;
        file_name: string;
        chunk_index: number;
        total_chunks: number;
    };
}

const AUDIO_EXTENSIONS = new Set([
    '.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.opus', '.webm', '.mp4',
]);

async function parseAudioFile(filePath: string): Promise<string> {
    try {
        const { isWhisperAvailable, whisperTranscribe } = await import('./whisper');
        const availability = await isWhisperAvailable();
        if (!availability.available) {
            log.warn(`[FileProcessor] Audio file detected but Whisper not available: ${filePath}`);
            return `[音频文件: ${path.basename(filePath)}] 需要安装 Whisper 模型才能转写音频。请运行: ollama pull whisper`;
        }
        const result = await whisperTranscribe(filePath);
        if (result.text) {
            log.info(`[FileProcessor] Audio transcribed: ${path.basename(filePath)}, ${result.text.length} chars`);
            return `[音频转写] ${result.text}`;
        }
        return `[音频文件: ${path.basename(filePath)}] 转写结果为空`;
    } catch (err: any) {
        log.error(`[FileProcessor] Audio transcription failed:`, err);
        return `[音频文件: ${path.basename(filePath)}] 转写失败: ${err?.message || '未知错误'}`;
    }
}

async function parsePdfWithPdfjs(dataBuffer: Buffer): Promise<string> {
    const pdfjsLib = await import('pdfjs-dist');
    const cMapDir = path.join(app.getAppPath(), 'node_modules', 'pdfjs-dist', 'cmaps');
    const cMapUrl = `${pathToFileURL(cMapDir).href}/`;

    class NodeCMapReaderFactory {
        async fetch({ name }: { name: string }) {
            const filePath = path.join(cMapDir, `${name}.bcmap`);
            const data = fs.readFileSync(filePath);
            return { cMapData: new Uint8Array(data), compressionType: 1 };
        }
    }

    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(dataBuffer),
        cMapUrl,
        cMapPacked: true,
        CMapReaderFactory: NodeCMapReaderFactory,
        useSystemFonts: true,
    });
    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    const textParts: string[] = [];

    for (let i = 1; i <= numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
        textParts.push(pageText);
    }

    return textParts.join('\n');
}

async function parsePdf(filePath: string): Promise<string> {
    const stats = fs.statSync(filePath);
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    if (stats.size > MAX_FILE_SIZE) {
        log.warn(`[FileProcessor] PDF file too large (${(stats.size / 1024 / 1024).toFixed(1)}MB), skipping:`, filePath);
        return '';
    }

    const dataBuffer = fs.readFileSync(filePath);

    try {
        const text = await parsePdfWithPdfjs(dataBuffer);
        if (text && text.trim().length > 0) {
            log.info(`[FileProcessor] Extracted ${text.length} chars from PDF via pdfjs-dist`);
            return text;
        }
        log.warn('[FileProcessor] pdfjs-dist returned empty text');
        return '';
    } catch (pdfjsErr) {
        log.error('[FileProcessor] pdfjs-dist failed:', pdfjsErr);
        return '';
    }
}

const MAX_TEXT_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_LENGTH = 5 * 1024 * 1024; // 5M characters

function readTextFileSafe(filePath: string): string {
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_TEXT_FILE_SIZE) {
        log.warn(`[FileProcessor] Text file too large (${(stats.size / 1024 / 1024).toFixed(1)}MB), reading first 10MB only:`, filePath);
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(MAX_TEXT_FILE_SIZE);
        fs.readSync(fd, buffer, 0, MAX_TEXT_FILE_SIZE, 0);
        fs.closeSync(fd);
        const text = buffer.toString('utf-8');
        return text.length > MAX_TEXT_LENGTH ? text.substring(0, MAX_TEXT_LENGTH) : text;
    }
    const text = fs.readFileSync(filePath, 'utf-8');
    return text.length > MAX_TEXT_LENGTH ? text.substring(0, MAX_TEXT_LENGTH) : text;
}

async function parseEpub(filePath: string): Promise<string> {
    try {
        const JSZip = await import('jszip');
        const data = fs.readFileSync(filePath);
        const zip = await JSZip.default.loadAsync(data);

        const containerFile = zip.file('META-INF/container.xml');
        if (!containerFile) return '';

        const containerXml = await containerFile.async('text');
        const containerParsed = await parseStringPromise(containerXml);
        const rootFilePath = containerParsed?.container?.rootfiles?.[0]?.rootfile?.[0]?.$?.['full-path'];
        if (!rootFilePath) return '';

        const opfFile = zip.file(rootFilePath);
        if (!opfFile) return '';

        const opfXml = await opfFile.async('text');
        const opfParsed = await parseStringPromise(opfXml);

        const spineItems = opfParsed?.package?.spine?.[0]?.itemref || [];
        const manifestItems = opfParsed?.package?.manifest?.[0]?.item || [];

        const idToHref = new Map<string, string>();
        for (const item of manifestItems) {
            const id = item.$?.id;
            const href = item.$?.href;
            if (id && href) idToHref.set(id, href);
        }

        const basePath = rootFilePath.substring(0, rootFilePath.lastIndexOf('/') + 1);
        const textParts: string[] = [];

        for (const spineItem of spineItems) {
            const idref = spineItem.$?.idref;
            const href = idToHref.get(idref);
            if (!href) continue;

            const fullPath = basePath + href;
            const htmlFile = zip.file(fullPath);
            if (!htmlFile) continue;

            const html = await htmlFile.async('text');
            const $ = cheerio.load(html);
            const text = $('body').text().trim();
            if (text) textParts.push(text);
        }

        return textParts.join('\n\n');
    } catch (err) {
        log.error(`[FileProcessor] EPUB parse failed:`, err);
        return '';
    }
}

async function parseHtml(filePath: string): Promise<string> {
    try {
        const content = readTextFileSafe(filePath);
        const $ = cheerio.load(content);
        $('script, style, nav, header, footer, noscript').remove();
        const title = $('title').text().trim();
        const body = $('body').text().trim();
        const cleaned = body
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n\n')
            .trim();
        return title ? `${title}\n\n${cleaned}` : cleaned;
    } catch (err) {
        log.error(`[FileProcessor] HTML parse failed:`, err);
        return '';
    }
}

async function parseOpml(filePath: string): Promise<string> {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = await parseStringPromise(content);
        const outlines = parsed?.opml?.body?.[0]?.outline || [];
        const lines: string[] = [];

        function traverse(items: any[], depth: number = 0) {
            for (const item of items) {
                const text = item.$?.text || item.$?.title || '';
                const note = item.$?._note || '';
                if (text) {
                    const indent = '  '.repeat(depth);
                    lines.push(`${indent}- ${text}`);
                    if (note) lines.push(`${indent}  ${note}`);
                }
                if (item.outline) {
                    traverse(item.outline, depth + 1);
                }
            }
        }

        traverse(outlines);
        return lines.join('\n');
    } catch (err) {
        log.error(`[FileProcessor] OPML parse failed:`, err);
        return '';
    }
}

export async function parseFile(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();

    try {
        if (ext === '.pdf') {
            return await parsePdf(filePath);
        } else if (ext === '.docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        } else if (ext === '.doc') {
            const extractor = new WordExtractor();
            const doc = await extractor.extract(filePath);
            return doc.getBody();
        } else if (ext === '.txt' || ext === '.md') {
            return readTextFileSafe(filePath);
        } else if (ext === '.csv') {
            return parseCsvFile(filePath);
        } else if (ext === '.xlsx' || ext === '.xls') {
            return parseExcelFallback(filePath);
        } else if (ext === '.epub') {
            return await parseEpub(filePath);
        } else if (ext === '.html' || ext === '.htm') {
            return await parseHtml(filePath);
        } else if (ext === '.opml') {
            return await parseOpml(filePath);
        } else if (ext === '.xsl' || ext === '.xslt') {
            return readTextFileSafe(filePath);
        } else if (AUDIO_EXTENSIONS.has(ext)) {
            return await parseAudioFile(filePath);
        }
        return '';
    } catch (error) {
        log.error(`Error parsing file ${filePath}:`, error);
        return '';
    }
}

/**
 * 中文标点和断句符号集合
 * 用于语义分块时识别句子边界
 */
const SENTENCE_ENDINGS = /[。！？；\n.!?;]/;
const PARAGRAPH_BREAKS = /\n\s*\n/;
const SECTION_MARKERS = /^(#{1,6}\s|第[一二三四五六七八九十百千万]+[章节篇部分]|[一二三四五六七八九十百千万]+[、.）)]\s*|[（(]\s*[一二三四五六七八九十百千万]+\s*[）)]|[\d]+[、.）)]\s*)/;

/**
 * 语义感知分块策略
 * 优先按段落/标题切分，其次按句子边界切分，兼容中文标点
 * 保留元数据（页码/章节标题占位）
 */
export function chunkText(text: string, chunkSize: number = 800, overlap: number = 100): string[] {
    const chunks: string[] = [];
    if (!text) return chunks;

    // 清理文本中的异常空白，但保留段落分隔
    const cleanText = text
        .replace(/\r\n/g, '\n')           // 统一换行符
        .replace(/\t/g, ' ')              // 制表符转空格
        .replace(/[^\S\n]+/g, ' ')        // 连续空白合并（保留换行）
        .replace(/\n{3,}/g, '\n\n')       // 多余空行合并为两个
        .trim();

    if (cleanText.length <= chunkSize) {
        return cleanText.length > 20 ? [cleanText] : [];
    }

    // 第一步：按段落分隔符预切分
    const paragraphs = splitByParagraphs(cleanText);

    // 第二步：将段落合并为 chunk，不超过 chunkSize
    let currentChunk = '';
    for (const para of paragraphs) {
        // 如果单个段落超过 chunkSize，需要按句子再切分
        if (para.length > chunkSize) {
            // 先把当前积累的 chunk 存入
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            // 对超长段落按句子切分
            const subChunks = splitBySentences(para, chunkSize, overlap);
            chunks.push(...subChunks);
            continue;
        }

        // 如果加入当前段落不超过限制
        const candidate = currentChunk ? `${currentChunk}\n\n${para}` : para;
        if (candidate.length <= chunkSize) {
            currentChunk = candidate;
        } else {
          // 超出限制，保存当前 chunk，开始新的
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = para;
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    // 第三步：添加重叠区域（取前一个 chunk 的末尾拼接到当前 chunk 开头）
    const overlappedChunks: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
        let chunk = chunks[i]!;
        if (i > 0 && overlap > 0) {
            const prevTail = chunks[i - 1]!.slice(-overlap).trim();
            if (prevTail) {
                chunk = `...${prevTail}\n---\n${chunk}`;
            }
        }
        // 防止重叠导致 chunk 过大
        if (chunk.length > chunkSize * 1.5) {
            chunk = chunk.slice(0, chunkSize);
        }
        overlappedChunks.push(chunk);
    }

    return overlappedChunks.filter(c => c.length > 20);
}

function chunkPlainTextByLines(text: string, chunkSize: number = 800): string[] {
    if (!text) return [];

    const normalized = text
        .replace(/\r\n/g, '\n')
        .replace(/\t/g, ' ')
        .trim();

    if (!normalized) return [];

    const lines = normalized.split('\n');
    const chunks: string[] = [];
    let current = '';

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        const candidate = current ? `${current}\n${line}` : line;
        if (candidate.length <= chunkSize) {
            current = candidate;
            continue;
        }

        if (current) {
            chunks.push(current);
        }

        if (line.length <= chunkSize) {
            current = line;
            continue;
        }

        for (let i = 0; i < line.length; i += chunkSize) {
            const piece = line.slice(i, i + chunkSize).trim();
            if (piece.length > 20) {
                chunks.push(piece);
            }
        }
        current = '';
    }

    if (current.length > 20) {
        chunks.push(current);
    }

    return chunks;
}

/**
 * 按段落/标题分隔切分
 */
function splitByParagraphs(text: string): string[] {
    const parts: string[] = [];
    // 优先按双换行（段落分隔）切分
    const sections = text.split(PARAGRAPH_BREAKS);

    for (const section of sections) {
        const trimmed = section.trim();
        if (!trimmed) continue;

        // 检测是否含标题标记（如 # 标题、第X章、一、等）
        if (SECTION_MARKERS.test(trimmed)) {
            parts.push(trimmed);
        } else if (trimmed.length < 50) {
            // 短段落直接保留
            parts.push(trimmed);
        } else {
            parts.push(trimmed);
        }
    }

    return parts;
}

/**
 * 按句子边界切分超长段落
 * 兼容中英文标点：。！？；.!?; 以及换行符
 */
function splitBySentences(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;
    const MAX_CHUNKS = 10000;

    while (start < text.length && chunks.length < MAX_CHUNKS) {
        let end = Math.min(start + chunkSize, text.length);

        if (end < text.length) {
            const searchStart = start + Math.floor(chunkSize * 0.5);
            let bestBreak = -1;

            for (let i = end; i >= searchStart; i--) {
                const char = text[i]!;
                if (SENTENCE_ENDINGS.test(char)) {
                    bestBreak = i + 1;
                    break;
                }
            }

            if (bestBreak === -1) {
                const slice = text.slice(searchStart, end);
                const commaMatch = slice.lastIndexOf('，');
                const dunMatch = slice.lastIndexOf('、');
                const bestComma = Math.max(commaMatch, dunMatch);
                if (bestComma > 0) {
                    bestBreak = searchStart + bestComma + 1;
                }
            }

            if (bestBreak > 0 && bestBreak < end + 50) {
                end = bestBreak;
            }
        }

        const chunk = text.slice(start, end).trim();
        if (chunk.length > 20) {
            chunks.push(chunk);
        }

        const nextStart = end - overlap;
        if (nextStart <= start) {
            start = end;
        } else {
            start = nextStart;
        }
        if (start >= text.length) break;
    }

    return chunks;
}

export async function processFileForRAG(filePath: string): Promise<FileChunk[]> {
    const text = await parseFile(filePath);
    if (!text) return [];
    
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    log.info(`[FileProcessor] Parsed file ${fileName}, text length=${text.length}, ext=${ext}`);

    const textChunks = ext === '.txt'
        ? chunkPlainTextByLines(text)
        : chunkText(text);

    log.info(`[FileProcessor] Chunked file ${fileName}, chunks=${textChunks.length}`);
    
    return textChunks.map((chunk, index) => ({
        text: chunk,
        metadata: {
            file_path: filePath,
            file_name: fileName,
            chunk_index: index,
            total_chunks: textChunks.length
        }
    }));
}

export async function parseFileBuffer(fileName: string, buffer: Buffer): Promise<string> {
    const ext = path.extname(fileName).toLowerCase();
    
    try {
        if (ext === '.pdf') {
            try {
                return await parsePdfWithPdfjs(buffer);
            } catch (pdfjsErr) {
                log.warn('[FileProcessor] pdfjs-dist failed for buffer:', pdfjsErr);
                return '';
            }
        } else if (ext === '.docx') {
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
        } else if (ext === '.doc') {
            const extractor = new WordExtractor();
            const doc = await extractor.extract(buffer);
            return doc.getBody();
        } else if (ext === '.csv') {
            return parseCsvBuffer(buffer);
        }
        
        return '';
    } catch (error) {
        log.error(`Error parsing uploaded file ${fileName}:`, error);
        return '';
    }
}

/**
 * 解析 CSV 文件为结构化文本
 * 将表格转为 "列名: 值" 格式的自然语言描述
 */
function parseCsvFile(filePath: string): string {
    const content = readTextFileSafe(filePath);
    return csvToText(content);
}

/**
 * 解析 CSV Buffer
 */
function parseCsvBuffer(buffer: Buffer): string {
    const content = buffer.toString('utf-8');
    return csvToText(content);
}

/**
 * 将 CSV 文本转为自然语言描述
 * 格式: 第N行: 列1=值1, 列2=值2, ...
 */
function csvToText(content: string): string {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return content; // 不是有效 CSV，返回原文

    // 解析表头
    const headers = parseCsvLine(lines[0]!);
    if (headers.length === 0) return content;

    const rows: string[] = [];
    rows.push(`表格列: ${headers.join(', ')}`);
    rows.push(`共 ${lines.length - 1} 行数据`);
    rows.push('');

    // 最多处理 500 行，避免超大文件
    const maxRows = Math.min(lines.length - 1, 500);
    for (let i = 1; i <= maxRows; i++) {
        const values = parseCsvLine(lines[i]!);
        const fields = headers
            .map((h, idx) => `${h}: ${values[idx] || ''}`)
            .join(', ');
        rows.push(`第${i}行: ${fields}`);
    }

    if (lines.length - 1 > maxRows) {
        rows.push(`... (省略 ${lines.length - 1 - maxRows} 行)`);
    }

    return rows.join('\n');
}

/**
 * 解析单行 CSV（支持引号包裹和逗号分隔）
 */
function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (inQuotes) {
            if (char === '"' && line[i + 1] === '"') {
                current += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
    }
    result.push(current.trim());
    return result;
}

/**
 * Excel 降级解析（带大小限制和错误处理）
 */
async function parseExcelFallback(filePath: string): Promise<string> {
    const stats = fs.statSync(filePath);
    const MAX_EXCEL_SIZE = 50 * 1024 * 1024; // 50MB 限制
    if (stats.size > MAX_EXCEL_SIZE) {
        log.warn(`[FileProcessor] Excel file too large (${(stats.size / 1024 / 1024).toFixed(1)}MB), skipping:`, filePath);
        return `[Excel 文件过大: ${path.basename(filePath)} (${(stats.size / 1024 / 1024).toFixed(1)}MB)]`;
    }

    try {
        const XLSX = await import('xlsx');
        const xlsxMod = XLSX.default || XLSX;
        const workbook = xlsxMod.readFile(filePath, { cellStyles: false, cellNF: false, cellDates: false });
        const rows: string[] = [];

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName]!;
            const data = xlsxMod.utils.sheet_to_json(sheet, { defval: '', raw: false }) as Record<string, string>[];
            if (data.length === 0) continue;

            const headers = Object.keys(data[0]!);
            rows.push(`=== 工作表: ${sheetName} ===`);
            rows.push(`列: ${headers.join(', ')}`);
            rows.push(`共 ${data.length} 行`);
            rows.push('');

            const maxRows = Math.min(data.length, 300);
            for (let i = 0; i < maxRows; i++) {
                const fields = headers
                    .map(h => `${h}: ${String(data[i]![h] ?? '').substring(0, 200)}`)
                    .join(', ');
                rows.push(`第${i + 1}行: ${fields}`);
            }

            if (data.length > maxRows) {
                rows.push(`... (省略 ${data.length - maxRows} 行)`);
            }
            rows.push('');
        }

        return rows.join('\n');
    } catch (importErr: any) {
        log.warn('[FileProcessor] Excel parse failed:', importErr.message);
        return `[Excel 文件解析失败: ${path.basename(filePath)} - ${importErr.message}]`;
    }
}
