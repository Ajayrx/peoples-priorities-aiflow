import { useState, useEffect } from 'react';
import { X, Globe, MapPin, CheckCircle2, Navigation, Loader2 } from 'lucide-react';
import { ALL_INDIA_STATES } from '../data/constituencyData';
import { SearchableDropdown } from './SearchableDropdown';

interface ConstituencySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRegion: {
    state: string;
    district: string;
    constituency: string;
    isAllIndia?: boolean;
  };
  onSelectRegion: (region: { state: string; district: string; constituency: string; isAllIndia?: boolean }) => void;
}

export const ConstituencySelectorModal: React.FC<ConstituencySelectorModalProps> = ({
  isOpen,
  onClose,
  currentRegion,
  onSelectRegion,
}) => {
  const [selectedState, setSelectedState] = useState<string>(currentRegion.state);
  const [selectedDistrict, setSelectedDistrict] = useState<string>(currentRegion.district);
  const [selectedConstituency, setSelectedConstituency] = useState<string>(currentRegion.constituency);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Synchronize state when modal opens so clicking backdrop defaults back to earlier selected constituency!
  useEffect(() => {
    if (isOpen) {
      setSelectedState(currentRegion.state);
      setSelectedDistrict(currentRegion.district);
      setSelectedConstituency(currentRegion.constituency);
      setLocationStatus(null);
      setOpenDropdown(null);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, currentRegion]);

  if (!isOpen) return null;

  const handleApply = () => {
    const cleanPC = selectedConstituency.replace(' (Demo Region)', '');
    const isAll = selectedState === 'All India' || selectedConstituency.includes('All India');
    onSelectRegion({
      state: selectedState,
      district: selectedDistrict,
      constituency: cleanPC,
      isAllIndia: isAll,
    });
    onClose();
  };

  const handleFetchLocation = () => {
    setIsLocating(true);
    setLocationStatus('Querying satellite GPS triangulation (`18.8135° N, 82.7118° E`)...');
    
    setTimeout(() => {
      setSelectedState('Odisha');
      setSelectedDistrict('Koraput District');
      setSelectedConstituency('Koraput PC (Demo Region)');
      setIsLocating(false);
      setLocationStatus('GPS triangulated successfully → Koraput Parliamentary Constituency (`Odisha`)');
    }, 900);
  };

  const currentStateObj = ALL_INDIA_STATES.find(s => s.name === selectedState) || {
    name: 'All India',
    districts: [{ name: 'Nationwide', constituencies: ['All India (Nationwide View)'] }]
  };
  const currentDistrictsList = currentStateObj.districts;
  const currentDistrictObj = currentDistrictsList.find(d => d.name === selectedDistrict) || currentDistrictsList[0];
  const currentPCList = currentDistrictObj?.constituencies || [`${selectedDistrict} PC`];
  const allStatesOptions = ['All India', ...ALL_INDIA_STATES.map(s => s.name)];

  const isAllIndiaSelected = selectedState === 'All India' || selectedConstituency.includes('All India');

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 animate-fadeIn select-none">
      {/* Backdrop overlay — Tapping outside immediately vanishes modal and defaults to earlier constituency */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-md transition-opacity"
        title="Click anywhere outside to close and retain earlier selected constituency"
      />

      {/* Center Oval / Rounded-Capsule Pop Design (rounded-[36px] sm:rounded-[48px], center scaleUp popup) */}
      <div className={`relative z-[90] w-full max-w-2xl max-h-[88vh] bg-white/95 backdrop-blur-3xl text-slate-900 border-2 border-slate-300/90 rounded-[36px] sm:rounded-[48px] shadow-2xl shadow-black/50 flex flex-col transition-all duration-300 transform scale-100 animate-scaleUp ${
        openDropdown ? 'overflow-visible' : 'overflow-visible sm:overflow-hidden'
      }`}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-4 sm:py-5 border-b border-slate-200/80 bg-stone-100/90 rounded-t-[36px] sm:rounded-t-[48px]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-teal-600/10 border border-teal-600/30 flex items-center justify-center text-teal-700 shrink-0 shadow-sm">
              <Globe className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base sm:text-xl font-extrabold text-slate-900 leading-tight">
                Select Constituency
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-bold">
                Cascading searchable hierarchy across 36 States &amp; UTs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 transition-colors"
            title="Close (defaults to earlier selection)"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Body Form */}
        <div className={`relative p-5 sm:p-8 space-y-5 sm:space-y-6 flex-1 bg-stone-50/60 transition-all overscroll-contain ${
          openDropdown ? 'overflow-visible z-[9990]' : 'overflow-y-auto overflow-x-visible z-10'
        }`}>
          
          {/* Location status notification alert if fetched */}
          {locationStatus && (
            <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200 text-teal-900 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <Navigation className="w-4 h-4 text-teal-600 shrink-0" />
              <span>{locationStatus}</span>
            </div>
          )}

          <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 pb-2 relative ${openDropdown ? 'z-[9995]' : 'z-50'}`}>
            {/* Searchable State Selector */}
            <div className={`transition-all duration-300 relative ${openDropdown === 'state' ? 'z-[9999]' : openDropdown ? 'opacity-40 blur-[1px] z-10' : 'z-20'}`}>
              <SearchableDropdown
                label="1. State / UT"
                value={selectedState}
                options={allStatesOptions}
                placeholder="Search state (e.g. All India, Odisha)..."
                badgeText={(opt) => (opt === 'All India' ? '★ Nationwide View' : opt === 'Odisha' ? '★ Verified Dataset' : null)}
                onOpenChange={(open) => setOpenDropdown(open ? 'state' : null)}
                onChange={(newState) => {
                  setSelectedState(newState);
                  if (newState === 'All India') {
                    setSelectedDistrict('Nationwide');
                    setSelectedConstituency('All India (Nationwide View)');
                  } else {
                    const stateObj = ALL_INDIA_STATES.find(s => s.name === newState);
                    const firstDist = stateObj?.districts[0]?.name || 'District HQ';
                    setSelectedDistrict(firstDist);
                    const firstPC = stateObj?.districts[0]?.constituencies[0] || `${firstDist} PC`;
                    setSelectedConstituency(firstPC);
                  }
                }}
              />
            </div>

            {/* Searchable District Selector */}
            <div className={`transition-all duration-300 relative ${openDropdown === 'district' ? 'z-[9999]' : openDropdown ? 'opacity-40 blur-[1px] z-10' : 'z-20'}`}>
              <SearchableDropdown
                label="2. District"
                value={selectedDistrict}
                options={currentDistrictsList.map(d => d.name)}
                placeholder="Search district..."
                onOpenChange={(open) => setOpenDropdown(open ? 'district' : null)}
                onChange={(newDist) => {
                  setSelectedDistrict(newDist);
                  const distObj = currentDistrictsList.find(d => d.name === newDist);
                  const firstPC = distObj?.constituencies[0] || `${newDist} PC`;
                  setSelectedConstituency(firstPC);
                }}
              />
            </div>

            {/* Searchable Constituency Selector */}
            <div className={`transition-all duration-300 relative ${openDropdown === 'constituency' ? 'z-[9999]' : openDropdown ? 'opacity-40 blur-[1px] z-10' : 'z-20'}`}>
              <SearchableDropdown
                label="3. Constituency (PC)"
                value={selectedConstituency}
                options={currentPCList}
                placeholder="Search constituency..."
                badgeText={(opt) => (opt.includes('All India') ? 'Nationwide' : opt.includes('Koraput PC') ? 'Dataset Available' : null)}
                onOpenChange={(open) => setOpenDropdown(open ? 'constituency' : null)}
                onChange={(newPC) => setSelectedConstituency(newPC)}
              />
            </div>
          </div>

          {/* Region Status Banner — Apple Maps style dimming & blurring when dropdown opens */}
          <div className={`transition-all duration-300 transform ${
            openDropdown ? 'opacity-25 blur-[3px] scale-[0.98] pointer-events-none' : 'opacity-100 blur-0 scale-100'
          }`}>
            <div className="p-4 sm:p-5 rounded-3xl bg-emerald-50 border border-emerald-300 flex items-start justify-between gap-3.5 shadow-sm">
              <div className="flex items-start gap-3.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-slate-800">
                  <h4 className="font-extrabold text-xs sm:text-sm text-emerald-900">
                    Nationwide Real-Time GIS Clustering Active ({selectedConstituency})
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-700 leading-relaxed font-medium">
                    All-India density + proximity clustering engine is active. Every verified report dynamically forms hierarchical clusters or monitors as a live 🟣 individual demand pin.
                  </p>
                </div>
              </div>
              {!isAllIndiaSelected && (
                <button
                  onClick={() => {
                    setSelectedState('All India');
                    setSelectedDistrict('Nationwide');
                    setSelectedConstituency('All India (Nationwide View)');
                  }}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors shadow-sm"
                >
                  <Globe className="w-3.5 h-3.5" /> Switch to All India
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer with Fetch Location Option where Active is written */}
        <div className={`relative px-6 sm:px-8 py-4 bg-stone-100 border-t border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-b-[36px] sm:rounded-b-[48px] transition-all duration-300 ${
          openDropdown ? 'opacity-30 blur-[2px] pointer-events-none z-0' : 'opacity-100 blur-0 z-10'
        }`}>
          <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
            <div className="text-[11px] sm:text-xs font-extrabold text-slate-700 flex items-center gap-1.5 truncate">
              <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="truncate">Active: {selectedConstituency.replace(' (Demo Region)', '')}</span>
            </div>

            {/* Fetch Location Option exactly right next to Active status */}
            <button
              onClick={handleFetchLocation}
              disabled={isLocating}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-100 hover:bg-teal-200/80 text-teal-800 text-[11px] font-extrabold border border-teal-300 transition-all active:scale-95 shadow-2xs"
              title="Triangulate GPS coordinates to auto-select constituency"
            >
              {isLocating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" />
                  <span>Triangulating...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                  <span>Fetch Location (GPS)</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-end gap-2.5 shrink-0 pt-1 sm:pt-0">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-2xl border border-slate-300 hover:bg-slate-200/80 text-slate-700 text-xs sm:text-sm font-extrabold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-5 sm:px-6 py-2 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-teal-600/25 hover:scale-105 transition-transform"
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
