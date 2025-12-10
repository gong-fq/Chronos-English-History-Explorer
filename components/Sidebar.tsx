import React, { useState } from 'react';
import { EraId } from '../types';
import { TIMELINE_DATA } from '../constants';

interface SidebarProps {
  selectedEra: EraId | null;
  onSelectEra: (id: EraId) => void;
  onSearch: (query: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedEra, onSelectEra, onSearch, isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onSearch(searchTerm);
      setSearchTerm(''); 
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Content */}
      <aside className={`
        fixed top-0 left-0 bottom-0 z-30 w-72 bg-history-dark text-white shadow-xl transition-transform duration-300 ease-in-out
        md:translate-x-0 md:static md:h-screen md:shrink-0 overflow-y-auto flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-gray-700 sticky top-0 bg-history-dark z-10">
          <h1 className="text-2xl font-serif font-bold text-history-gold">Chronos</h1>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">History of English</p>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-700 bg-gray-900/50 sticky top-[89px] z-10 backdrop-blur-sm">
          <form onSubmit={handleSearch} className="relative">
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search topics..."
              className="w-full bg-gray-800 text-gray-200 text-sm rounded-lg pl-3 pr-10 py-2.5 focus:outline-none focus:ring-1 focus:ring-history-gold placeholder-gray-500 border border-gray-700"
            />
            <button 
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-history-gold p-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </button>
          </form>
        </div>

        <nav className="p-6 flex-1">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-6">Timeline</div>
          
          <div className="relative border-l-2 border-gray-700 ml-2 space-y-8 pb-4">
            {TIMELINE_DATA.map((item) => {
              const isSelected = selectedEra === item.id;
              return (
                <div key={item.id} className="relative pl-6">
                  {/* Timeline Dot */}
                  <div 
                    className={`absolute -left-[7px] top-1.5 w-4 h-4 rounded-full border-4 border-history-dark transition-all duration-300
                      ${isSelected ? 'bg-history-gold scale-125' : 'bg-gray-600 hover:bg-gray-400'}
                    `}
                  />
                  
                  <button
                    onClick={() => {
                      onSelectEra(item.id);
                      onClose();
                    }}
                    className={`text-left w-full group transition-all duration-300 ${isSelected ? 'translate-x-1' : 'hover:translate-x-1'}`}
                  >
                    <div className={`font-serif text-lg leading-tight transition-colors ${isSelected ? 'text-history-gold font-bold' : 'text-gray-300 group-hover:text-white'}`}>
                      {item.title}
                    </div>
                    <div className={`text-xs mt-1 transition-colors ${isSelected ? 'text-gray-400' : 'text-gray-500 group-hover:text-gray-400'}`}>
                      {item.yearRange}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </nav>

        <div className="p-6 mt-auto border-t border-gray-700 bg-history-dark z-10">
          <p className="text-xs text-gray-500 italic">
            "Language is the dress of thought." <br/> - Samuel Johnson
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;