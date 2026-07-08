import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

interface SearchableDropdownProps {
  label: string;
  value: string;
  options: string[];
  onChange: (newValue: string) => void;
  placeholder?: string;
  badgeText?: (opt: string) => string | null;
}

export const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  label,
  value,
  options,
  onChange,
  placeholder = 'Type keyword to search...',
  badgeText,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
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
    <div className="relative w-full select-none" ref={containerRef}>
      <label className="block text-[11px] sm:text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
        {label}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3.5 py-2.5 rounded-2xl bg-white border text-left flex items-center justify-between gap-2 transition-all shadow-sm ${
          isOpen
            ? 'border-teal-600 ring-2 ring-teal-600/20 bg-teal-50/20'
            : 'border-slate-300 hover:border-slate-400'
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

      {/* Popout Searchable Dropdown List — Responsive Popout anchored cleanly */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white/95 backdrop-blur-2xl border-2 border-slate-300 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn max-h-[260px] sm:max-h-[300px] flex flex-col">
          {/* Sticky Search Bar */}
          <div className="p-2 border-b border-slate-200 bg-stone-50/90 sticky top-0 z-10 flex items-center gap-2">
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

          {/* Options List */}
          <div className="overflow-y-auto flex-1 p-1 space-y-0.5 divide-y divide-slate-100">
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
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between gap-2 transition-colors text-xs sm:text-sm font-bold ${
                      isSelected
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-800 hover:bg-teal-50 hover:text-teal-900'
                    }`}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      <span>{opt}</span>
                      {badge && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold ${
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
              <div className="p-4 text-center text-xs text-slate-500 font-medium">
                No matching options found for "{searchQuery}".
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
