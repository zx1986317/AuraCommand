import React, { useState, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString();

interface PDFViewerProps {
  pdfData: Uint8Array;
  fileName: string;
  onClose: () => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ pdfData, fileName, onClose }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const fileProp = useMemo(() => ({ data: pdfData.slice() }), [pdfData]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full h-full bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="shrink-0 relative z-10 flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-xl transition-all"><X size={18} /></button>
            <h3 className="text-sm font-bold text-foreground truncate max-w-md">{fileName}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPageNumber(Math.max(1, pageNumber - 1))} disabled={pageNumber <= 1} className="p-2 hover:bg-gray-200 rounded-lg transition-all disabled:opacity-30"><ChevronLeft size={16} /></button>
            <span className="text-xs font-mono text-muted min-w-[5rem] text-center">{pageNumber} / {numPages}</span>
            <button onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))} disabled={pageNumber >= numPages} className="p-2 hover:bg-gray-200 rounded-lg transition-all disabled:opacity-30"><ChevronRight size={16} /></button>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="p-2 hover:bg-gray-200 rounded-lg transition-all"><ZoomOut size={16} /></button>
            <span className="text-2xs font-mono text-muted min-w-[3rem] text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(3, s + 0.2))} className="p-2 hover:bg-gray-200 rounded-lg transition-all"><ZoomIn size={16} /></button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          <div className="relative flex-1 overflow-auto bg-gray-100 p-6 flex justify-center">
            <Document file={fileProp} onLoadSuccess={onDocumentLoadSuccess} loading={<div className="text-center py-20 text-sm text-muted">加载中...</div>}>
              <Page pageNumber={pageNumber} scale={scale} />
            </Document>
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-white/95 border border-gray-200 shadow-xl px-3 py-2">
              <button onClick={() => setPageNumber(Math.max(1, pageNumber - 1))} disabled={pageNumber <= 1} className="p-2 hover:bg-gray-100 rounded-full transition-all disabled:opacity-30"><ChevronLeft size={16} /></button>
              <span className="text-xs font-mono text-muted min-w-[5rem] text-center">{pageNumber} / {numPages}</span>
              <button onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))} disabled={pageNumber >= numPages} className="p-2 hover:bg-gray-100 rounded-full transition-all disabled:opacity-30"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;
