import React from 'react';

interface KBPaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  filteredTotal: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const KBPagination: React.FC<KBPaginationProps> = ({
  page,
  totalPages,
  pageSize,
  filteredTotal,
  onPageChange,
  onPageSizeChange,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-teal-900/10 mt-1">
      <div className="flex items-center gap-2">
        <span className="text-2xs text-muted">
          共 {filteredTotal} 个文件
        </span>
        <select
          value={pageSize}
          onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
          className="text-2xs text-muted bg-transparent border border-teal-900/10 rounded px-1 py-0.5 cursor-pointer"
        >
          {[12, 24, 48, 96].map(n => (
            <option key={n} value={n}>{n} / 页</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className="px-1.5 py-0.5 text-2xs rounded border border-teal-900/10 hover:bg-accent/10 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          首页
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-1.5 py-0.5 text-2xs rounded border border-teal-900/10 hover:bg-accent/10 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ‹
        </button>
        <span className="text-2xs text-muted px-1">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-1.5 py-0.5 text-2xs rounded border border-teal-900/10 hover:bg-accent/10 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ›
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className="px-1.5 py-0.5 text-2xs rounded border border-teal-900/10 hover:bg-accent/10 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          末页
        </button>
      </div>
    </div>
  );
};

export default KBPagination;
