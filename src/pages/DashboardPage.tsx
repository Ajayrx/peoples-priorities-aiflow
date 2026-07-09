import React, { useState, useMemo, useEffect } from 'react';
import {
  Sliders,
  FileSpreadsheet,
  Download,
  UserCheck,
  RefreshCw,
  ArrowRight,
  Sparkles,
  Users,
  TrendingUp,
  CheckCircle2
} from 'lucide-react';
import type { Region, UserRole, Hotspot } from '../types';
import { MOCK_HOTSPOTS } from '../data/mockData';
import { subscribeToLiveReports, type LiveCitizenReport } from '../services/liveCloudBus';
import { mergeLiveReportsIntoClusters } from '../utils/clusterMerger';

interface DashboardPageProps {
  region: Region;
  onNavigate: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ region, onNavigate }) => {
  const isDemoRegion = region.constituency.includes('Koraput');

  // Active User Role Viewport Switcher
  const [activeRole, setActiveRole] = useState<UserRole>('MP');

  // Multi-Factor Priority Formula Weight Calibration Sliders
  const [demandWeight, setDemandWeight] = useState<number>(1.5);
  const [demographicWeight, setDemographicWeight] = useState<number>(1.8);
  const [infraWeight, setInfraWeight] = useState<number>(2.0);
  const [urgencyWeight, setUrgencyWeight] = useState<number>(1.5);

  // Selected clusters for action mandates (by Hotspot ID)
  const [selectedMandates, setSelectedMandates] = useState<string[]>(
    isDemoRegion ? ['hs-semiliguda-road', 'hs-koraput-schools'] : []
  );

  // Category filter comparison state: 'ALL' | 'Roads' | 'Schools' | 'Water' | 'Healthcare' | 'Drainage'
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Real-time citizen reports state
  const [liveReports, setLiveReports] = useState<LiveCitizenReport[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToLiveReports((reports) => {
      setLiveReports(reports);
    });
    return () => unsubscribe();
  }, []);

  // Recalculate priority scores dynamically based on slider weights
  const dynamicHotspots = useMemo(() => {
    const baseList: Hotspot[] = isDemoRegion ? [...MOCK_HOTSPOTS] : [];
    const combined = mergeLiveReportsIntoClusters(baseList, liveReports);
    return combined.map((hs) => {
      // Base score adjusted by our user slider multipliers vs defaults
      const baseD = hs.priorityBreakdown.demandVelocityMultiplier;
      const baseP = hs.priorityBreakdown.demographicImpactMultiplier;
      const baseS = hs.priorityBreakdown.infrastructureGapMultiplier;
      const baseU = hs.priorityBreakdown.seasonalUrgencyMultiplier;

      const dynamicScoreRaw = Math.round(
        (baseD * demandWeight) +
        (baseP * demographicWeight) +
        (baseS * infraWeight) +
        (baseU * urgencyWeight) * 12
      );
      const dynamicScore = Math.min(100, Math.max(20, dynamicScoreRaw));

      return {
        ...hs,
        dynamicScore,
      };
    }).filter((hs) => {
      if (categoryFilter === 'ALL') return true;
      return hs.category === categoryFilter;
    }).sort((a, b) => b.dynamicScore - a.dynamicScore);
  }, [isDemoRegion, demandWeight, demographicWeight, infraWeight, urgencyWeight, categoryFilter, liveReports]);

  // Calculate total citizen demand voices and impacted population for selected mandates
  const { totalDemandVoices, totalBeneficiaries } = useMemo(() => {
    let voices = 0;
    let pop = 0;
    selectedMandates.forEach((id) => {
      const found = dynamicHotspots.find((h) => h.id === id);
      if (found) {
        voices += found.metrics.citizenReportCount;
        pop += found.metrics.impactedPopulation;
      }
    });
    return {
      totalDemandVoices: voices,
      totalBeneficiaries: pop,
    };
  }, [selectedMandates, dynamicHotspots]);

  const toggleMandateSelection = (id: string) => {
    if (selectedMandates.includes(id)) {
      setSelectedMandates(selectedMandates.filter((s) => s !== id));
    } else {
      setSelectedMandates([...selectedMandates, id]);
    }
  };

  const rolesList: { id: UserRole; label: string; icon: string; desc: string }[] = [
    { id: 'MP', label: 'Member of Parliament (MP)', icon: '🏛️', desc: 'High-Demand Category Priority comparison & Action Mandate issuance' },
    { id: 'DISTRICT_OFFICER', label: 'District Collectorate / Officer', icon: '🧑‍💼', desc: 'Technical engineering verification & field deployment queue' },
    { id: 'CITIZEN', label: 'Citizen Transparency Portal', icon: '🧑‍🤝‍🧑', desc: 'Public demand ranking tracking & community satisfaction voting' },
    { id: 'VOLUNTEER', label: 'Field Verifier / Volunteer', icon: '🙋', desc: 'Mobile GPS field check queue & before/after ground-truth logs' },
    { id: 'ADMIN', label: 'System Administrator', icon: '⚙️', desc: 'GIS pipeline clustering & AI verification threshold settings' },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-slate-900 pb-16">
      
      {/* Header Command Strip */}
      <div className="bg-white border-b border-slate-200/80 shadow-xs py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold text-slate-600">
                ACTIVE CANVAS: <strong className="text-slate-900">{region.state} → {region.constituency.replace(' (Demo Region)', '')}</strong>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <span>MP High-Demand Category Priority Dashboard & Resolution Simulator</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigate('explore')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm transition-all shadow-sm shadow-teal-600/20 active:scale-95"
            >
              <span>Switch to GIS Map</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Role Switcher Pills Strip */}
        <div className="bg-white rounded-[24px] border border-slate-200/90 p-3 sm:p-4 shadow-md overflow-x-auto">
          <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2.5 px-1">
            Active Viewport Lens (Role-Based Access Control):
          </div>
          <div className="flex items-center gap-2 min-w-max">
            {rolesList.map((role) => {
              const isSelected = activeRole === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => setActiveRole(role.id)}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 border ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-800 shadow-md scale-[1.02]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-teal-300'
                  }`}
                  title={role.desc}
                >
                  <span className="text-base">{role.icon}</span>
                  <span>{role.label}</span>
                  {isSelected && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ROLE SPECIFIC VIEWPORT RENDER */}
        {activeRole !== 'MP' && activeRole !== 'DISTRICT_OFFICER' ? (
          <div className="bg-white rounded-[28px] border border-slate-200/90 p-8 shadow-xl text-center space-y-4 max-w-3xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center mx-auto shadow-md">
              <UserCheck className="w-8 h-8" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900">
              Viewport Mode active for: {rolesList.find(r => r.id === activeRole)?.label}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto font-medium leading-relaxed">
              {rolesList.find(r => r.id === activeRole)?.desc}. All actions in this view are read-only or scoped to field verification checklists and citizen feedback voting.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => setActiveRole('MP')}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs shadow-md shadow-teal-600/20"
              >
                Return to MP Demand Priority Engine
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT 5 COLUMNS: Formula Weight Calibration Sliders */}
            <div className="lg:col-span-5 bg-white rounded-[28px] border border-slate-200/90 shadow-xl p-5 sm:p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-teal-600" />
                    <span>8-Factor Weight Calibration</span>
                  </h3>
                  <button
                    onClick={() => {
                      setDemandWeight(1.5);
                      setDemographicWeight(1.8);
                      setInfraWeight(2.0);
                      setUrgencyWeight(1.5);
                    }}
                    className="text-xs text-teal-700 font-bold hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reset
                  </button>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Adjust formula multipliers to see how citizen demand volume vs. infrastructure gaps shift rank order.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                    <span>Citizen Demand Velocity Weight (D)</span>
                    <span className="font-mono text-teal-700 font-black">{demandWeight.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range" min="0.5" max="3.0" step="0.1" value={demandWeight}
                    onChange={(e) => setDemandWeight(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                  />
                  <span className="text-[10px] font-mono text-slate-400">Surge intensity & volume of verified citizen voices</span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                    <span>Demographic Impact Weight (P)</span>
                    <span className="font-mono text-teal-700 font-black">{demographicWeight.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range" min="0.5" max="3.0" step="0.1" value={demographicWeight}
                    onChange={(e) => setDemographicWeight(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                  />
                  <span className="text-[10px] font-mono text-slate-400">Census 2021/2026 tribal radius population impacted</span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                    <span>Infrastructure Deficit Weight (S)</span>
                    <span className="font-mono text-teal-700 font-black">{infraWeight.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range" min="0.5" max="3.0" step="0.1" value={infraWeight}
                    onChange={(e) => setInfraWeight(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                  />
                  <span className="text-[10px] font-mono text-slate-400">Absence of schools/hospitals within 6.5 km</span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                    <span>Seasonal Monsoon Urgency (U)</span>
                    <span className="font-mono text-amber-600 font-black">{urgencyWeight.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range" min="0.5" max="3.0" step="0.1" value={urgencyWeight}
                    onChange={(e) => setUrgencyWeight(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <span className="text-[10px] font-mono text-slate-400">July-September high rainfall cutoff vulnerability</span>
                </div>
              </div>

              {/* Formula Verification Box */}
              <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-2 font-mono text-xs shadow-md">
                <div className="flex items-center justify-between text-teal-400 font-extrabold text-[11px]">
                  <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> LIVE RECALCULATION ACTIVE</span>
                  <span>{dynamicHotspots.length} Clusters</span>
                </div>
                <div className="text-[11px] text-slate-300">
                  Highest Demand Priority: <strong className="text-white">{dynamicHotspots[0]?.name || 'N/A'}</strong> ({dynamicHotspots[0]?.dynamicScore || 0}/100)
                </div>
              </div>
            </div>

            {/* RIGHT 7 COLUMNS: Category Demand Priority & Action Mandate Center */}
            <div className="lg:col-span-7 bg-white rounded-[28px] border border-slate-200/90 shadow-xl p-5 sm:p-6 space-y-6">
              
              {/* Demand Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-md">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Verified Citizen Intakes</span>
                  <div className="text-2xl font-mono font-black text-white mt-1 flex items-center gap-1.5">
                    <TrendingUp className="w-5 h-5 text-teal-400" />
                    <span>{dynamicHotspots.reduce((sum, h) => sum + (h.metrics?.citizenReportCount || 1), 0).toLocaleString()}</span>
                  </div>
                  <span className="text-[11px] font-mono text-teal-400">Live verified data across {region.constituency.replace(' (Demo Region)', '')}</span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 shadow-xs">
                  <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase">Impacted Population</span>
                  <div className="text-2xl font-mono font-black text-emerald-900 mt-1 flex items-center gap-1.5">
                    <Users className="w-5 h-5 text-emerald-600" />
                    <span>+{totalBeneficiaries.toLocaleString()}</span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-700 font-bold">{selectedMandates.length} Clusters Selected</span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 shadow-xs">
                  <span className="text-[10px] font-mono font-bold text-amber-800 uppercase">Action Mandates Ready</span>
                  <div className="text-2xl font-mono font-black text-amber-950 mt-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5 text-amber-600" />
                    <span>{selectedMandates.length} Priority</span>
                  </div>
                  <span className="text-[11px] font-mono text-amber-800 font-bold">Fast-Track Resolution Queue</span>
                </div>
              </div>

              {/* Category Comparison Pills Strip */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-base text-slate-900">Compare Priority by Issue Category</h3>
                  <span className="text-xs font-mono text-slate-500 font-bold">Filter by community demand</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'ALL', label: 'All Categories' },
                    { id: 'Road', label: 'Roads & Bridges 🛣️' },
                    { id: 'Schools', label: 'Schools & Edu 🏫' },
                    { id: 'Water', label: 'Drinking Water 🚰' },
                    { id: 'Healthcare', label: 'Healthcare 🏥' },
                    { id: 'Drainage', label: 'Urban Drainage 🌊' },
                  ].map((cat) => {
                    const isActive = categoryFilter === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategoryFilter(cat.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${
                          isActive
                            ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* High-Demand Priority Table */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-teal-600" />
                    <span>Ranked Citizen Demand Action Ledger</span>
                  </h3>
                  <span className="text-xs font-mono text-slate-500 font-bold">Check to include in Resolution Mandate</span>
                </div>

                <div className="space-y-3">
                  {dynamicHotspots.map((hs, idx) => {
                    const isSelected = selectedMandates.includes(hs.id);

                    return (
                      <div
                        key={hs.id}
                        onClick={() => toggleMandateSelection(hs.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                          isSelected
                            ? 'bg-teal-50/80 border-teal-500 ring-1 ring-teal-500/20 shadow-sm'
                            : 'bg-[#FAFAFB] hover:bg-slate-50 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500 mt-1 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 font-mono text-[10px] font-black flex items-center justify-center shrink-0">
                                #{idx + 1}
                              </span>
                              <strong className="text-sm font-extrabold text-slate-900 truncate">{hs.name}</strong>
                              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[10px] font-bold">
                                {hs.category}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-medium flex items-center gap-2 flex-wrap">
                              <span>{hs.location.blockOrTown}</span>
                              <span>•</span>
                              <span className="text-slate-800 font-bold">{hs.metrics.impactedPopulation.toLocaleString()} Impacted Pop</span>
                              <span>•</span>
                              <span className="text-teal-700 font-bold">{hs.metrics.citizenReportCount} Verified Citizen Voices</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0 self-end sm:self-center">
                          <div className="text-right font-mono">
                            <div className="text-xs font-black text-slate-900">{hs.metrics.reportGrowthVelocity}</div>
                            <div className="text-[10px] text-slate-400 uppercase">Demand Velocity</div>
                          </div>
                          <div className="text-right font-mono min-w-[54px]">
                            <div className={`text-lg font-black ${hs.dynamicScore >= 80 ? 'text-amber-600' : 'text-teal-700'}`}>
                              {hs.dynamicScore}
                            </div>
                            <div className="text-[10px] text-slate-400 uppercase">Score</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Mandate Export Bar */}
              <div className="pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <div className="text-xs font-extrabold text-slate-900">Selected Priority Action Scope:</div>
                  <div className="text-xl font-mono font-black text-teal-700 mt-0.5">{totalDemandVoices} Citizen Voices • +{totalBeneficiaries.toLocaleString()} Beneficiaries</div>
                </div>

                <button
                  disabled={selectedMandates.length === 0}
                  onClick={() => alert(`Official MP High-Priority Resolution Directive generated for ${selectedMandates.length} selected clusters benefiting ${totalBeneficiaries.toLocaleString()} citizens across Koraput PC. Forwarded to District Collectorate for immediate fast-track execution.`)}
                  className={`py-3.5 px-6 rounded-xl font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                    selectedMandates.length === 0
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white active:scale-95 shadow-teal-600/25'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>Sign & Export Official Priority Action Directive PDF</span>
                </button>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};
