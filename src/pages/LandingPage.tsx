import { useState } from 'react';
import { 
  MapPin, 
  ArrowRight, 
  Mic, 
  TrendingUp, 
  ShieldCheck, 
  BarChart3, 
  Activity,
  CheckCircle2
} from 'lucide-react';
import { useCitizenStore } from '../context/CitizenStoreContext';
import { runClusterEngine } from '../services/ClusterEngine';
import type { Region } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface LandingPageProps {
  onNavigate: (tab: string) => void;
  region: Region;
  onResetToDemoRegion: () => void;
}

import { useMemo } from 'react';

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, region, onResetToDemoRegion: _onResetToDemoRegion }) => {
  const { t } = useLanguage();
  const { hotspots: storeHotspots, reports } = useCitizenStore();

  // Filter reports and hotspots by current region so the Hero Radar updates when the navbar region switches
  const filteredReports = useMemo(() => {
    const constName = region.constituency.replace(' (Demo Region)', '').replace(' PC', '').trim().toLowerCase();
    const distName = region.district.replace(' District', '').trim().toLowerCase();
    const isAll = region.isAllIndia || region.state === 'All India' || region.constituency === 'All India' || region.constituency === 'All India View' || region.constituency.includes('All India');

    return reports.filter((rep) => {
      return isAll
        ? true
        : (rep.location?.constituency && rep.location.constituency.toLowerCase().includes(constName)) ||
          (rep.location?.district && rep.location.district.toLowerCase().includes(distName)) ||
          (rep.address || rep.location?.blockOrTown || '').toLowerCase().includes(constName) ||
          (rep.address || rep.location?.blockOrTown || '').toLowerCase().includes(distName) ||
          (region.constituency.includes('Koraput') && (rep.address || rep.location?.blockOrTown || '').toLowerCase().includes('semiliguda'));
    });
  }, [reports, region]);

  const filteredHotspots = useMemo(() => {
    const constName = region.constituency.replace(' (Demo Region)', '').replace(' PC', '').trim().toLowerCase();
    const isAll = region.isAllIndia || region.state === 'All India' || region.constituency === 'All India' || region.constituency === 'All India View' || region.constituency.includes('All India');

    return storeHotspots.filter((hs) => {
      return isAll
        ? true
        : ((hs.location as any).constituency && (hs.location as any).constituency.toLowerCase().includes(constName)) ||
          (region.constituency.includes('Koraput') && hs.name.toLowerCase().includes('semiliguda'));
    });
  }, [storeHotspots, region]);

  const { clusters, individualReports } = useMemo(() => {
    return runClusterEngine(filteredReports, filteredHotspots);
  }, [filteredReports, filteredHotspots]);

  // UI layout spec: Grid has 9 slots total. Up to 6 are occupied by clusters (hotspots).
  // The remaining slots (at least 3, up to 9 if no clusters are available) are occupied by individual complaints.
  const heroGridItems = useMemo(() => {
    const selectedClusters = clusters.slice(0, 6);
    const remainingSlots = Math.max(0, 6 - selectedClusters.length);
    const selectedComplaints = individualReports.slice(0, remainingSlots);

    return [
      ...selectedClusters.map((c) => ({
        id: c.id,
        isCluster: true,
        raw: c,
        name: c.name,
        category: c.category,
        priorityLevel: c.priorityLevel,
        priorityScore: c.priorityScore,
        locationName: c.location.blockOrTown || 'Clustered Area',
        description: c.aiSynthesis?.reasoning || 'AI spatial analysis active.',
        population: c.metrics?.impactedPopulation || 12500,
        details: `${c.metrics?.nearbySchoolsCount ?? 0} Schools / 0 PHC`,
        reportCount: c.metrics?.citizenReportCount || c.recentReports?.length || 1,
      })),
      ...selectedComplaints.map((r) => ({
        id: r.id,
        isCluster: false,
        raw: r,
        name: r.title || r.detectedIssue || 'Citizen Complaint',
        category: r.category,
        priorityLevel: r.priority || r.priorityLevel || 'HIGH',
        priorityScore: r.priorityScore || r.aiConfidence || 94,
        locationName: r.location?.blockOrTown || r.address || 'Verified Pin',
        description: r.description || r.urgencyReasoning || 'Citizen reported defect under review.',
        population: 380,
        details: 'Individual Monitored Pin',
        reportCount: 1,
        timestamp: r.timestamp || 'Sat, 11 Jul • 11:45 AM',
      })),
    ];
  }, [clusters, individualReports]);

  // Keep track of active item index/id
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const activeItem = useMemo(() => {
    return heroGridItems.find(item => item.id === activeItemId) || heroGridItems[0] || null;
  }, [heroGridItems, activeItemId]);

  const cleanConstituencyName = region.constituency.replace(' (Demo Region)', '');
  const displayConstituencyTitle = cleanConstituencyName.includes('PC')
    ? cleanConstituencyName.replace(' PC', ' Parliamentary Constituency')
    : `${cleanConstituencyName} Parliamentary Constituency`;

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-slate-900 overflow-x-hidden pb-12 sm:pb-8">
      {/* Layer 2: Edge-to-Edge Full Screen Live Status Bar — Running across left to right above Hero */}
      <div className="w-full relative z-30 overflow-hidden bg-[rgba(255,255,255,0.88)] backdrop-blur-[20px] border-y border-slate-200/80 shadow-[0_4px_16px_rgba(15,23,42,0.05)] py-2.5 sm:py-3 px-4 select-none mb-0">
        <div className="flex gap-8 sm:gap-10 items-center whitespace-nowrap animate-marquee font-mono text-xs font-bold tracking-wider text-slate-800">
          <span className="flex items-center gap-2 font-semibold text-slate-800">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse shrink-0" />
            Government Geo Data
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
          <span className="flex items-center gap-2 font-semibold text-slate-800">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-pulse shrink-0" />
            Gemini 3.1 Pro AI
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
          <span className="flex items-center gap-2 font-semibold text-slate-800">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse shrink-0" />
            Census Integration
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
          <span className="flex items-center gap-2 font-semibold text-slate-800">
            <span className="inline-block w-2 h-2 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.8)] animate-pulse shrink-0" />
            8-Factor Priority Engine (Demand × Severity × Population × Growth × Urgency × Cost × Risk × Equity Φ)
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
          <span className="flex items-center gap-2 font-semibold text-slate-800">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse shrink-0" />
            MP LAD Fund Optimization
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
          <span className="flex items-center gap-2 font-semibold text-slate-800">
            <span className="inline-block w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-pulse shrink-0" />
            Fraud Detection
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
          <span className="flex items-center gap-2 font-semibold text-slate-800">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse shrink-0" />
            Government Geo Data
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
          <span className="flex items-center gap-2 font-semibold text-slate-800">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-pulse shrink-0" />
            Gemini 3.1 Pro AI
          </span>
        </div>
      </div>

      {/* Hero Section — Off-White / Cream, Teal, Green, Grey, Amber Palette */}
      <section className="relative pt-4 sm:pt-6 pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center">
          {/* Left Hero Copy */}
          <div className="lg:col-span-6 space-y-5 sm:space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200/80 text-slate-700 text-xs font-bold tracking-wider shadow-xs">
              <Activity className="w-3.5 h-3.5 text-teal-600 animate-pulse shrink-0" />
              <span>{t('landing.activeTarget')}: {region.state} → {region.constituency.replace(' (Demo Region)', '')}</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.08]">
              {t('landing.hero1')} <br />
              <span className="bg-gradient-to-r from-teal-700 via-emerald-600 to-teal-800 bg-clip-text text-transparent">
                {t('landing.hero2')}
              </span>
            </h1>

            <p className="text-sm sm:text-lg text-slate-600 leading-relaxed max-w-xl font-medium">
              {t('landing.subtitle')}
            </p>


            {/* Core Action CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2">
              <button
                onClick={() => onNavigate('explore')}
                className="group flex items-center justify-center gap-3 px-6 sm:px-7 py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-teal-600/25 hover:scale-105 transition-all duration-200"
              >
                <MapPin className="w-5 h-5 text-teal-100 group-hover:animate-bounce" />
                {t('landing.cta.explore')}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => onNavigate('report')}
                className="flex items-center justify-center gap-2.5 px-6 py-3.5 sm:py-4 rounded-full bg-white border border-slate-300 text-slate-800 font-bold text-sm sm:text-base hover:bg-slate-50 hover:border-teal-600 transition-all duration-200 shadow-sm"
              >
                <Mic className="w-5 h-5 text-teal-600" />
                {t('landing.cta.report')}
              </button>
            </div>

          </div>

          {/* Right Hero Interactive Radar Preview — Fully Converted to Clean Light/White Studio Theme! */}
          <div className="lg:col-span-6 relative mt-4 lg:mt-0">
            <div className="absolute -inset-1 bg-gradient-to-r from-teal-500/15 via-emerald-500/15 to-amber-500/15 rounded-3xl blur-2xl animate-pulse" />
            
            <div className="relative rounded-3xl bg-white text-slate-900 border border-slate-200/90 overflow-hidden shadow-2xl">
              {/* Map Canvas Header Bar — Light Grey / Off-White */}
              <div className="bg-slate-100 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider">
                    {t('landing.heroRadar')} — {region.constituency.replace(' (Demo Region)', '')}
                  </span>
                </div>
                <span className="text-[10px] sm:text-xs px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-mono font-bold shrink-0">
                  {clusters.length} {t('landing.clusters')} • {individualReports.length} {t('landing.pinsActive')}
                </span>
              </div>

              {/* Light Cartographic Map Visualizer Canvas */}
              <div className="relative min-h-[460px] sm:h-[440px] h-auto bg-[#F8F9FA] overflow-visible sm:overflow-hidden p-4 sm:p-6 flex flex-col justify-between gap-4">
                {/* Subtle Cartographic Grid Background on Cream/Off-White */}
                <div 
                  className="absolute inset-0 opacity-30 pointer-events-none rounded-b-3xl"
                  style={{
                    backgroundImage: 'radial-gradient(#0D9488 1px, transparent 1px)',
                    backgroundSize: '28px 28px'
                  }}
                />

                {/* Hotspot & Cluster Radar Pins Grid */}
                <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 w-full">
                  {heroGridItems.map((item) => {
                    const isSelected = activeItem?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveItemId(item.id)}
                        className={`text-left p-3 sm:p-3.5 rounded-2xl transition-all duration-200 border flex flex-col justify-between ${
                          item.isCluster
                            ? isSelected
                              ? 'bg-white border-teal-600 shadow-xl shadow-teal-600/10 scale-[1.03] ring-2 ring-teal-500/20'
                              : 'bg-white/90 border-slate-200/80 hover:bg-white hover:border-slate-300'
                            : isSelected
                              ? 'bg-white border-purple-600 shadow-xl shadow-purple-600/10 scale-[1.03] ring-2 ring-purple-500/20'
                              : 'bg-purple-50/70 border-purple-200/50 hover:bg-purple-50 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1.5 w-full">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-extrabold truncate ${
                            item.isCluster
                              ? item.priorityLevel === 'CRITICAL' ? 'bg-amber-50 text-amber-800 border border-amber-300' :
                                item.priorityLevel === 'HIGH' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' :
                                'bg-teal-50 text-teal-800 border border-teal-300'
                              : 'bg-purple-100 text-purple-900 border border-purple-255'
                          }`}>
                            {item.isCluster ? `${t('landing.score')} ${item.priorityScore}` : t('landing.individualPin')}
                          </span>
                          {item.priorityLevel === 'CRITICAL' && item.isCluster && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                          )}
                        </div>
                        <div className={`font-extrabold text-xs sm:text-sm truncate w-full ${item.isCluster ? 'text-slate-900' : 'text-purple-950'}`}>
                          {item.locationName}
                        </div>
                        <div className={`text-[10px] sm:text-[11px] truncate mt-0.5 font-medium w-full ${item.isCluster ? 'text-slate-500' : 'text-purple-700'}`}>
                          {t(`cat.${item.category.toLowerCase()}`)} • {item.isCluster ? `${item.reportCount} ${t('landing.reports')}` : t('landing.monitoredDemand')}
                        </div>
                      </button>
                    );
                  })}
                  {heroGridItems.length === 0 && (
                    <div className="col-span-1 sm:col-span-3 p-6 rounded-2xl bg-white/90 border border-slate-200 text-center space-y-2">
                      <div className="text-sm font-extrabold text-slate-800">
                        {t('landing.noClusters')} {region.constituency.replace(' (Demo Region)', '')} yet
                      </div>
                      <p className="text-xs text-slate-600 font-medium">
                        {t('landing.noClustersDesc')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Selected Item (Hotspot/Complaint) Intelligence Briefing Card */}
                {activeItem && (
                  <div className="relative z-20 mt-auto bg-white/95 backdrop-blur-2xl border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xl animate-scaleUp">
                    <div className="flex items-start sm:items-center justify-between gap-2.5 mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${activeItem.isCluster ? 'bg-teal-600 animate-pulse' : 'bg-purple-600'}`} />
                        <h4 className={`font-extrabold text-sm sm:text-base truncate ${activeItem.isCluster ? 'text-slate-900' : 'text-purple-950'}`}>
                          {activeItem.name}
                        </h4>
                      </div>
                      <span className={`text-[11px] sm:text-xs font-mono font-extrabold shrink-0 px-2.5 py-0.5 rounded-full border whitespace-nowrap inline-flex items-center ${
                        activeItem.isCluster
                          ? activeItem.priorityLevel === 'CRITICAL' ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-xs' :
                            activeItem.priorityLevel === 'HIGH' ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs' :
                            'bg-teal-50 text-teal-800 border-teal-300 shadow-xs'
                          : 'bg-purple-100 text-purple-900 border-purple-200 shadow-xs'
                      }`}>
                        {activeItem.priorityLevel}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 mb-2 line-clamp-2 leading-relaxed font-medium">
                      {activeItem.description}
                    </p>
                    {!activeItem.isCluster && (activeItem as any).timestamp && (
                      <div className="text-[11px] font-mono font-bold text-purple-900 mb-2 flex items-center gap-1.5">
                        🕒 {(activeItem as any).timestamp}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs font-mono text-slate-500 border-t border-slate-200/80 pt-2.5 flex-wrap gap-2">
                      <span className="font-semibold">Pop: {activeItem.population.toLocaleString()}</span>
                      <span className="font-semibold">Details: {activeItem.details}</span>
                      <button
                        onClick={() => onNavigate('explore')}
                        className="text-teal-700 hover:text-teal-900 hover:underline font-sans font-bold flex items-center gap-1 ml-auto"
                      >
                        {t('landing.deepAnalysis')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Step Civic Intelligence Pipeline Architecture Explainer — Off-White / Cream Cards with Teal / Green / Amber */}
      <section className="py-14 sm:py-20 bg-white border-t border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 shadow-xs">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">
              {t('landing.howitworks')}
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
              {t('landing.howitworks.desc')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Step 1 — Deep Turquoise / Teal */}
            <div className="bg-[#FAFAFB] rounded-3xl p-6 sm:p-8 border border-slate-200/80 relative group hover:border-teal-500/60 transition-all duration-300 shadow-sm hover:shadow-md">
              <div className="w-14 h-14 rounded-2xl bg-teal-600/10 border border-teal-600/30 flex items-center justify-center mb-6 text-teal-700">
                <Mic className="w-7 h-7" />
              </div>
              <div className="absolute top-6 right-6 text-3xl font-mono font-extrabold text-slate-300 group-hover:text-teal-600/30 transition-colors">
                01
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-2.5">{t('landing.step1.title')}</h3>
              <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed font-medium">
                {t('landing.step1.desc')}
              </p>
              <div className="inline-flex items-center gap-2 text-xs font-mono text-teal-800 bg-teal-50 px-3.5 py-1.5 rounded-full border border-teal-200 font-bold">
                <ShieldCheck className="w-4 h-4 shrink-0 text-teal-600" /> {t('landing.step1.badge')}
              </div>
            </div>

            {/* Step 2 — Emerald Green */}
            <div className="bg-[#FAFAFB] rounded-3xl p-6 sm:p-8 border border-slate-200/80 relative group hover:border-emerald-500/60 transition-all duration-300 shadow-sm hover:shadow-md">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 border border-emerald-600/30 flex items-center justify-center mb-6 text-emerald-700">
                <BarChart3 className="w-7 h-7" />
              </div>
              <div className="absolute top-6 right-6 text-3xl font-mono font-extrabold text-slate-300 group-hover:text-emerald-600/30 transition-colors">
                02
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-2.5">{t('landing.step2.title')}</h3>
              <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed font-medium">
                {t('landing.step2.desc')}
              </p>
              <div className="inline-flex text-xs font-mono text-emerald-800 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200 font-bold overflow-x-auto">
                {t('landing.step2.badge')}
              </div>
            </div>

            {/* Step 3 — Warm Amber / Yellow */}
            <div className="bg-[#FAFAFB] rounded-3xl p-6 sm:p-8 border border-slate-200/80 relative group hover:border-amber-500/60 transition-all duration-300 shadow-sm hover:shadow-md">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-6 text-amber-700">
                <TrendingUp className="w-7 h-7" />
              </div>
              <div className="absolute top-6 right-6 text-3xl font-mono font-extrabold text-slate-300 group-hover:text-amber-500/30 transition-colors">
                03
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-2.5">{t('landing.step3.title')}</h3>
              <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed font-medium">
                {t('landing.step3.desc')}
              </p>
              <div className="inline-flex items-center gap-2 text-xs font-mono text-amber-900 bg-amber-50 px-3.5 py-1.5 rounded-full border border-amber-200 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-600" /> {t('landing.step3.badge')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA — Cream / White Theme */}
      <footer className="py-14 px-4 text-center max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center space-y-5">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{t('landing.footer.title')} {displayConstituencyTitle}?</h3>
          <p className="text-slate-600 text-sm max-w-md font-medium">
            {t('landing.footer.desc')}
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2 w-full sm:w-auto max-w-xs sm:max-w-none mx-auto">
            <button
              onClick={() => onNavigate('explore')}
              className="px-8 py-3.5 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold transition-colors shadow-xl shadow-teal-600/20 text-sm"
            >
              {t('landing.footer.btn1')}
            </button>
            <button
              onClick={() => onNavigate('dashboard')}
              className="px-8 py-3.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors shadow-md text-sm"
            >
              {t('landing.footer.btn2')}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
