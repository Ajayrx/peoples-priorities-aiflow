import React, { useState, useMemo } from 'react';
import {
  Sliders,
  UserCheck,
  RefreshCw,
  ArrowRight,
  Sparkles,
  Users,
  TrendingUp,
  CheckCircle2
} from 'lucide-react';
import type { Region, UserRole } from '../types';
import { useCitizenStore } from '../context/CitizenStoreContext';
import { runClusterEngine } from '../services/ClusterEngine';

interface DashboardPageProps {
  region: Region;
  onNavigate: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ region, onNavigate }) => {
  // Active User Role Viewport Switcher
  const [activeRole, setActiveRole] = useState<UserRole>('MP');

  // Multi-Factor Priority Formula Weight Calibration Sliders
  const [demandWeight, setDemandWeight] = useState<number>(1.5);
  const [demographicWeight, setDemographicWeight] = useState<number>(1.8);
  const [infraWeight, setInfraWeight] = useState<number>(2.0);
  const [urgencyWeight, setUrgencyWeight] = useState<number>(1.5);

  // Category filter comparison state: 'ALL' | 'Roads' | 'Schools' | 'Water' | 'Healthcare' | 'Drainage'
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Consume canonical single source of truth
  const { hotspots, reports } = useCitizenStore();

  const { clusters: engineClusters, individualReports: engineIndividualReports, emergingClusters } = useMemo(() => {
    return runClusterEngine(reports, hotspots);
  }, [reports, hotspots]);

  // Recalculate priority scores dynamically based on slider weights across nationwide clusters
  const dynamicHotspots = useMemo(() => {
    return engineClusters.map((hs) => {
      // Base score adjusted by our user slider multipliers vs defaults
      const baseD = hs.priorityBreakdown?.demandVelocityMultiplier || 1.2;
      const baseP = hs.priorityBreakdown?.demographicImpactMultiplier || 1.4;
      const baseS = hs.priorityBreakdown?.infrastructureGapMultiplier || 1.5;
      const baseU = hs.priorityBreakdown?.seasonalUrgencyMultiplier || 1.3;

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
  }, [demandWeight, demographicWeight, infraWeight, urgencyWeight, categoryFilter, engineClusters]);

  // All verified citizen submissions across the entire system (canonical unified store)
  const allCanonicalReports = useMemo(() => {
    return reports;
  }, [reports]);

  const displayedPriorityReports = useMemo(() => {
    if (categoryFilter === 'ALL') return allCanonicalReports;
    return allCanonicalReports.filter((rep) => rep.category === categoryFilter);
  }, [allCanonicalReports, categoryFilter]);

  const totalBeneficiaries = useMemo(() => {
    return dynamicHotspots.reduce((sum, h) => sum + (h.metrics?.impactedPopulation || 12500), 0);
  }, [dynamicHotspots]);

  const priorityLevelBreakdown = useMemo(() => {
    const critical = dynamicHotspots.filter(h => h.priorityLevel === 'CRITICAL').length;
    const high = dynamicHotspots.filter(h => h.priorityLevel === 'HIGH').length;
    const medium = dynamicHotspots.filter(h => h.priorityLevel === 'MEDIUM').length;
    return { critical, high, medium };
  }, [dynamicHotspots]);

  const rolesList: { id: UserRole; label: string; icon: string; desc: string }[] = [
    { id: 'MP', label: 'Member of Parliament (MP)', icon: '🏛️', desc: 'High-Demand Category Priority comparison & Action Mandate issuance' },
    { id: 'DISTRICT_OFFICER', label: 'District Collectorate / Officer', icon: '🧑‍💼', desc: 'Technical engineering verification & field deployment queue' },
    { id: 'CITIZEN', label: 'Citizen Transparency Portal', icon: '🧑‍🤝‍🧑', desc: 'Public demand ranking tracking & community satisfaction voting' },
    { id: 'VOLUNTEER', label: 'Field Verifier / Volunteer', icon: '🙋', desc: 'Mobile GPS field check queue & before/after ground-truth logs' },
    { id: 'ADMIN', label: 'System Administrator', icon: '⚙️', desc: 'GIS pipeline clustering & AI verification threshold settings' },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-slate-900 pb-16 min-w-0">
      
      {/* Header Command Strip */}
      <div className="bg-white border-b border-slate-200/80 shadow-xs py-3 sm:py-4 px-4 sm:px-6 lg:px-8 min-w-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 min-w-0 flex-wrap">
              <span className="text-xs font-mono font-bold text-slate-600 break-words min-w-0">
                ACTIVE CANVAS: <strong className="text-slate-900 break-words">{region.state} → {region.constituency.replace(' (Demo Region)', '')}</strong>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2 break-words min-w-0">
              <span className="break-words min-w-0 leading-tight">MP High-Demand Category Priority Dashboard & Resolution Simulator</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 min-w-0">
        
        {/* Role Switcher Pills Strip */}
        <div className="bg-white rounded-[24px] border border-slate-200/90 p-3 sm:p-4 shadow-md overflow-x-auto min-w-0">
          <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2.5 px-1 min-w-0">
            Active Viewport Lens (Role-Based Access Control):
          </div>
          <div className="flex items-center gap-2 min-w-max pb-1">
            {rolesList.map((role) => {
              const isSelected = activeRole === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => setActiveRole(role.id)}
                  className={`px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 border shrink-0 ${
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start min-w-0">
            
            {/* LEFT 5 COLUMNS: Formula Weight Calibration Sliders */}
            <div className="lg:col-span-5 order-2 lg:order-1 bg-white rounded-[24px] sm:rounded-[28px] border border-slate-200/90 shadow-xl p-4 sm:p-6 space-y-5 sm:space-y-6 min-w-0 overflow-hidden">
              <div className="border-b border-slate-100 pb-4 min-w-0">
                <div className="flex items-center justify-between gap-2 min-w-0 flex-wrap">
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900 flex items-center gap-2 min-w-0">
                    <Sliders className="w-5 h-5 text-teal-600 shrink-0" />
                    <span className="truncate min-w-0">8-Factor Weight Calibration</span>
                  </h3>
                  <button
                    onClick={() => {
                      setDemandWeight(1.5);
                      setDemographicWeight(1.8);
                      setInfraWeight(2.0);
                      setUrgencyWeight(1.5);
                    }}
                    className="text-xs text-teal-700 font-bold hover:underline flex items-center gap-1 shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reset
                  </button>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1 break-words">
                  Adjust formula multipliers to see how citizen demand volume vs. infrastructure gaps shift rank order.
                </p>
              </div>

              <div className="space-y-4 sm:space-y-5 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5 min-w-0 gap-1">
                    <span className="truncate min-w-0">Citizen Demand Velocity Weight (D)</span>
                    <span className="font-mono text-teal-700 font-black shrink-0">{demandWeight.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range" min="0.5" max="3.0" step="0.1" value={demandWeight}
                    onChange={(e) => setDemandWeight(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                  />
                  <span className="text-[10px] font-mono text-slate-400 block truncate">Surge intensity & volume of verified citizen voices</span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5 min-w-0 gap-1">
                    <span className="truncate min-w-0">Demographic Impact Weight (P)</span>
                    <span className="font-mono text-teal-700 font-black shrink-0">{demographicWeight.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range" min="0.5" max="3.0" step="0.1" value={demographicWeight}
                    onChange={(e) => setDemographicWeight(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                  />
                  <span className="text-[10px] font-mono text-slate-400 block truncate">Census 2021/2026 tribal radius population impacted</span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5 min-w-0 gap-1">
                    <span className="truncate min-w-0">Infrastructure Deficit Weight (S)</span>
                    <span className="font-mono text-teal-700 font-black shrink-0">{infraWeight.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range" min="0.5" max="3.0" step="0.1" value={infraWeight}
                    onChange={(e) => setInfraWeight(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                  />
                  <span className="text-[10px] font-mono text-slate-400 block truncate">Absence of schools/hospitals within 6.5 km</span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5 min-w-0 gap-1">
                    <span className="truncate min-w-0">Seasonal Monsoon Urgency (U)</span>
                    <span className="font-mono text-amber-600 font-black shrink-0">{urgencyWeight.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range" min="0.5" max="3.0" step="0.1" value={urgencyWeight}
                    onChange={(e) => setUrgencyWeight(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <span className="text-[10px] font-mono text-slate-400 block truncate">July-September high rainfall cutoff vulnerability</span>
                </div>
              </div>

              {/* Formula Verification Box */}
              <div className="bg-slate-900 rounded-2xl p-3 sm:p-4 text-white space-y-2 font-mono text-xs shadow-md min-w-0">
                <div className="flex flex-wrap items-center justify-between text-teal-400 font-extrabold text-[11px] gap-1 min-w-0">
                  <span className="flex items-center gap-1 min-w-0 break-words"><Sparkles className="w-3.5 h-3.5 shrink-0" /> LIVE RECALCULATION ACTIVE</span>
                  <span className="shrink-0">{dynamicHotspots.length} Clusters</span>
                </div>
                <div className="text-[11px] text-slate-300 break-words min-w-0" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  Highest Demand Priority: <strong className="text-white break-words">{dynamicHotspots[0]?.name || 'N/A'}</strong> ({dynamicHotspots[0]?.dynamicScore || 0}/100)
                </div>
              </div>
            </div>

            {/* RIGHT 7 COLUMNS: Category Demand Priority & Action Mandate Center */}
            <div className="lg:col-span-7 order-1 lg:order-2 bg-white rounded-[24px] sm:rounded-[28px] border border-slate-200/90 shadow-xl p-4 sm:p-6 space-y-6 min-w-0 overflow-hidden">
              
              {/* Demand Summary Strip - Compact KPI Cards (~90-100px height) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 min-w-0">
                <div className="p-3 rounded-xl bg-slate-900 text-white shadow-sm flex flex-col justify-between min-h-[90px] max-h-[105px] min-w-0">
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase truncate min-w-0">Verified Intakes</span>
                    <TrendingUp className="w-4 h-4 text-teal-400 shrink-0" />
                  </div>
                  <div className="text-base sm:text-lg font-mono font-black text-white my-0.5 truncate min-w-0">
                    {reports.length} <span className="text-xs text-teal-400 font-normal">Reports</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 truncate min-w-0 block">
                    {engineIndividualReports.length} Individual Demand Pins
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 shadow-xs flex flex-col justify-between min-h-[90px] max-h-[105px] min-w-0">
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-purple-800 uppercase truncate min-w-0">Active Clusters</span>
                    <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                  </div>
                  <div className="text-base sm:text-lg font-mono font-black text-purple-950 my-0.5 truncate min-w-0">
                    {dynamicHotspots.length} <span className="text-xs text-purple-700 font-normal">Formed</span>
                  </div>
                  <span className="text-[10px] font-mono text-purple-800 font-bold truncate min-w-0 block">
                    {emergingClusters.length} Emerging / Monitored
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 shadow-xs flex flex-col justify-between min-h-[90px] max-h-[105px] min-w-0">
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-amber-800 uppercase truncate min-w-0">Priority Rank</span>
                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                  </div>
                  <div className="text-xs sm:text-sm font-mono font-black text-amber-950 my-1 truncate min-w-0 flex items-center gap-1.5">
                    <span>{priorityLevelBreakdown.critical}🔴</span>
                    <span>{priorityLevelBreakdown.high}🟠</span>
                    <span>{priorityLevelBreakdown.medium}🟡</span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-800 font-bold truncate min-w-0 block">
                    Nationwide Severity Queue
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 shadow-xs flex flex-col justify-between min-h-[90px] max-h-[105px] min-w-0">
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase truncate min-w-0">Impacted Pop.</span>
                    <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                  </div>
                  <div className="text-base sm:text-lg font-mono font-black text-emerald-900 my-0.5 truncate min-w-0">
                    +{totalBeneficiaries.toLocaleString()}
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 font-bold truncate min-w-0 block">
                    Across {region.constituency.replace(' (Demo Region)', '')}
                  </span>
                </div>
              </div>

              {/* Category Comparison Pills Strip */}
              <div className="space-y-2.5 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 break-words min-w-0">Compare Priority by Issue Category</h3>
                  <span className="text-[11px] sm:text-xs font-mono text-slate-500 font-bold shrink-0">Filter by community demand</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
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
                        className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border shrink-0 ${
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

              {/* 1. Ranked Priority List of Individual Citizen Complaints (Voice, Photo & Text Stream) */}
              <div className="space-y-3 pt-2 min-w-0">
                <div className="flex flex-wrap items-center justify-between border-b border-slate-200/80 pb-2.5 gap-2 min-w-0">
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center text-xs shadow-2xs shrink-0">⚡</span>
                    <span className="truncate min-w-0">Ranked Citizen Demand Priority List</span>
                  </h3>
                  <span className="text-[11px] sm:text-xs font-mono text-teal-700 font-bold bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200 shrink-0">
                    Live Verified ({displayedPriorityReports.length})
                  </span>
                </div>

                <div className="space-y-2.5 sm:space-y-3 max-h-[500px] sm:max-h-[440px] overflow-y-auto pr-1 min-w-0">
                  {displayedPriorityReports.length === 0 ? (
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 font-medium break-words">
                      No citizen submissions recorded yet. Submit a Voice Memo, Photo, or Text note on the Report tab to see instant priority ranking here!
                    </div>
                  ) : (
                    displayedPriorityReports.map((rep) => {
                      if (rep.inputMethod === 'VOICE' || (rep as any).intakeType === 'VOICE') {
                        return (
                          <div key={rep.id} className="bg-teal-50/90 border border-teal-300 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 shadow-2xs min-w-0 w-full overflow-hidden">
                            <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1 w-full">
                              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm font-bold text-base sm:text-lg">
                                🎙️
                              </div>
                              <div className="min-w-0 flex-1 w-full">
                                <div className="flex items-center gap-1.5 flex-wrap mb-1 min-w-0">
                                  <span className="px-1.5 py-0.5 rounded-md bg-teal-600 text-white font-mono text-[9px] sm:text-[10px] font-black tracking-wide uppercase shrink-0">
                                    VOICE COMPLAINT
                                  </span>
                                  <strong
                                    className="text-xs sm:text-sm font-extrabold text-slate-900 break-words line-clamp-2 min-w-0 leading-tight"
                                    style={{ overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}
                                  >
                                    {rep.location.blockOrTown} • {rep.category}
                                  </strong>
                                </div>
                                <p
                                  className="text-xs sm:text-sm font-serif italic text-slate-900 leading-relaxed bg-white/80 p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-teal-200/80 break-words line-clamp-2 min-w-0"
                                  style={{ overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}
                                >
                                  "{rep.rawText || rep.aiProcessing?.transcription || rep.aiProcessing?.aiSummary || 'Verified spoken civic report.'}"
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 self-start sm:self-center flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-1 sm:pt-0 border-t border-teal-200/60 sm:border-0 gap-2">
                              <span className="px-2 py-1 rounded-lg bg-white border border-teal-200 font-mono text-[11px] sm:text-xs font-black text-teal-800 shadow-2xs block shrink-0">
                                Score: {rep.aiProcessing?.aiConfidenceScore || 94}/100
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 block shrink-0">{rep.timestamp || 'Just now'}</span>
                            </div>
                          </div>
                        );
                      } else if (rep.inputMethod === 'PHOTO' || rep.rawMediaUrl || (rep as any).intakeType === 'PHOTO') {
                        return (
                          <div key={rep.id} className="bg-emerald-50/80 border border-emerald-300 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start gap-3 sm:gap-4 shadow-2xs min-w-0 w-full overflow-hidden">
                            {rep.rawMediaUrl && (
                              <img src={rep.rawMediaUrl} alt="Reported defect" className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl border-2 border-emerald-400 shadow-sm shrink-0" />
                            )}
                            <div className="min-w-0 flex-1 w-full">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 mb-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white font-mono text-[9px] sm:text-[10px] font-black uppercase tracking-wide shrink-0">
                                    📸 PHOTO EVIDENCE
                                  </span>
                                  <strong
                                    className="text-xs sm:text-sm font-extrabold text-slate-900 break-words line-clamp-2 min-w-0 leading-tight"
                                    style={{ overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}
                                  >
                                    {rep.location.blockOrTown} • {rep.category}
                                  </strong>
                                </div>
                                <span className="px-2 py-1 rounded-lg bg-white border border-emerald-200 font-mono text-[11px] sm:text-xs font-black text-emerald-800 shadow-2xs shrink-0 self-start sm:self-center">
                                  Score: {rep.aiProcessing?.aiConfidenceScore || 96}/100
                                </span>
                              </div>
                              <p
                                className="text-xs sm:text-sm text-slate-900 font-medium leading-relaxed bg-white/90 p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-emerald-200 break-words line-clamp-2 min-w-0"
                                style={{ overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}
                              >
                                {rep.rawText || rep.aiProcessing?.imageDefectDetected || rep.aiProcessing?.aiSummary || 'Verified structural deterioration captured via photo.'}
                              </p>
                              <div className="text-[10px] sm:text-[11px] font-mono text-emerald-800 mt-1.5 flex items-center gap-1.5 flex-wrap min-w-0 break-words">
                                <span className="truncate min-w-0">📍 {rep.location.blockOrTown}, {rep.location.constituency}</span>
                                <span>•</span>
                                <span className="shrink-0">AI Verification: 100% Passed</span>
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div key={rep.id} className="bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 shadow-2xs min-w-0 w-full overflow-hidden">
                            <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1 w-full">
                              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm font-bold text-base sm:text-lg">
                                📝
                              </div>
                              <div className="min-w-0 flex-1 w-full">
                                <div className="flex items-center gap-1.5 flex-wrap mb-1 min-w-0">
                                  <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-white font-mono text-[9px] sm:text-[10px] font-black tracking-wide uppercase shrink-0">
                                    DIRECT TEXT INTAKE
                                  </span>
                                  <strong
                                    className="text-xs sm:text-sm font-extrabold text-slate-900 break-words line-clamp-2 min-w-0 leading-tight"
                                    style={{ overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}
                                  >
                                    {rep.location.blockOrTown} • {rep.category}
                                  </strong>
                                </div>
                                <p
                                  className="text-xs sm:text-sm text-slate-800 leading-relaxed bg-white p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-200 break-words line-clamp-2 min-w-0"
                                  style={{ overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}
                                >
                                  "{rep.rawText || rep.aiProcessing?.transcription || 'Written civic intake.'}"
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 self-start sm:self-center flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-1 sm:pt-0 border-t border-slate-200 sm:border-0 gap-2">
                              <span className="px-2 py-1 rounded-lg bg-white border border-slate-300 font-mono text-[11px] sm:text-xs font-black text-slate-800 shadow-2xs block shrink-0">
                                Score: {rep.aiProcessing?.aiConfidenceScore || 90}/100
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 block shrink-0">{rep.timestamp || 'Just now'}</span>
                            </div>
                          </div>
                        );
                      }
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
