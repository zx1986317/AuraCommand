import React from 'react';
import { Search } from 'lucide-react';

export interface DeskSearchBarProps {
  activeTab: 'content' | 'clips';
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const DeskSearchBar: React.FC<DeskSearchBarProps> = ({ activeTab, searchQuery, setSearchQuery }) => {
  return (
    <div className="px-4 py-2 border-b border-gray-100 bg-white/40">
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            type="text"
            placeholder="搜索内容..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/30 focus:border-transparent transition-all"
          />
        </div>
      </div>
    </div>
  );
};

export default DeskSearchBar;