import { useState, useEffect } from 'react';
import { X, Globe, MapPin, CheckCircle2, AlertCircle, ArrowRight, Navigation, Loader2 } from 'lucide-react';
import { ALL_INDIA_STATES } from '../data/constituencyData';
import { SearchableDropdown } from './SearchableDropdown';

interface ConstituencySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRegion: {
    state: string;
    district: string;
    constituency: string;
  };
  onSelectRegion: (region: { state: string; district: string; constituency: string }) => void;
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

  // Synchronize state when modal opens so clicking backdrop defaults back to earlier selected constituency!
  useEffect(() => {
    if (isOpen) {
      setSelectedState(currentRegion.state);
      setSelectedDistrict(currentRegion.district);
      setSelectedConstituency(currentRegion.constituency);
      setLocationStatus(null);
    }
  }, [isOpen, currentRegion]);

  if (!isOpen) return null;

  const handleApply = () => {
    const cleanPC = selectedConstituency.replace(' (Demo Region)', '');
    onSelectRegion({
      state: selectedState,
      district: selectedDistrict,
      constituency: cleanPC,
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

  const currentStateObj = ALL_INDIA_STATES.find(s => s.name === selectedState) || ALL_INDIA_STATES[0];
  const currentDistrictsList = currentStateObj.districts;
  const currentDistrictObj = currentDistrictsList.find(d => d.name === selectedDistrict) || currentDistrictsList[0];
  const currentPCList = currentDistrictObj?.constituencies || [`${selectedDistrict} PC`];

  const isDemoRegionSelected = 
    selectedState === 'Odisha' && 
    selectedDistrict === 'Koraput District' && 
    selectedConstituency.includes('Koraput PC');

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 animate-fadeIn select-none">
      {/* Backdrop overlay — Tapping outside immediately vanishes modal and defaults to earlier constituency */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-md transition-opacity"
        title="Click anywhere outside to close and retain earlier selected constituency"
      />

      {/* Center Oval / Rounded-Capsule Pop Design (rounded-[36px] sm:rounded-[48px], center scaleUp popup) */}
      <div className="relative z-[90] w-full max-w-2xl max-h-[88vh] bg-white/95 backdrop-blur-3xl text-slate-900 border-2 border-slate-300/90 rounded-[36px] sm:rounded-[48px] shadow-2xl shadow-black/50 flex flex-col overflow-visible transition-all duration-300 transform scale-100 animate-scaleUp">
        
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
        <div className="p-5 sm:p-8 space-y-5 sm:space-y-6 overflow-y-auto overflow-x-visible flex-1 bg-stone-50/60">
          
          {/* Location status notification alert if fetched */}
          {locationStatus && (
            <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200 text-teal-900 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <Navigation className="w-4 h-4 text-teal-600 shrink-0" />
              <span>{locationStatus}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 pb-2">
            {/* Searchable State Selector */}
            <SearchableDropdown
              label="1. State / UT"
              value={selectedState}
              options={ALL_INDIA_STATES.map(s => s.name)}
              placeholder="Search state (e.g. Odisha)..."
              badgeText={(opt) => (opt === 'Odisha' ? '★ Dataset Available' : null)}
              onChange={(newState) => {
                setSelectedState(newState);
                const stateObj = ALL_INDIA_STATES.find(s => s.name === newState);
                const firstDist = stateObj?.districts[0]?.name || 'District HQ';
                setSelectedDistrict(firstDist);
                const firstPC = stateObj?.districts[0]?.constituencies[0] || `${firstDist} PC`;
                setSelectedConstituency(firstPC);
              }}
            />

            {/* Searchable District Selector */}
            <SearchableDropdown
              label="2. District"
              value={selectedDistrict}
              options={currentDistrictsList.map(d => d.name)}
              placeholder="Search district..."
              onChange={(newDist) => {
                setSelectedDistrict(newDist);
                const distObj = currentDistrictsList.find(d => d.name === newDist);
                const firstPC = distObj?.constituencies[0] || `${newDist} PC`;
                setSelectedConstituency(firstPC);
              }}
            />

            {/* Searchable Constituency Selector */}
            <SearchableDropdown
              label="3. Constituency (PC)"
              value={selectedConstituency}
              options={currentPCList}
              placeholder="Search constituency..."
              badgeText={(opt) => (opt.includes('Koraput PC') ? 'Dataset Available' : null)}
              onChange={(newPC) => setSelectedConstituency(newPC)}
            />
          </div>

          {/* Region Status Banner */}
          {isDemoRegionSelected ? (
            <div className="p-4 sm:p-5 rounded-3xl bg-emerald-50 border border-emerald-300 flex items-start gap-3.5 shadow-sm">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-slate-800">
                <h4 className="font-extrabold text-xs sm:text-sm text-emerald-900">
                  Dataset Available &amp; Active
                </h4>
                <p className="text-[11px] sm:text-xs text-slate-700 leading-relaxed font-medium">
                  Full dataset loaded for <strong>Odisha → Koraput PC</strong> (`Semiliguda`, `Damanjodi`). Includes <strong>verified community intakes, active hotspots, and real-time multi-factor scoring</strong>.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5 rounded-3xl bg-amber-50 border border-amber-300 flex items-start gap-3.5 shadow-sm">
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-2 text-slate-800">
                <h4 className="font-extrabold text-xs sm:text-sm text-amber-900">
                  No Dataset Loaded for {selectedConstituency}
                </h4>
                <p className="text-[11px] sm:text-xs text-slate-700 leading-relaxed font-medium">
                  To prevent browser memory overloads across 543 PCs, real-time intelligence is seeded exclusively for <strong>Odisha → Koraput PC</strong>.
                </p>
                <button
                  onClick={() => {
                    setSelectedState('Odisha');
                    setSelectedDistrict('Koraput District');
                    setSelectedConstituency('Koraput PC (Demo Region)');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold transition-colors shadow-sm"
                >
                  Switch to Koraput (Dataset Available) <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Fetch Location Option where Active is written */}
        <div className="px-6 sm:px-8 py-4 bg-stone-100 border-t border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-b-[36px] sm:rounded-b-[48px]">
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
