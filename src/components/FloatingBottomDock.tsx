import { Home, MapPin, Send, LayoutDashboard, Database } from 'lucide-react';

interface FloatingBottomDockProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const FloatingBottomDock: React.FC<FloatingBottomDockProps> = ({ currentTab, onSelectTab }) => {
  const navItems = [
    { id: 'landing', label: 'Home', icon: Home },
    { id: 'explore', label: 'Explore Map', icon: MapPin },
    { id: 'report', label: 'Raise a Complaint', icon: Send },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'management', label: 'Admin & Health', icon: Database },
  ];

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 select-none">
      {/* Elegant Grey Background (#E2E8F0) to highlight distinctively against white page background */}
      <div className="bg-[#E2E8F0]/95 backdrop-blur-2xl border border-slate-300/90 rounded-full px-2 sm:px-3.5 py-1.5 sm:py-2.5 flex items-center justify-between gap-1 sm:gap-1.5 shadow-2xl shadow-slate-400/80">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex items-center justify-center gap-1.5 h-10 sm:h-11 rounded-full transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-extrabold shadow-md shadow-teal-600/30 px-3.5 sm:w-32 scale-[1.04]'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white/90 font-bold w-10 sm:w-32'
              }`}
              title={item.label}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white animate-pulse' : 'text-slate-600'}`} />
              <span className={`text-xs font-extrabold truncate px-0.5 ${isActive ? 'inline sm:inline' : 'hidden sm:inline'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
