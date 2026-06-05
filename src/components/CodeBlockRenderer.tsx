import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Eye, Code, AlertTriangle, Download, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import mermaid from 'mermaid';

const SyntaxHighlighterAny = SyntaxHighlighter as unknown as React.ComponentType<Record<string, unknown>>;

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
});

interface CodeBlockRendererProps {
  language: string;
  codeContent: string;
  codeId: string;
  copiedCodeId: string | null;
  onCopy: (codeId: string, text: string) => void;
  isStreaming?: boolean;
  onOpenInCanvas?: ((htmlContent: string, title?: string) => void) | undefined;
  isCanvasOpen?: boolean | undefined;
}

type TabMode = 'code' | 'preview';

const COLLAPSE_LINE_THRESHOLD = 18;
const COLLAPSE_CHAR_THRESHOLD = 1200;

// 语言分类映射
const LANGUAGE_CATEGORIES: Record<string, string> = {
  html: 'HTML 结构',
  css: '样式表',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  js: 'JavaScript',
  ts: 'TypeScript',
  json: 'JSON 数据',
  python: 'Python',
  java: 'Java',
  go: 'Go',
  rust: 'Rust',
  sql: 'SQL',
  shell: 'Shell 脚本',
  bash: 'Shell 脚本',
  markdown: 'Markdown',
  yaml: 'YAML 配置',
  xml: 'XML',
  mermaid: 'Mermaid 图表',
};

const getCategoryLabel = (lang: string): string => {
  const normalized = lang.toLowerCase();
  return LANGUAGE_CATEGORIES[normalized] || `${lang} 代码`;
};

export const CodeBlockRenderer: React.FC<CodeBlockRendererProps> = React.memo(({
  language,
  codeContent,
  codeId,
  copiedCodeId,
  onCopy,
  isStreaming = false,
  onOpenInCanvas,
  isCanvasOpen,
}) => {
  const [tab, setTab] = useState<TabMode>('code');
  const [mermaidSvg, setMermaidSvg] = useState<string>('');
  const [mermaidError, setMermaidError] = useState<string>('');
  const mermaidRef = useRef<HTMLDivElement>(null);
  const mermaidIdRef = useRef(0);

  const isMermaid = language === 'mermaid';
  const isHtml = language === 'html';
  const hasPreview = isMermaid || isHtml;
  const lineCount = useMemo(() => codeContent.split(/\r?\n/).length, [codeContent]);
  const shouldDefaultCollapse = !isStreaming && (lineCount > COLLAPSE_LINE_THRESHOLD || codeContent.length > COLLAPSE_CHAR_THRESHOLD);
  const [isCollapsed, setIsCollapsed] = useState(shouldDefaultCollapse);
  const previewCode = useMemo(() => codeContent.split(/\r?\n/).slice(0, COLLAPSE_LINE_THRESHOLD).join('\n'), [codeContent]);
  const categoryLabel = getCategoryLabel(language);
  const hiddenLineCount = Math.max(lineCount - COLLAPSE_LINE_THRESHOLD, 0);

  useEffect(() => {
    if (isStreaming) {
      setIsCollapsed(false);
      return;
    }
    setIsCollapsed(shouldDefaultCollapse);
  }, [codeId, isStreaming, shouldDefaultCollapse]);

  const handleTabSwitch = (nextTab: TabMode) => {
    setTab(nextTab);
  };

  useEffect(() => {
    if (isMermaid && tab === 'preview' && !isStreaming) {
      let cancelled = false;
      mermaid
        .render(`mermaid-${codeId}-${++mermaidIdRef.current}`, codeContent)
        .then(({ svg }) => {
          if (!cancelled) {
            setMermaidSvg(svg);
            setMermaidError('');
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setMermaidError(String(err?.message || 'Mermaid 渲染失败'));
            setMermaidSvg('');
          }
        });
      return () => {
        cancelled = true;
      };
    }
  }, [isMermaid, tab, codeContent, codeId, isStreaming]);

  const handleCopy = () => onCopy(codeId, codeContent);

  const handleDownload = () => {
    const extMap: Record<string, string> = {
      xsl: 'xsl', xslt: 'xsl', xml: 'xml', html: 'html', css: 'css',
      javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
      python: 'py', py: 'py', java: 'java', c: 'c', cpp: 'cpp',
      csharp: 'cs', go: 'go', rust: 'rs', ruby: 'rb', php: 'php',
      sql: 'sql', shell: 'sh', bash: 'sh', sh: 'sh',
      json: 'json', yaml: 'yaml', yml: 'yml', toml: 'toml',
      markdown: 'md', md: 'md', latex: 'tex', dockerfile: 'Dockerfile',
    };
    const ext = extMap[language.toLowerCase()] || language || 'txt';
    const blob = new Blob([codeContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenInCanvas = () => {
    if (onOpenInCanvas && isHtml) {
      if (isCanvasOpen) {
        // toggle off: pass empty content to signal close
        onOpenInCanvas('', '');
      } else {
        onOpenInCanvas(codeContent, `${categoryLabel} - 预览`);
      }
    }
  };

  // HTML preview: use raw codeContent directly in srcdoc iframe
  const htmlPreviewSrc = useMemo(() => {
    if (!isHtml || tab !== 'preview') return '';
    return codeContent;
  }, [isHtml, codeContent, tab]);

  return (
    <div className="relative group/code not-prose my-4 rounded-2xl overflow-hidden border border-teal-900/10 shadow-sm">
      {/* Header with category label */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-black/85 to-black/75 border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* Category label */}
          <span className="text-2xs font-bold text-white/70 uppercase tracking-wider">
            {categoryLabel}
          </span>

          {/* Collapse toggle */}
          {!isStreaming && (
            <button
              onClick={() => setIsCollapsed(prev => !prev)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-medium text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
              {isCollapsed ? '展开' : '折叠'}
            </button>
          )}

          {/* Preview tabs */}
          {hasPreview && (
            <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
              <button
                onClick={() => handleTabSwitch('code')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-medium transition-all ${
                  tab === 'code'
                    ? 'bg-white/20 text-white'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <Code size={11} />
                代码
              </button>
              <button
                onClick={() => handleTabSwitch('preview')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-medium transition-all ${
                  tab === 'preview'
                    ? 'bg-white/20 text-white'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <Eye size={11} />
                预览
              </button>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {isHtml && onOpenInCanvas && (
            <button
              onClick={isCanvasOpen ? () => onOpenInCanvas('', '') : handleOpenInCanvas}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all text-2xs font-medium ${
                isCanvasOpen
                  ? 'bg-accent/20 text-accent hover:bg-accent/30'
                  : 'bg-white/10 hover:bg-white/20 text-white/60 hover:text-white'
              }`}
              title={isCanvasOpen ? '关闭画布' : '在画布中打开'}
            >
              <ExternalLink size={12} />
              {isCanvasOpen ? '关闭画布' : '画布'}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-white/60 hover:text-white text-2xs font-medium"
          >
            {copiedCodeId === codeId ? (
              <Check size={12} className="text-green-400" />
            ) : (
              <Copy size={12} />
            )}
            {copiedCodeId === codeId ? '已复制' : '复制'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-white/60 hover:text-white text-2xs font-medium"
            title="下载文件"
          >
            <Download size={12} />
            下载
          </button>
        </div>
      </div>

      {/* Code content area with smooth collapse animation */}
      <div className="relative">
        {tab === 'code' || !hasPreview ? (
          <>
            <AnimatePresence initial={false}>
              {isCollapsed ? (
                <motion.div
                  key="collapsed"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="bg-[#1e1e1e]"
                  style={{ borderRadius: '0 0 1rem 1rem' }}
                >
                  <pre
                    style={{
                      margin: 0,
                      padding: '1rem 1.5rem',
                      fontSize: '0.8125rem',
                      lineHeight: '1.65',
                      color: '#d4d4d4',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      maxHeight: '320px',
                    }}
                  >
                    {previewCode}
                  </pre>
                  <div className="px-4 py-2.5 border-t border-white/10 bg-black/20 flex items-center justify-between">
                    <span className="text-2xs text-white/50">
                      已折叠 {hiddenLineCount} 行代码
                    </span>
                    <button
                      onClick={() => setIsCollapsed(false)}
                      className="text-2xs text-white/70 hover:text-white font-medium transition-colors flex items-center gap-1"
                    >
                      <ChevronDown size={12} />
                      展开完整代码
                    </button>
                  </div>
                </motion.div>
              ) : isStreaming ? (
                <motion.div
                  key="streaming"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <pre
                    style={{
                      margin: 0,
                      padding: '1.5rem',
                      borderRadius: '0 0 1rem 1rem',
                      fontSize: '0.875rem',
                      lineHeight: '1.7',
                      background: '#1e1e1e',
                      color: '#d4d4d4',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    }}
                  >
                    {codeContent}
                  </pre>
                </motion.div>
              ) : (
                <motion.div
                  key="expanded"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <SyntaxHighlighterAny
                    style={vscDarkPlus}
                    language={language}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      padding: '1.5rem',
                      borderRadius: '0 0 1rem 1rem',
                      fontSize: '0.875rem',
                      lineHeight: '1.7',
                      background: '#1e1e1e',
                    }}
                  >
                    {codeContent}
                  </SyntaxHighlighterAny>
                </motion.div>
              )}
            </AnimatePresence>

            {isStreaming && (
              <div className="absolute bottom-2 right-3 flex items-center gap-1.5 px-2 py-1 bg-black/60 rounded-md text-white/60 text-2xs">
                <div className="w-2 h-2 border border-white/30 border-t-white/70 rounded-full animate-spin" />
                生成中...
              </div>
            )}
          </>
        ) : isMermaid ? (
          <div className="bg-[#1e1e1e] p-6 flex items-center justify-center min-h-[120px]" style={{ borderRadius: '0 0 1rem 1rem' }}>
            {mermaidError ? (
              <div className="flex flex-col items-center gap-2 text-red-400">
                <AlertTriangle size={20} />
                <span className="text-xs">{mermaidError}</span>
              </div>
            ) : mermaidSvg ? (
              <div
                ref={mermaidRef}
                className="mermaid-preview"
                dangerouslySetInnerHTML={{ __html: mermaidSvg }}
              />
            ) : (
              <div className="flex items-center gap-2 text-white/40 text-xs">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                渲染中...
              </div>
            )}
          </div>
        ) : isHtml ? (
          <div className="bg-white" style={{ borderRadius: '0 0 1rem 1rem' }}>
            <iframe
              title={`html-preview-${codeId}`}
              srcDoc={htmlPreviewSrc}
              className="w-full border-0"
              style={{ borderRadius: '0 0 1rem 1rem', minHeight: '400px', height: '60vh', maxHeight: '800px' }}
              sandbox="allow-same-origin"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
});
