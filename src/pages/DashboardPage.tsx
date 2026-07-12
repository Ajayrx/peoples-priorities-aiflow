import React, { useState, useMemo } from 'react';
import {
  Sliders,
  RefreshCw,
  ArrowRight,
  Sparkles,
  Users,
  TrendingUp,
  CheckCircle2,
  Boxes,
  ArrowLeft
} from 'lucide-react';
import type { Region, Hotspot, CitizenReport } from '../types';
import { useCitizenStore } from '../context/CitizenStoreContext';
import { runClusterEngine } from '../services/ClusterEngine';
import { getReportTimestampMs } from '../services/CitizenReportService';
import { useLanguage } from '../context/LanguageContext';

interface DashboardPageProps {
  region: Region;
  onNavigate: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ region, onNavigate }) => {
  const { t } = useLanguage();

  // Multi-Factor Priority Formula Weight Calibration Sliders
  const [demandWeight, setDemandWeight] = useState<number>(1.5);
  const [demographicWeight, setDemographicWeight] = useState<number>(1.8);
  const [infraWeight, setInfraWeight] = useState<number>(2.0);
  const [urgencyWeight, setUrgencyWeight] = useState<number>(1.5);

  // Category filter comparison state: 'ALL' | 'Roads' | 'Schools' | 'Water' | 'Healthcare' | 'Drainage'
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [showClustersView, setShowClustersView] = useState<boolean>(false);

  // Consume canonical single source of truth
  const { hotspots, reports } = useCitizenStore();

  // 1. Filter reports and hotspots by region FIRST so all downstream engine/metrics are perfectly aligned
  const { allCanonicalReports, allCanonicalHotspots } = useMemo(() => {
    const constName = region.constituency.replace(' (Demo Region)', '').replace(' PC', '').trim().toLowerCase();
    const distName = region.district.replace(' District', '').trim().toLowerCase();
    const isAll = region.isAllIndia || region.state === 'All India' || region.constituency === 'All India' || region.constituency === 'All India View' || region.constituency.includes('All India');

    const filteredReports = reports.filter((rep) => {
      return isAll
        ? true
        : (rep.location?.constituency && rep.location.constituency.toLowerCase().includes(constName)) ||
          (rep.location?.district && rep.location.district.toLowerCase().includes(distName)) ||
          (rep.address || rep.location?.blockOrTown || '').toLowerCase().includes(constName) ||
          (rep.address || rep.location?.blockOrTown || '').toLowerCase().includes(distName) ||
          (region.constituency.includes('Koraput') && (rep.address || rep.location?.blockOrTown || '').toLowerCase().includes('semiliguda'));
    });

    const filteredHotspots = hotspots.filter((hs) => {
      return isAll
        ? true
        : hs.name.toLowerCase().includes(constName) ||
          hs.location.blockOrTown.toLowerCase().includes(constName) ||
          hs.location.blockOrTown.toLowerCase().includes(distName) ||
          ((hs.location as any).district && (hs.location as any).district.toLowerCase().includes(distName)) ||
          ((hs.location as any).constituency && (hs.location as any).constituency.toLowerCase().includes(constName)) ||
          (region.constituency.includes('Koraput') && hs.name.toLowerCase().includes('semiliguda'));
    });

    return { allCanonicalReports: filteredReports, allCanonicalHotspots: filteredHotspots };
  }, [reports, hotspots, region]);

  // 2. Run Cluster Engine solely on the active region's data
  const { clusters: engineClusters, individualReports: engineIndividualReports, emergingClusters } = useMemo(() => {
    return runClusterEngine(allCanonicalReports, allCanonicalHotspots);
  }, [allCanonicalReports, allCanonicalHotspots]);

  // 3. Recalculate priority scores dynamically based on slider weights and category filter
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

  const displayedPriorityReports = useMemo(() => {
    const filtered = categoryFilter === 'ALL'
      ? allCanonicalReports
      : allCanonicalReports.filter((rep) => rep.category === categoryFilter);

    return [...filtered].sort((a, b) => {
      const timeA = getReportTimestampMs(a);
      const timeB = getReportTimestampMs(b);
      if (timeB !== timeA) return timeB - timeA;
      return (b.priorityScore || b.aiConfidence || 90) - (a.priorityScore || a.aiConfidence || 90);
    });
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

  const renderClusterCard = (hs: Hotspot) => {
    const priorityText = hs.priorityLevel === 'CRITICAL'
      ? 'Critical Priority'
      : hs.priorityLevel === 'HIGH'
      ? 'High Priority'
      : hs.priorityLevel === 'MEDIUM'
      ? 'Medium Priority'
      : 'Low Priority';

    const priorityBadgeColor = hs.priorityLevel === 'CRITICAL'
      ? 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold'
      : hs.priorityLevel === 'HIGH'
      ? 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold'
      : hs.priorityLevel === 'MEDIUM'
      ? 'bg-blue-100 text-blue-800 border-blue-300 font-bold'
      : 'bg-slate-100 text-slate-800 border-slate-300 font-bold';

    const reportCount = hs.metrics?.citizenReportCount || hs.recentReports?.length || 0;
    const summary = hs.aiSynthesis?.reasoning || hs.aiSynthesis?.headline || hs.name || 'Recurring civic demand in this area';

    return (
      <div
        key={hs.id}
        className="bg-white border-2 border-teal-500/80 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm hover:shadow-md transition-all min-w-0 w-full overflow-hidden"
      >
        <div className="flex items-start gap-3 min-w-0 flex-1 w-full">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 font-bold shadow-xs">
            <Boxes className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1 w-full space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="px-1.5 py-0.5 rounded-md bg-teal-800 text-white font-mono text-[9px] sm:text-[10px] font-black tracking-wide uppercase shrink-0">
                  📦 DEMAND CLUSTER
                </span>
                <span className="font-extrabold text-sm sm:text-base text-slate-900 truncate min-w-0">
                  {hs.category}
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] border uppercase tracking-wide shrink-0 ${priorityBadgeColor}`}>
                {priorityText}
              </span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-700 truncate min-w-0">
              📍 {hs.location.blockOrTown || hs.name}
            </div>
            <div className="text-xs font-mono font-extrabold text-teal-700 bg-teal-50/80 px-2 py-0.5 rounded-md inline-block border border-teal-200/60">
              {reportCount} grouped citizen reports
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed pt-0.5 break-words line-clamp-2">
              {summary}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 self-start sm:self-center flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t border-slate-100 sm:border-0 gap-1.5">
          <span className="px-2.5 py-1 rounded-xl bg-slate-900 text-white font-mono text-xs font-black shadow-2xs block shrink-0">
            Score: {hs.dynamicScore || hs.priorityScore}/100
          </span>
        </div>
      </div>
    );
  };

  const renderReportCard = (rep: CitizenReport) => {
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
              <div className="text-[10px] sm:text-[11px] font-mono text-slate-500 mt-1.5 flex items-center justify-between gap-2 flex-wrap">
                <span>📍 {rep.location.blockOrTown}, {rep.location.constituency}</span>
                <span className="font-bold text-teal-800">🕒 {rep.timestamp || 'Sat, 11 Jul • 11:45 AM'}</span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0 self-start sm:self-center flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-1 sm:pt-0 border-t border-teal-200/60 sm:border-0 gap-2">
            <span className="px-2 py-1 rounded-lg bg-white border border-teal-200 font-mono text-[11px] sm:text-xs font-black text-teal-800 shadow-2xs block shrink-0">
              Score: {rep.aiProcessing?.aiConfidenceScore || 94}/100
            </span>
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
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-700 text-white font-mono text-[9px] sm:text-[10px] font-black tracking-wide uppercase shrink-0">
                  📸 PHOTO EVIDENCE
                </span>
                <strong
                  className="text-xs sm:text-sm font-extrabold text-slate-900 break-words line-clamp-1 min-w-0"
                  style={{ overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}
                >
                  {rep.location.blockOrTown} • {rep.category}
                </strong>
              </div>
            </div>
            <p
              className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium bg-white/80 p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-emerald-200/80 break-words line-clamp-2 min-w-0 mt-1"
              style={{ overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}
            >
              {rep.urgencyReasoning || rep.description || rep.rawText || 'Visual citizen complaint submitted.'}
            </p>
            <div className="text-[10px] sm:text-[11px] font-mono text-slate-500 mt-1.5 flex items-center justify-between gap-2 flex-wrap">
              <span>📍 {rep.location.blockOrTown}, {rep.location.constituency}</span>
              <span className="font-bold text-slate-700">🕒 {rep.timestamp || 'Sat, 11 Jul • 11:45 AM'}</span>
            </div>
          </div>
          <div className="text-right shrink-0 self-start sm:self-center flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-1 sm:pt-0 border-t border-slate-200 sm:border-0 gap-2">
            <span className="px-2 py-1 rounded-lg bg-white border border-slate-300 font-mono text-[11px] sm:text-xs font-black text-slate-800 shadow-2xs block shrink-0">
              Score: {rep.aiProcessing?.aiConfidenceScore || 93}/100
            </span>
          </div>
        </div>
      );
    } else {
      return (
        <div key={rep.id} className="bg-slate-50 border border-slate-200/80 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 shadow-2xs min-w-0 w-full overflow-hidden">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1 w-full">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-2xs font-bold text-base sm:text-lg">
              📝
            </div>
            <div className="min-w-0 flex-1 w-full">
              <div className="flex items-center gap-1.5 flex-wrap mb-1 min-w-0">
                <span className="px-1.5 py-0.5 rounded-md bg-slate-700 text-white font-mono text-[9px] sm:text-[10px] font-black tracking-wide uppercase shrink-0">
                  TEXT INTAKE
                </span>
                <strong
                  className="text-xs sm:text-sm font-extrabold text-slate-900 break-words line-clamp-1 min-w-0"
                  style={{ overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}
                >
                  {rep.location.blockOrTown} • {rep.category}
                </strong>
              </div>
              <p
                className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium bg-white/80 p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-200/80 break-words line-clamp-2 min-w-0"
                style={{ overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}
              >
                "{rep.rawText || rep.aiProcessing?.transcription || 'Written civic intake.'}"
              </p>
              <div className="text-[10px] sm:text-[11px] font-mono text-slate-500 mt-1.5 flex items-center justify-between gap-2 flex-wrap">
                <span>📍 {rep.location.blockOrTown}, {rep.location.constituency}</span>
                <span className="font-bold text-slate-700">🕒 {rep.timestamp || 'Sat, 11 Jul • 11:45 AM'}</span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0 self-start sm:self-center flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-1 sm:pt-0 border-t border-slate-200 sm:border-0 gap-2">
            <span className="px-2 py-1 rounded-lg bg-white border border-slate-300 font-mono text-[11px] sm:text-xs font-black text-slate-800 shadow-2xs block shrink-0">
              Score: {rep.aiProcessing?.aiConfidenceScore || 90}/100
            </span>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-slate-900 pb-16 min-w-0">
      
      {/* Header Command Strip */}
      <div className="bg-white border-b border-slate-200/80 shadow-xs py-3 sm:py-4 px-4 sm:px-6 lg:px-8 min-w-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 min-w-0 flex-wrap">
              <span className="text-xs font-mono font-bold text-slate-600 break-words min-w-0">
                {t('explore.canvas')}: <strong className="text-slate-900 break-words">{region.state} → {region.constituency.replace(' (Demo Region)', '')}</strong>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2 break-words min-w-0">
              <span className="break-words min-w-0 leading-tight">{t('dashboard.title')}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
            <button
              onClick={() => onNavigate('explore')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm transition-all shadow-sm shadow-teal-600/20 active:scale-95"
            >
              <span>{t('dashboard.switchmap')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 min-w-0">
        
        {/* ROLE SPECIFIC VIEWPORT RENDER */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start min-w-0">
          
          {/* LEFT 5 COLUMNS: Formula Weight Calibration Sliders */}
            <div className="lg:col-span-5 order-2 lg:order-1 bg-white rounded-[24px] sm:rounded-[28px] border border-slate-200/90 shadow-xl p-4 sm:p-6 space-y-5 sm:space-y-6 min-w-0 overflow-hidden">
              <div className="border-b border-slate-100 pb-4 min-w-0">
                <div className="flex items-center justify-between gap-2 min-w-0 flex-wrap">
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900 flex items-center gap-2 min-w-0">
                    <Sliders className="w-5 h-5 text-teal-600 shrink-0" />
                    <span className="truncate min-w-0">{t('dashboard.weights.title')}</span>
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
                    <RefreshCw className="w-3.5 h-3.5" /> {t('dashboard.weights.reset')}
                  </button>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1 break-words">
                  {t('dashboard.weights.desc')}
                </p>
              </div>

              <div className="space-y-4 sm:space-y-5 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5 min-w-0 gap-1">
                    <span className="truncate min-w-0">{t('dashboard.weights.demand')}</span>
                    <span className="font-mono text-teal-700 font-black shrink-0">{demandWeight.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range" min="0.5" max="3.0" step="0.1" value={demandWeight}
                    onChange={(e) => setDemandWeight(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                  />
                  <span className="text-[10px] font-mono text-slate-400 block truncate">
                    {t('nav.home') === 'Home' ? 'Surge intensity & volume of verified citizen voices' : t('nav.home') === 'होम' ? 'सत्यापित नागरिक आवाजों की तीव्रता और संख्या' : t('nav.home') === 'ହୋମ' ? 'ଯାଞ୍ଚ ହୋଇଥିବା ନାଗରିକ ସ୍ୱରର ତୀବ୍ରତା ଏବଂ ପରିମାଣ' : 'ధృవీకరించబడిన పౌరుల గళాల తీవ్రత మరియు పరిమాణం'}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5 min-w-0 gap-1">
                    <span className="truncate min-w-0">{t('dashboard.weights.demographic')}</span>
                    <span className="font-mono text-teal-700 font-black shrink-0">{demographicWeight.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range" min="0.5" max="3.0" step="0.1" value={demographicWeight}
                    onChange={(e) => setDemographicWeight(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                  />
                  <span className="text-[10px] font-mono text-slate-400 block truncate">
                    {t('nav.home') === 'Home' ? 'Census 2021/2026 tribal radius population impacted' : t('nav.home') === 'होम' ? 'जनगणना 2021/2026 जनजातीय त्रिज्या प्रभावित आबादी' : t('nav.home') === 'ହୋମ' ? 'ଜନଗଣନା ୨୦୨୧/୨୦୨୬ ଆଦିବାସୀ ବ୍ୟାସାର୍ଦ୍ଧ ଜନସଂଖ୍ୟା ପ୍ରଭାବିତ' : 'జనాభా గణన 2021/2026 గిరిజన ప్రాంత ప్రభావిత జనాభా'}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5 min-w-0 gap-1">
                    <span className="truncate min-w-0">{t('dashboard.weights.infra')}</span>
                    <span className="font-mono text-teal-700 font-black shrink-0">{infraWeight.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range" min="0.5" max="3.0" step="0.1" value={infraWeight}
                    onChange={(e) => setInfraWeight(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                  />
                  <span className="text-[10px] font-mono text-slate-400 block truncate">
                    {t('nav.home') === 'Home' ? 'Absence of schools/hospitals within 6.5 km' : t('nav.home') === 'होम' ? '6.5 किमी के भीतर स्कूलों/अस्पतालों की अनुपस्थिति' : t('nav.home') === 'ହୋମ' ? '୬.୫ କିଲୋମିଟର ମଧ୍ୟରେ ବିଦ୍ୟାଳୟ/ଡାକ୍ତରଖାନାର ଅନୁପସ୍ଥିତି' : '6.5 కిలోమీటర్ల పరిధిలో పాఠశాలలు/ఆసుపత్రుల లేమి'}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5 min-w-0 gap-1">
                    <span className="truncate min-w-0">{t('dashboard.weights.urgency')}</span>
                    <span className="font-mono text-amber-600 font-black shrink-0">{urgencyWeight.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range" min="0.5" max="3.0" step="0.1" value={urgencyWeight}
                    onChange={(e) => setUrgencyWeight(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <span className="text-[10px] font-mono text-slate-400 block truncate">
                    {t('nav.home') === 'Home' ? 'July-September high rainfall cutoff vulnerability' : t('nav.home') === 'होम' ? 'जुलाई-सितंबर उच्च वर्षा कटऑफ संवेदनशीलता' : t('nav.home') === 'ହୋମ' ? 'ଜୁଲାଇ-ସେପ୍ଟେମ୍ବର ଅଧିକ ବର୍ଷା ଜନିତ ବିପଦ' : 'జూలై-సెప్టెంబర్ భారీ వర్షపాత దుర్బలత్వం'}
                  </span>
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
                    {allCanonicalReports.length} <span className="text-xs text-teal-400 font-normal">Reports</span>
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
                    <span className="truncate min-w-0">{showClustersView ? 'Demand Cluster List' : 'Ranked Citizen Demand Priority List'}</span>
                  </h3>
                  <div className="flex items-center gap-2 shrink-0">
                    {!showClustersView ? (
                      <button
                        onClick={() => setShowClustersView(true)}
                        className="px-2.5 sm:px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
                      >
                        <Boxes className="w-3.5 h-3.5 shrink-0" />
                        <span>View Clusters</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowClustersView(false)}
                        className="px-2.5 sm:px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                        <span>Back to Priority List</span>
                      </button>
                    )}
                    <span className="text-[11px] sm:text-[11px] font-mono text-teal-700 font-bold bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200 shrink-0">
                      {showClustersView ? `Clusters (${dynamicHotspots.length})` : `All Demand (${dynamicHotspots.length + displayedPriorityReports.length})`}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5 sm:space-y-3 max-h-[500px] sm:max-h-[440px] overflow-y-auto pr-1 min-w-0">
                  {showClustersView ? (
                    dynamicHotspots.length === 0 ? (
                      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 font-medium break-words">
                        No demand clusters available currently for the selected filters.
                      </div>
                    ) : (
                      dynamicHotspots.map(renderClusterCard)
                    )
                  ) : (
                    dynamicHotspots.length === 0 && displayedPriorityReports.length === 0 ? (
                      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 font-medium break-words">
                        No citizen submissions recorded yet. Submit a Voice Memo, Photo, or Text note on the Report tab to see instant priority ranking here!
                      </div>
                    ) : (
                      <>
                        {/* 1. Demand Clusters at the TOP of the Ranked Citizen Demand Priority List */}
                        {dynamicHotspots.length > 0 && (
                          <div className="space-y-2.5 min-w-0">
                            {dynamicHotspots.map(renderClusterCard)}
                          </div>
                        )}

                        {/* 2. Individual Citizen Complaints below Clusters */}
                        {displayedPriorityReports.length > 0 && (
                          <div className="space-y-2.5 pt-1 min-w-0">
                            {dynamicHotspots.length > 0 && (
                              <div className="flex items-center gap-2 pt-1 pb-0.5 min-w-0">
                                <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                                  Individual Citizen Submissions ({displayedPriorityReports.length})
                                </span>
                                <div className="h-px bg-slate-200 flex-1" />
                              </div>
                            )}
                            {displayedPriorityReports.map(renderReportCard)}
                          </div>
                        )}
                      </>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};
