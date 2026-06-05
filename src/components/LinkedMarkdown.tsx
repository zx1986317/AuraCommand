import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface LinkedMarkdownProps {
  content: string;
  onLinkClick: (memoTitle: string) => void;
  className?: string;
}

const LinkedMarkdown: React.FC<LinkedMarkdownProps> = ({ content, onLinkClick, className }) => {
  const processedContent = content.replace(
    /\[\[([^\]]+)\]\]/g,
    (match, title) => `[$[${title}$]](memo://${encodeURIComponent(title)})`
  );

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith('memo://')) {
              const title = decodeURIComponent(href.replace('memo://', ''));
              const displayText = String(children).replace(/^\$|\$$/g, '');
              return (
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    onLinkClick(title);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent rounded-lg cursor-pointer hover:bg-accent/20 transition-all text-sm font-medium border border-accent/20"
                >
                  <span className="text-2xs opacity-60">⟨</span>
                  {displayText}
                  <span className="text-2xs opacity-60">⟩</span>
                </span>
              );
            }
            return (
              <a
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  if (href) {
                    window.ipcRenderer.invoke('open-external', { url: href });
                  }
                }}
                className="text-accent hover:underline"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default LinkedMarkdown;
