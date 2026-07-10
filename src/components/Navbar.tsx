import { useState, useRef, useEffect } from 'react';
import { Home, MapPin, LayoutDashboard, Send, Database, Globe, ChevronDown, Languages } from 'lucide-react';
import { ConstituencySelectorModal } from './ConstituencySelectorModal';
import { useLanguage, type AppLanguage } from '../context/LanguageContext';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOnline?: boolean;
  region: { state: string; district: string; constituency: string; isAllIndia?: boolean };
  onSelectRegion: (region: { state: string; district: string; constituency: string; isAllIndia?: boolean }) => void;
}

const LANGUAGES: { code: AppLanguage; label: string; native: string; flag: string }[] = [
  { code: 'en', label: 'English',  native: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi',    native: 'हिंदी',   flag: '🇮🇳' },
  { code: 'od', label: 'Odia',     native: 'ଓଡ଼ିଆ',   flag: '🏛️' },
  { code: 'te', label: 'Telugu',   native: 'తెలుగు',  flag: '🌿' },
];

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  isOnline = true,
  region,
  onSelectRegion,
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [langOpen, setLangOpen] = useState<boolean>(false);
  const [mobileLangOpen, setMobileLangOpen] = useState<boolean>(false);
  const langRef = useRef<HTMLDivElement>(null);
  const mobileLangRef = useRef<HTMLDivElement>(null);
  const { language, setLanguage, t } = useLanguage();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
      if (mobileLangRef.current && !mobileLangRef.current.contains(e.target as Node)) {
        setMobileLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  const navItems = [
    { id: 'landing',    label: t('nav.home'),      icon: Home },
    { id: 'explore',    label: t('nav.explore'),    icon: MapPin },
    { id: 'report',     label: t('nav.report'),     icon: Send },
    { id: 'dashboard',  label: t('nav.dashboard'),  icon: LayoutDashboard },
    { id: 'management', label: t('nav.admin'),       icon: Database },
  ];

  /** Shared dropdown list of languages */
  const renderLangList = (onSelect: () => void) => (
    LANGUAGES.map((lang) => (
      <button
        key={lang.code}
        onClick={() => { setLanguage(lang.code); onSelect(); }}
        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-left transition-colors ${
          language === lang.code
            ? 'bg-teal-50 text-teal-800'
            : 'text-slate-700 hover:bg-slate-50'
        }`}
      >
        <span className="text-base leading-none">{lang.flag}</span>
        <span>{lang.native}</span>
        {language === lang.code && (
          <span className="ml-auto text-teal-600 text-xs font-bold">✓</span>
        )}
      </button>
    ))
  );

  return (
    <>
      {/* Layer 1: Floating Command Center */}
      <header className="fixed top-4 sm:top-5 left-4 right-4 sm:left-6 sm:right-6 max-w-6xl mx-auto z-50 transition-all duration-300">

        {/* =========================================================================
            DESKTOP LAYOUT (hidden md:flex) — Side-by-side pills
            ========================================================================= */}
        <div className="hidden md:flex items-center justify-between gap-4 w-full">
          
          {/* Main Navbar Pill */}
          <div className="flex-1 bg-[rgba(255,255,255,0.88)] backdrop-blur-[24px] border border-white/90 ring-1 ring-slate-900/5 rounded-full px-6 py-2.5 shadow-[0_24px_60px_rgba(15,23,42,0.14),0_6px_18px_rgba(15,23,42,0.08)] flex items-center justify-between gap-4 transition-all duration-300">
            {/* Brand & Constituency Selector */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => onSelectTab('landing')}
                className="flex items-center gap-2 text-left focus:outline-none group py-0.5"
              >
                <span className="font-extrabold text-xl tracking-tight text-slate-900 group-hover:text-teal-700 transition-colors whitespace-nowrap">
                  People's Priorities™
                </span>
              </button>

              {/* Constituency Pill */}
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-50 border border-slate-300 text-xs text-slate-800 font-bold transition-all active:scale-95 group shadow-sm max-w-[260px] truncate"
                title="Click to select State or Constituency"
              >
                <Globe className="w-3.5 h-3.5 text-teal-600 group-hover:animate-spin shrink-0" />
                <span className="text-teal-800 flex items-center gap-1 truncate font-extrabold">
                  {region.constituency.replace(' (Demo Region)', '')}
                  <ChevronDown className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                </span>
              </button>
            </div>

            {/* Nav Tabs */}
            <nav className="flex items-center gap-1 bg-slate-300/80 p-1.5 rounded-full border border-slate-400/50 text-center shadow-inner shrink-0">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`flex items-center justify-center gap-1.5 h-9 rounded-full text-sm transition-all duration-200 relative ${
                      isActive
                        ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-600/30 font-extrabold px-4 scale-[1.03]'
                        : 'text-slate-700 hover:text-slate-950 hover:bg-white/90 font-bold px-3.5'
                    }`}
                    title={item.label}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white animate-pulse' : 'text-slate-600'}`} />
                    <span className={`truncate ${isActive ? 'font-extrabold' : 'font-bold'}`}>
                      {item.label}
                    </span>
                    {item.id === 'report' && !isOnline && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" title="Offline Queue Active" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Language Switcher Pill (Desktop) — Same style, size, shadows, and backdrop blur */}
          <div ref={langRef} className="relative shrink-0">
            <div className="bg-[rgba(255,255,255,0.88)] backdrop-blur-[24px] border border-white/90 ring-1 ring-slate-900/5 rounded-full p-2.5 shadow-[0_24px_60px_rgba(15,23,42,0.14),0_6px_18px_rgba(15,23,42,0.08)] flex items-center justify-center">
              <button
                onClick={() => setLangOpen((v) => !v)}
                className="flex items-center gap-1.5 h-9 px-4 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-sm transition-all active:scale-95 shadow-sm"
                title="Switch Language"
              >
                <Languages className="w-4 h-4 text-teal-600 shrink-0" />
                <span>{currentLang.native}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {langOpen && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/12 overflow-hidden z-50 min-w-[148px]">
                {renderLangList(() => setLangOpen(false))}
              </div>
            )}
          </div>

        </div>

        {/* =========================================================================
            MOBILE LAYOUT (md:hidden) — Header without Language (Clean 2-row layout)
            ========================================================================= */}
        <div className="md:hidden bg-[rgba(255,255,255,0.88)] backdrop-blur-[24px] border border-white/90 ring-1 ring-slate-900/5 rounded-[22px] shadow-[0_24px_60px_rgba(15,23,42,0.14),0_6px_18px_rgba(15,23,42,0.08)] px-4 py-2.5 transition-all duration-300 flex flex-col gap-2">

          {/* Top Row: Brand & Constituency Only */}
          <div className="flex items-center justify-between gap-2 w-full">
            <button
              onClick={() => onSelectTab('landing')}
              className="flex items-center gap-1.5 text-left focus:outline-none group py-0.5 shrink-0"
            >
              <span className="font-extrabold text-base tracking-tight text-slate-900 group-hover:text-teal-700 transition-colors whitespace-nowrap">
                People's Priorities™
              </span>
            </button>

            {/* Constituency pill */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100/80 hover:bg-slate-200/60 border border-slate-200/60 text-xs text-slate-800 font-semibold transition-all active:scale-95 group max-w-[150px] truncate"
              title="Click to select State or Constituency"
            >
              <Globe className="w-3.5 h-3.5 text-teal-600 group-hover:animate-spin shrink-0" />
              <span className="text-slate-800 flex items-center gap-0.5 truncate font-semibold">
                {region.constituency.replace(' (Demo Region)', '')}
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </span>
            </button>
          </div>

          {/* Bottom Row: Nav tabs */}
          <nav className="w-full flex items-center justify-between pt-2 border-t border-slate-100/80 gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`min-h-[44px] min-w-[44px] px-2.5 rounded-[14px] flex items-center justify-center gap-1.5 transition-all duration-200 relative ${
                    isActive
                      ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-semibold shadow-sm shadow-teal-600/20 scale-[1.02]'
                      : 'bg-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50/70 font-medium'
                  }`}
                  title={item.label}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span className={`text-xs tracking-tight ${isActive ? 'inline font-semibold' : 'hidden font-medium'}`}>
                    {item.label}
                  </span>
                  {item.id === 'report' && !isOnline && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" title="Offline Queue Active" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Floating Language Switcher for Mobile only (fixed bottom-right corner) */}
      <div ref={mobileLangRef} className="fixed bottom-6 right-6 md:hidden z-[9999] flex flex-col items-end">
        {mobileLangOpen && (
          <div className="mb-3 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden min-w-[148px] animate-scaleUp">
            {renderLangList(() => setMobileLangOpen(false))}
          </div>
        )}
        <button
          onClick={() => setMobileLangOpen((v) => !v)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-xl hover:shadow-teal-600/20 active:scale-95 transition-all border border-teal-500"
          title="Switch Language"
        >
          <Languages className="w-5 h-5" />
        </button>
      </div>

      {/* Constituency Selector Modal */}
      <ConstituencySelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentRegion={region}
        onSelectRegion={onSelectRegion}
      />
    </>
  );
};
