import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

interface SearchableDropdownProps {
  label: string;
  value: string;
  options: string[];
  onChange: (newValue: string) => void;
  placeholder?: string;
  badgeText?: (opt: string) => string | null;
  onOpenChange?: (open: boolean) => void;
}

export const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  label,
  value,
  options,
  onChange,
  placeholder = 'Type keyword to search...',
  badgeText,
  onOpenChange,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleOpen = (newVal: boolean) => {
    setIsOpen(newVal);
    if (onOpenChange) onOpenChange(newVal);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        toggleOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div 
      className={`relative w-full select-none transition-all duration-300 ${
        isOpen ? 'z-[9999] transform scale-[1.02]' : 'z-10'
      }`} 
      ref={containerRef}
    >
      <label className={`block text-[11px] sm:text-xs font-extrabold uppercase tracking-wider mb-1.5 transition-colors ${
        isOpen ? 'text-teal-700' : 'text-slate-700'
      }`}>
        {label}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => toggleOpen(!isOpen)}
        className={`w-full px-3.5 py-2.5 rounded-2xl bg-white border text-left flex items-center justify-between gap-2 transition-all shadow-sm ${
          isOpen
            ? 'border-teal-600 ring-4 ring-teal-600/20 bg-teal-50/30 shadow-lg'
            : 'border-slate-300 hover:border-slate-400 hover:shadow-md'
        }`}
      >
        <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
          {value || 'Select option...'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-teal-600' : ''
          }`}
        />
      </button>

      {/* Popout Searchable Dropdown List — Apple Maps style floating search card */}
      {isOpen && (
        <div className="absolute z-[9999] left-0 right-0 mt-2 bg-white border-2 border-teal-500/90 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.65)] overflow-hidden animate-scaleUp max-h-[280px] sm:max-h-[320px] flex flex-col will-change-transform">
          {/* Sticky Search Bar */}
          <div className="p-2.5 border-b border-slate-100/90 bg-stone-50/95 sticky top-0 z-10 flex items-center gap-2">
            <Search className="w-4 h-4 text-teal-600 shrink-0 ml-1.5" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent text-xs sm:text-sm text-slate-900 font-semibold focus:outline-none placeholder:text-slate-400 py-1"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
                title="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options List — Hardware accelerated smooth scrolling + overscroll containment */}
          <div className="overflow-y-auto flex-1 p-1.5 space-y-0.5 divide-y divide-slate-100/80 overscroll-contain scroll-smooth [WebkitOverflowScrolling:touch] will-change-scroll transform translate-z-0">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt === value;
                const badge = badgeText ? badgeText(opt) : null;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      onChange(opt);
                      toggleOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-2xl text-left flex items-center justify-between gap-2 transition-all text-xs sm:text-sm font-bold ${
                      isSelected
                        ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                        : 'text-slate-800 hover:bg-teal-50 hover:text-teal-900'
                    }`}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      <span>{opt}</span>
                      {badge && (
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                            isSelected
                              ? 'bg-teal-700 text-teal-100 border border-teal-500'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                    </span>
                    {isSelected && <Check className="w-4 h-4 shrink-0 text-white" />}
                  </button>
                );
              })
            ) : (
              <div className="p-5 text-center text-xs text-slate-500 font-medium">
                No matching options found for "{searchQuery}".
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
