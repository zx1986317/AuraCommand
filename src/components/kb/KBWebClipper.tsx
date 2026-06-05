import React, { useState } from 'react';
import { Globe, Plus, CheckCircle2 } from 'lucide-react';

interface KBWebClipperProps {
  onClipWebPage: (url: string) => void;
}

const KBWebClipper: React.FC<KBWebClipperProps> = ({ onClipWebPage }) => {
  const [clipUrl, setClipUrl] = useState('');
  const [isClipping, setIsClipping] = useState(false);

  const handleClip = () => {
    if (!clipUrl.trim()) return;
    setIsClipping(true);
    onClipWebPage(clipUrl.trim());
    setClipUrl('');
    setTimeout(() => setIsClipping(false), 3000);
  };

  return (
    <div className="mb-6 flex gap-3">
      <div className="flex-1 relative">
        <Globe size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="url"
          value={clipUrl}
          onChange={(e) => setClipUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleClip()}
          placeholder="输入网页URL剪藏到知识库..."
          className="w-full pl-10 pr-4 py-3 bg-white/60 border border-teal-900/5 rounded-2xl text-sm outline-none focus:border-accent/30 transition-all placeholder:text-muted/40"
        />
      </div>
      <button
        onClick={handleClip}
        disabled={isClipping || !clipUrl.trim()}
        className="px-6 py-3 bg-accent text-white text-sm font-bold rounded-2xl hover:bg-accent/90 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
      >
        {isClipping ? <CheckCircle2 size={16} /> : <Plus size={16} />}
        {isClipping ? '已提交' : '剪藏'}
      </button>
    </div>
  );
};

export default KBWebClipper;