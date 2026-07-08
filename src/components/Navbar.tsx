import { useState } from 'react';
import { Home, MapPin, LayoutDashboard, Send, Database, Globe, ChevronDown, Cloud } from 'lucide-react';
import { ConstituencySelectorModal } from './ConstituencySelectorModal';
import { CloudConfigModal } from './CloudConfigModal';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOnline?: boolean;
  region: { state: string; district: string; constituency: string };
  onSelectRegion: (region: { state: string; district: string; constituency: string }) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  isOnline = true,
  region,
  onSelectRegion,
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState<boolean>(false);

  const navItems = [
    { id: 'landing', label: 'Home', icon: Home },
    { id: 'explore', label: 'Explore Map', icon: MapPin },
    { id: 'report', label: 'Report Intake', icon: Send },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'management', label: 'Admin', icon: Database },
  ];

  return (
    <>
      {/* Layer 1: Floating Command Center — Dual Layout for Mobile vs Desktop */}
      <header className="fixed top-4 sm:top-5 left-4 right-4 sm:left-6 sm:right-6 max-w-6xl mx-auto z-50 transition-all duration-300">
        
        {/* =========================================================================
            DESKTOP LAYOUT (hidden md:flex) — Single Horizontal Line Floating Pill
            ========================================================================= */}
        <div className="hidden md:flex bg-[rgba(255,255,255,0.88)] backdrop-blur-[24px] border border-white/90 ring-1 ring-slate-900/5 rounded-full px-6 py-2.5 shadow-[0_24px_60px_rgba(15,23,42,0.14),0_6px_18px_rgba(15,23,42,0.08)] items-center justify-between gap-4 transition-all duration-300">
          
          {/* Brand & Constituency Selector — Exact Same Line */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onSelectTab('landing')}
              className="flex items-center gap-2 text-left focus:outline-none group py-0.5"
            >
              {/* LARGE Brand Title on Desktop */}
              <span className="font-extrabold text-xl tracking-tight text-slate-900 group-hover:text-teal-700 transition-colors whitespace-nowrap">
                People's Priorities™
              </span>
            </button>

            {/* Constituency Pill Button */}
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

            {/* Cloud & Gemini Setup Trigger Button */}
            <button
              onClick={() => setIsCloudModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-teal-50 to-emerald-50 hover:from-teal-100 hover:to-emerald-100 border border-teal-300/80 text-xs text-teal-900 font-extrabold transition-all active:scale-95 shadow-sm shrink-0"
              title="Configure Gemini API & Firebase Cloud Setup"
            >
              <Cloud className="w-3.5 h-3.5 text-teal-600 animate-pulse shrink-0" />
              <span>AI Cloud</span>
            </button>
          </div>

          {/* Unified 5-Tab Navigation Bar — Fully round both inner bar and individual buttons */}
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

        {/* =========================================================================
            MOBILE LAYOUT (md:hidden) — 2026 Apple Maps / Linear 2-Row Command Center
            ========================================================================= */}
        <div className="md:hidden bg-[rgba(255,255,255,0.88)] backdrop-blur-[24px] border border-white/90 ring-1 ring-slate-900/5 rounded-[22px] shadow-[0_24px_60px_rgba(15,23,42,0.14),0_6px_18px_rgba(15,23,42,0.08)] px-4 py-2.5 transition-all duration-300 flex flex-col gap-2">
          
          {/* Top Header Row: Left Aligned Logo & Large Title / Right Aligned Constituency Selector */}
          <div className="flex items-center justify-between gap-2 w-full">
            <button
              onClick={() => onSelectTab('landing')}
              className="flex items-center gap-1.5 text-left focus:outline-none group py-0.5 shrink-0"
            >
              {/* LARGE Brand Title on Mobile */}
              <span className="font-extrabold text-base tracking-tight text-slate-900 group-hover:text-teal-700 transition-colors whitespace-nowrap">
                People's Priorities™
              </span>
            </button>

            {/* Right Aligned Constituency Selector */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100/80 hover:bg-slate-200/60 border border-slate-200/60 text-xs text-slate-800 font-semibold transition-all active:scale-95 group shrink-0 max-w-[160px] truncate"
              title="Click to select State or Constituency"
            >
              <Globe className="w-3.5 h-3.5 text-teal-600 group-hover:animate-spin shrink-0" />
              <span className="text-slate-800 flex items-center gap-0.5 truncate font-semibold">
                {region.constituency.replace(' (Demo Region)', '')}
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </span>
            </button>
          </div>

          {/* Separate Horizontal Row Below: 44x44 touch targets, clean visual hierarchy */}
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

      {/* Center Oval Pop Constituency Selector Modal */}
      <ConstituencySelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentRegion={region}
        onSelectRegion={onSelectRegion}
      />

      {/* Cloud & Gemini Configuration Modal */}
      <CloudConfigModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
      />
    </>
  );
};
