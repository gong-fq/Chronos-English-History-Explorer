import React, { useRef, useEffect } from 'react';
import { EraId } from '../types';
import { TIMELINE_DATA } from '../constants';

interface TimelineHorizontalProps {
  selectedEra: EraId | null;
  onSelectEra: (id: EraId) => void;
}

const TimelineHorizontal: React.FC<TimelineHorizontalProps> = ({ selectedEra, onSelectEra }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    // Scroll selected item into view smoothly
    if (selectedEra && scrollContainerRef.current) {
      const index = TIMELINE_DATA.findIndex(item => item.id === selectedEra);
      if (index !== -1 && itemRefs.current[index]) {
        itemRefs.current[index]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [selectedEra]);

  return (
    <div 
      ref={scrollContainerRef}
      className="w-full overflow-x-auto border-b border-gray-200 bg-white/90 backdrop-blur-sm sticky top-0 z-20 shadow-sm"
      role="navigation"
      aria-label="Chronological Timeline"
    >
      <div className="flex items-center min-w-max px-8 py-5 relative">
        {/* Continuous Line Background */}
        <div className="absolute left-8 right-8 top-[39px] h-0.5 bg-gray-200 -z-10" />

        {TIMELINE_DATA.map((item, index) => {
          const isSelected = selectedEra === item.id;
          // Determine if this era is "past" (before the current selection) to color the path/dots
          const isPast = selectedEra 
            ? TIMELINE_DATA.findIndex(i => i.id === selectedEra) > index 
            : false;

          return (
            <button 
              key={item.id}
              ref={(el) => { itemRefs.current[index] = el; }}
              onClick={() => onSelectEra(item.id)}
              className="group flex flex-col items-center mx-2 cursor-pointer focus:outline-none min-w-[130px]"
            >
              {/* Year Label */}
              <span className={`text-[10px] font-bold tracking-wider mb-2 transition-colors duration-300 ${isSelected ? 'text-history-gold' : 'text-gray-400 group-hover:text-gray-500'}`}>
                {item.yearRange}
              </span>

              {/* Node/Dot */}
              <div className={`
                w-4 h-4 rounded-full border-[3px] box-content transition-all duration-300 relative
                ${isSelected 
                  ? 'bg-white border-history-gold scale-150 shadow-lg z-10' 
                  : isPast 
                    ? 'bg-history-gold border-history-gold hover:scale-110'
                    : 'bg-white border-gray-300 group-hover:border-gray-400 group-hover:scale-110'
                }
              `} />

              {/* Title Label */}
              <span className={`mt-3 text-xs font-serif text-center font-medium leading-tight px-1 transition-colors duration-300 max-w-[140px] ${isSelected ? 'text-history-dark scale-105 font-bold' : 'text-gray-500 group-hover:text-history-dark'}`}>
                {item.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TimelineHorizontal;