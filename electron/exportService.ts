import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, ShadingType, convertInchesToTwip } from 'docx';
import pptxgen from 'pptxgenjs';
import * as XLSX from 'xlsx';

export async function parseMarkdownToDocx(content: string, title?: string): Promise<Buffer> {
  const lines = content.split('\n');
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push(new Paragraph({ text: '' }));
      continue;
    }

    if (trimmed.startsWith('# ')) {
      paragraphs.push(new Paragraph({
        text: trimmed.slice(2),
        heading: HeadingLevel.HEADING_1,
      }));
    } else if (trimmed.startsWith('## ')) {
      paragraphs.push(new Paragraph({
        text: trimmed.slice(3),
        heading: HeadingLevel.HEADING_2,
      }));
    } else if (trimmed.startsWith('### ')) {
      paragraphs.push(new Paragraph({
        text: trimmed.slice(4),
        heading: HeadingLevel.HEADING_3,
      }));
    } else if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ')) {
      const checked = trimmed.startsWith('- [x] ');
      const text = trimmed.slice(6);
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: checked ? '☑ ' : '☐ ' }),
          new TextRun({ text }),
        ],
      }));
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      paragraphs.push(new Paragraph({
        text: trimmed.slice(2),
        bullet: { level: 0 },
      }));
    } else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: match[2] ?? '' })],
          numbering: { reference: 'default-numbering', level: 0 },
        }));
      }
    } else {
      const bold = extractBoldRuns(trimmed);
      paragraphs.push(new Paragraph({
        children: bold.length > 0 ? bold : [new TextRun({ text: trimmed })],
      }));
    }
  }

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{
          level: 0,
          format: 'decimal',
          text: '%1.',
          alignment: AlignmentType.LEFT,
        }],
      }],
    },
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  });

  return await Packer.toBuffer(doc);
}

function extractBoldRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index) }));
    }
    const boldText = match[1];
    if (boldText) {
      runs.push(new TextRun({ text: boldText, bold: true }));
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex) }));
  }

  return runs;
}

export function parseContentToXlsx(content: string, title?: string): Buffer {
  let data: any[][] = [];

  try {
    const jsonData = JSON.parse(content);
    if (Array.isArray(jsonData)) {
      if (jsonData.length > 0 && typeof jsonData[0] === 'object') {
        const headers = Object.keys(jsonData[0]);
        data = [headers, ...jsonData.map((row: any) => headers.map(h => row[h] ?? ''))];
      } else {
        data = jsonData.map((item: any) => [item]);
      }
    }
  } catch {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      const headerLine = lines[0];
      const headerMatch = headerLine?.match(/^[\|-]+\s*(.+?)\s*[\|-]+$/);
      if (headerMatch) {
        const headers = headerMatch[1]?.split('|').map((h: string) => h.trim()).filter(Boolean) ?? [];
        data = [headers];
        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i]?.split('|').map(c => c.trim()).filter(Boolean) ?? [];
          if (cells.length > 0) data.push(cells);
        }
      } else {
        data = lines.map(line => [line]);
      }
    }

    if (data.length === 0) {
      data = [[content]];
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title || 'Sheet1');
  const result = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  return Buffer.from(result);
}

export async function parseContentToPptx(content: string, title?: string): Promise<Buffer> {
  const ppt = new pptxgen();
  ppt.layout = 'LAYOUT_16x9';

  const lines = content.split('\n');
  const slides: { title?: string; bullets: string[] }[] = [];
  let currentSlide: { title?: string; bullets: string[] } = { bullets: [] };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('# ')) {
      if (currentSlide.bullets.length > 0 || currentSlide.title) {
        slides.push(currentSlide);
      }
      currentSlide = { title: trimmed.slice(2), bullets: [] };
    } else if (trimmed.startsWith('## ')) {
      currentSlide.bullets.push(trimmed.slice(3));
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      currentSlide.bullets.push(trimmed.slice(2));
    } else if (/^\d+[.)]\s/.test(trimmed)) {
      currentSlide.bullets.push(trimmed.replace(/^\d+[.)]\s/, ''));
    } else if (currentSlide.bullets.length === 0 && !currentSlide.title) {
      currentSlide.title = trimmed;
    } else {
      currentSlide.bullets.push(trimmed);
    }
  }

  if (currentSlide.bullets.length > 0 || currentSlide.title) {
    slides.push(currentSlide);
  }

  if (slides.length === 0) {
    slides.push({ bullets: [content] });
  }

  for (const slideData of slides) {
    const slide = ppt.addSlide();
    if (slideData.title) {
      slide.addText(slideData.title, {
        x: 0.5, y: 0.5, w: '90%', h: 1,
        fontSize: 28, bold: true, color: '2d3748',
      });
    }
    if (slideData.bullets.length > 0) {
      slide.addText(
        slideData.bullets.map((b, i) => ({ text: b, options: { bullet: true, breakLine: i < slideData.bullets.length - 1 } })),
        { x: 0.5, y: slideData.title ? 1.8 : 0.5, w: '90%', h: '80%', fontSize: 18, color: '4a5568' }
      );
    }
  }

  const result = await ppt.write({ outputType: 'nodebuffer' }) as Uint8Array;
  return Buffer.from(result);
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<br\s*\/?>/gi, '\n');
}

function extractTagContent(html: string, tag: string): { content: string; inner: string } | null {
  const lowerHtml = html.toLowerCase();
  const lowerTag = tag.toLowerCase();
  const openRegex = new RegExp(`<${lowerTag}(?:\\s[^>]*)?>`, 'i');
  const closeRegex = new RegExp(`</${lowerTag}>`, 'i');
  const openMatch = openRegex.exec(html);
  if (!openMatch) return null;
  const closeMatch = closeRegex.exec(html);
  if (!closeMatch) return null;
  const content = html.slice(openMatch.index + openMatch[0].length, closeMatch.index);
  return { content, inner: openMatch[0] };
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

function getInlineStylesFromStyleAttr(style: string): Record<string, string> {
  const result: Record<string, string> = {};
  const fontMatch = style.match(/font-family:\s*([^;]+)/i);
  if (fontMatch?.[1]) result.font = fontMatch[1].replace(/['"]/g, '');
  const colorMatch = style.match(/color:\s*([^;]+)/i);
  if (colorMatch?.[1]) result.color = colorMatch[1];
  const bgMatch = style.match(/background(?:-color)?:\s*([^;]+)/i);
  if (bgMatch?.[1]) result.bg = bgMatch[1];
  return result;
}

interface RunStyle {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
  strike: boolean;
  highlight: boolean;
  color?: string;
}

interface ActiveStyles {
  bold: boolean;
  italic: boolean;
  code: boolean;
  strike: boolean;
  highlight: boolean;
  color?: string;
}

function parseInlineHtml(html: string): RunStyle[] {
  const runs: RunStyle[] = [];
  let remaining = html;
  const tokenRegex = /<(\/?)([\w-]+)(?:\s+[^>]*)?\/?>|<([^<]+)/gi;
  const stack: Array<{ tag: string; attrs: Record<string, string>; closed: boolean }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let textBuffer = '';

  const flushText = () => {
    if (textBuffer) {
      const cleanText = decodeHtmlEntities(textBuffer);
      if (cleanText) {
        const activeStyles = stack.filter(s => !s.closed).reduce<ActiveStyles>((acc, s) => {
          const t = s.tag.toLowerCase();
          if (t === 'strong' || t === 'b') acc.bold = true;
          if (t === 'em' || t === 'i') acc.italic = true;
          if (t === 'code') acc.code = true;
          if (t === 's' || t === 'del') acc.strike = true;
          if (t === 'mark' || (s.attrs.class || '').includes('highlight')) acc.highlight = true;
          if (s.attrs.style) {
            const c = getInlineStylesFromStyleAttr(s.attrs.style);
            if (c.color) { acc.color = c.color; }
          }
          return acc;
        }, { bold: false, italic: false, code: false, strike: false, highlight: false } as ActiveStyles);

        runs.push({
          text: cleanText,
          bold: activeStyles.bold,
          italic: activeStyles.italic,
          code: activeStyles.code,
          strike: activeStyles.strike,
          highlight: activeStyles.highlight,
          color: activeStyles.color ?? '',
        });
      }
      textBuffer = '';
    }
  };

  while ((match = tokenRegex.exec(remaining)) !== null) {
    const matched3 = match[3];
    if (matched3 !== undefined) {
      textBuffer += matched3;
      continue;
    }

    flushText();

    const isClose = !!match[1];
    const tagName = (match[2] ?? '').toLowerCase();
    const rawAttrs = match[0].replace(/<\/?[\w-]+/, '').replace(/\/?>$/, '');
    const attrs: Record<string, string> = {};
    const attrRegex = /([\w-]+)=["']([^"']*)["']/gi;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
      if (attrMatch[1] !== undefined) {
        attrs[attrMatch[1]] = attrMatch[2] ?? '';
      }
    }

    if (isClose) {
      const idx = stack.map(s => s.tag).lastIndexOf(tagName);
      if (idx >= 0) {
        for (let i = stack.length - 1; i >= idx; i--) {
          const el = stack[i];
          if (el !== undefined) {
            el.closed = true;
          }
        }
      }
    } else {
      stack.push({ tag: tagName, attrs, closed: false });
    }
    lastIndex = match.index + match[0].length;
  }

  const afterText = remaining.slice(lastIndex);
  if (afterText) {
    textBuffer += afterText;
  }
  flushText();

  return runs;
}

function runsToTextRuns(runs: RunStyle[], defaultFont: string, defaultSize: number, defaultColor: string): TextRun[] {
  return runs
    .filter(r => r.text)
    .map(r => new TextRun({
      text: r.text,
      font: r.code ? 'Consolas' : defaultFont,
      size: r.code ? 19 : defaultSize,
      bold: r.bold,
      italics: r.italic,
      strike: r.strike,
      color: r.highlight ? 'C94040' : (r.color || defaultColor),
    }));
}

async function parseHtmlToDocx(html: string, title?: string): Promise<Buffer> {
  const defaultFont = 'Microsoft YaHei';
  const codeFont = 'Consolas';
  const accentColor = '0D7377';
  const lightGray = 'F5F5F5';
  const darkGray = '333333';

  const children: any[] = [];

  if (title) {
    children.push(new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      run: { font: defaultFont, size: 48, bold: true, color: accentColor }
    }));
  }

  const blocks = html.split(/(?=<(?:h[123]|p|blockquote|pre|ul|ol|table|div|li|hr)[^a-zA-Z])/i);

  for (const blockRaw of blocks) {
    const block = blockRaw.trim();
    if (!block) continue;

    const tagMatch = block.match(/^<([\w-]+)/i);
    if (!tagMatch) {
      const runs = parseInlineHtml(block);
      if (runs.length > 0) {
        children.push(new Paragraph({
          children: runsToTextRuns(runs, defaultFont, 24, darkGray),
          spacing: { before: 60, after: 60 },
        }));
      }
      continue;
    }

    const tag = (tagMatch[1] ?? '').toLowerCase();

    if (tag === 'h1') {
      const extracted = extractTagContent(block, 'h1');
      if (extracted) {
        children.push(new Paragraph({
          children: runsToTextRuns(parseInlineHtml(extracted.content), defaultFont, 40, darkGray),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 160 },
        }));
      }
    } else if (tag === 'h2') {
      const extracted = extractTagContent(block, 'h2');
      if (extracted) {
        children.push(new Paragraph({
          children: runsToTextRuns(parseInlineHtml(extracted.content), defaultFont, 32, darkGray),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 320, after: 120 },
        }));
      }
    } else if (tag === 'h3') {
      const extracted = extractTagContent(block, 'h3');
      if (extracted) {
        children.push(new Paragraph({
          children: runsToTextRuns(parseInlineHtml(extracted.content), defaultFont, 26, darkGray),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 120 },
        }));
      }
    } else if (tag === 'p') {
      const extracted = extractTagContent(block, 'p');
      if (extracted) {
        const runs = parseInlineHtml(extracted.content);
        children.push(new Paragraph({
          children: runsToTextRuns(runs, defaultFont, 24, darkGray),
          spacing: { before: 60, after: 60 },
        }));
      }
    } else if (tag === 'blockquote') {
      const extracted = extractTagContent(block, 'blockquote');
      if (extracted) {
        children.push(new Paragraph({
          children: runsToTextRuns(parseInlineHtml(extracted.content), defaultFont, 24, darkGray),
          border: {
            left: { style: BorderStyle.SINGLE, size: 12, color: accentColor },
          },
          indent: { left: convertInchesToTwip(0.3) },
          spacing: { before: 100, after: 100 },
        }));
      }
    } else if (tag === 'pre') {
      const extracted = extractTagContent(block, 'pre');
      if (extracted) {
        const codeText = stripHtmlTags(decodeHtmlEntities(extracted.content));
        children.push(new Paragraph({
          children: [new TextRun({ text: codeText, font: codeFont, size: 19, color: darkGray })],
          shading: { type: ShadingType.CLEAR, color: lightGray, fill: lightGray },
          border: {
            top: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' },
            left: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' },
            right: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' },
          },
          indent: { left: convertInchesToTwip(0.2) },
          spacing: { before: 100, after: 100 },
        }));
      }
    } else if (tag === 'ul') {
      for (const liMatch of block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
        const liContent = liMatch[1] ?? '';
        const runs = parseInlineHtml(liContent);
        if (runs.length > 0) {
          children.push(new Paragraph({
            children: runsToTextRuns(runs, defaultFont, 24, darkGray),
            bullet: { level: 0 },
            spacing: { before: 60, after: 60 },
          }));
        }
      }
    } else if (tag === 'ol') {
      let listIdx = 0;
      for (const liMatch of block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
        listIdx++;
        const liContent = liMatch[1] ?? '';
        const runs = parseInlineHtml(liContent);
        if (runs.length > 0) {
          children.push(new Paragraph({
            children: runsToTextRuns(runs, defaultFont, 24, darkGray),
            numbering: { reference: `ol-${listIdx}`, level: 0 },
            spacing: { before: 60, after: 60 },
          }));
        }
      }
    } else if (tag === 'table') {
      const tableResult = buildTable(block, defaultFont, codeFont, accentColor, lightGray, darkGray);
      if (tableResult) children.push(tableResult);
    } else if (tag === 'hr') {
      children.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'DDDDDD' } },
        spacing: { before: 200, after: 200 },
        children: [],
      }));
    } else {
      const runs = parseInlineHtml(block);
      if (runs.length > 0) {
        children.push(new Paragraph({
          children: runsToTextRuns(runs, defaultFont, 24, darkGray),
          spacing: { before: 60, after: 60 },
        }));
      }
    }
  }

  const numberingConfigs = blocks
    .filter(b => b.trim().startsWith('<ol'))
    .flatMap((b, bIdx) => {
      const items = (b.match(/<li/gi) || []).length;
      return Array.from({ length: items }, (_, i) => ({
        reference: `ol-${i + 1}`,
        levels: [{ level: 0, format: 'decimal' as const, text: '%1.', alignment: AlignmentType.LEFT }],
      }));
    });

  const doc = new Document({
    numbering: {
      config: numberingConfigs.length > 0 ? numberingConfigs : [{
        reference: 'default-ol',
        levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT }],
      }],
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1),
          }
        }
      },
      children,
    }],
  });

  return await Packer.toBuffer(doc);
}

function buildTable(
  tableHtml: string,
  defaultFont: string,
  codeFont: string,
  accentColor: string,
  lightGray: string,
  darkGray: string
): Table | null {
  const rows: TableRow[] = [];
  const headerRowCells: TableCell[] = [];
  const bodyRows: TableRow[] = [];
  let isFirstRow = true;

  for (const trMatch of tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const trContent = trMatch[1] ?? '';
    const cells: TableCell[] = [];

    for (const cellMatch of trContent.matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const cellTag = (cellMatch[1] ?? '').toLowerCase();
      const cellContent = cellMatch[2] ?? '';
      const runs = parseInlineHtml(cellContent);

      const cellParagraphs = [new Paragraph({
        children: runsToTextRuns(runs, defaultFont, 22, darkGray),
        spacing: { before: 40, after: 40 },
      })];

      const cellNode = new TableCell({
        children: cellParagraphs,
        width: { size: 2000, type: WidthType.AUTO },
      });

      cells.push(cellNode);

      if (cellTag === 'th') {
        headerRowCells.push(cellNode);
      }
    }

    if (cells.length === 0) continue;

    if (isFirstRow && headerRowCells.length > 0) {
      isFirstRow = false;
      continue;
    }

    bodyRows.push(new TableRow({ children: cells }));
    isFirstRow = false;
  }

  if (headerRowCells.length > 0) {
    rows.push(new TableRow({ children: headerRowCells }));
  }
  rows.push(...bodyRows);

  if (rows.length === 0) return null;

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

export { parseHtmlToDocx };
