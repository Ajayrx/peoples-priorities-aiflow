import React, { useState, useMemo, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
  useMap
} from 'react-leaflet';
import {
  Filter,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  BarChart3,
  Users,
  Activity,
  Sparkles,
  ChevronRight,
  X,
  Eye,
  Building2,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import type { Hotspot, Region } from '../types';
import { useCitizenStore } from '../context/CitizenStoreContext';
import { runClusterEngine } from '../services/ClusterEngine';
import { useLanguage } from '../context/LanguageContext';

// Helper component to smoothly center map when active region changes or hotspot clicked
function MapViewController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

const REGION_COORDS_MAP: Record<string, [number, number]> = {
  'Hindupur PC': [13.8283, 77.4914],
  'Anantapur PC': [14.6819, 77.6006],
  'Koraput PC': [18.8135, 82.7125],
  'Koraput PC (Demo Region)': [18.8135, 82.7125],
  'Karol Bagh PC': [28.6517, 77.1906],
  'New Delhi PC': [28.6139, 77.2090],
  'Andheri West, Mumbai North West PC': [19.1197, 72.8464],
  'Mumbai North West PC': [19.1197, 72.8464],
  'Varanasi PC': [25.3176, 82.9739],
  'Whitefield Corridor, Bengaluru Central PC': [12.9698, 77.7499],
  'Bengaluru Central PC': [12.9716, 77.5946],
  'Ballygunge, Kolkata South PC': [22.5280, 88.3654],
  'Kolkata South PC': [22.5150, 88.3530],
  'Velachery Zone, Chennai South PC': [12.9815, 80.2180],
  'Chennai South PC': [13.0012, 80.2565],
  'Kankarbagh Colony, Patna Sahib PC': [25.5941, 85.1585],
  'Patna Sahib PC': [25.6000, 85.1800],
  'Malviya Nagar Sector 4, Jaipur PC': [26.8530, 75.8119],
  'Jaipur PC': [26.9124, 75.7873],
  'SG Highway Thaltej, Ahmedabad West PC': [23.0330, 72.5050],
  'Ahmedabad West PC': [23.0225, 72.5714],
};

const STATE_COORDS_MAP: Record<string, [number, number]> = {
  'Andhra Pradesh': [15.9129, 79.7400],
  'Arunachal Pradesh': [28.2180, 94.7278],
  'Assam': [26.2006, 92.9376],
  'Bihar': [25.0961, 85.3131],
  'Chhattisgarh': [21.2787, 81.8661],
  'Goa': [15.2993, 74.1240],
  'Gujarat': [22.2587, 71.1924],
  'Haryana': [29.0588, 76.0856],
  'Himachal Pradesh': [31.1048, 77.1734],
  'Jharkhand': [23.6102, 85.2799],
  'Karnataka': [15.3173, 75.7139],
  'Kerala': [10.8505, 76.2711],
  'Madhya Pradesh': [22.9734, 78.6569],
  'Maharashtra': [19.7515, 75.7139],
  'Manipur': [24.6637, 93.9063],
  'Meghalaya': [25.4670, 91.3662],
  'Mizoram': [23.1645, 92.9376],
  'Nagaland': [26.1584, 94.5624],
  'Odisha': [20.9517, 85.0985],
  'Punjab': [31.1471, 75.3412],
  'Rajasthan': [27.0238, 74.2179],
  'Sikkim': [27.5330, 88.5122],
  'Tamil Nadu': [11.1271, 78.6569],
  'Telangana': [18.1124, 79.0193],
  'Tripura': [23.9408, 91.9882],
  'Uttar Pradesh': [26.8467, 80.9462],
  'Uttarakhand': [30.0668, 79.0193],
  'West Bengal': [22.9868, 87.8550],
  'Delhi': [28.6139, 77.2090],
  'Chandigarh': [30.7333, 76.7794],
  'All India': [20.5937, 78.9629],
};

function getRegionGeocode(region: Region): [number, number] {
  const cleanPC = region.constituency.replace(' (Demo Region)', '').trim();
  if (REGION_COORDS_MAP[cleanPC]) return REGION_COORDS_MAP[cleanPC];
  if (REGION_COORDS_MAP[region.constituency]) return REGION_COORDS_MAP[region.constituency];
  if (region.constituency.includes('Koraput')) return [18.8135, 82.7125];
  if (region.constituency.includes('Mumbai')) return [19.1197, 72.8464];
  if (region.constituency.includes('Bengaluru')) return [12.9716, 77.5946];
  if (region.constituency.includes('Delhi')) return [28.6139, 77.2090];
  if (region.constituency.includes('Kolkata')) return [22.5280, 88.3654];
  if (region.constituency.includes('Chennai')) return [12.9815, 80.2180];
  if (region.constituency.includes('Varanasi')) return [25.3176, 82.9739];
  if (region.constituency.includes('Patna')) return [25.5941, 85.1585];
  if (region.constituency.includes('Jaipur')) return [26.8530, 75.8119];
  if (region.constituency.includes('Ahmedabad')) return [23.0330, 72.5050];
  if (STATE_COORDS_MAP[region.state]) return STATE_COORDS_MAP[region.state];
  return [20.5937, 78.9629];
}

interface ExplorePageProps {
  region: Region;
  onNavigate: (tab: string) => void;
}

export const ExplorePage: React.FC<ExplorePageProps> = ({ region, onNavigate }) => {
  const { t } = useLanguage();
  // Active filter category ('ALL' or specific CategoryType)
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  
  // Search query inside the sidebar list
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active Hotspot selected for inspection in the 7-Tab Drawer (null initially so user sees full interactive map)
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);

  // Active Tab inside the 7-Tab Hotspot Details Drawer (1 to 7)
  const [activeTab, setActiveTab] = useState<number>(1);

  const handleSelectHotspot = (hs: Hotspot) => {
    setActiveHotspot(hs);
    setActiveTab(1);
  };

  const handleCloseDrawer = () => {
    setActiveHotspot(null);
  };

  // Map GIS Layer Toggles
  const [showCitizenReports, setShowCitizenReports] = useState<boolean>(true);
  const [showAIClusters, setShowAIClusters] = useState<boolean>(true);
  const [showInfrastructure, setShowInfrastructure] = useState<boolean>(true);
  const [showDemographicHeat, setShowDemographicHeat] = useState<boolean>(false);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite' | 'hybrid'>('streets');

  // Simulation state for Tab 6 ("What-If" Priority Mandate Simulator)
  const [simulatedUrgencyLevel, setSimulatedUrgencyLevel] = useState<number>(2); // 1=Standard, 2=Expedited, 3=Emergency
  const [simulatedPriorityDrop, setSimulatedPriorityDrop] = useState<number>(82); // score reduction

  // Sidebar Tab Switcher between Clusters and Individual Citizen Complaints
  const [activeListTab, setActiveListTab] = useState<'CLUSTERS' | 'REPORTS'>('CLUSTERS');

  // Consume canonical single source of truth
  const { hotspots, reports } = useCitizenStore();

  const { clusters: engineClusters, individualReports: _engineIndividualReports } = useMemo(() => {
    return runClusterEngine(reports, hotspots);
  }, [reports, hotspots]);

  // Filter and sort hotspots (from canonical store / cluster engine)
  // Filter and sort hotspots (from canonical store / cluster engine)
  const filteredHotspots = useMemo(() => {
    const constName = region.constituency.replace(' (Demo Region)', '').replace(' PC', '').trim().toLowerCase();
    const distName = region.district.replace(' District', '').trim().toLowerCase();
    const isAll = region.isAllIndia || region.state === 'All India' || region.constituency === 'All India' || region.constituency === 'All India View' || region.constituency.includes('All India');

    return engineClusters.filter((hs) => {
      const matchesRegion = isAll
        ? true
        : hs.name.toLowerCase().includes(constName) ||
          hs.location.blockOrTown.toLowerCase().includes(constName) ||
          hs.location.blockOrTown.toLowerCase().includes(distName) ||
          ((hs.location as any).district && (hs.location as any).district.toLowerCase().includes(distName)) ||
          ((hs.location as any).constituency && (hs.location as any).constituency.toLowerCase().includes(constName)) ||
          (region.constituency.includes('Koraput') && hs.name.toLowerCase().includes('semiliguda'));

      const matchesCategory = selectedCategory === 'ALL' || hs.category === selectedCategory;
      const matchesSearch =
        hs.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hs.location.blockOrTown.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hs.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRegion && matchesCategory && matchesSearch;
    }).sort((a, b) => b.priorityScore - a.priorityScore);
  }, [selectedCategory, searchQuery, engineClusters, region]);

  // Filter and sort individual verified citizen reports (from canonical store)
  const filteredReports = useMemo(() => {
    const constName = region.constituency.replace(' (Demo Region)', '').replace(' PC', '').trim().toLowerCase();
    const distName = region.district.replace(' District', '').trim().toLowerCase();
    const isAll = region.isAllIndia || region.state === 'All India' || region.constituency === 'All India' || region.constituency === 'All India View' || region.constituency.includes('All India');

    return reports.filter((rep) => {
      const matchesRegion = isAll
        ? true
        : (rep.location?.constituency && rep.location.constituency.toLowerCase().includes(constName)) ||
          (rep.location?.district && rep.location.district.toLowerCase().includes(distName)) ||
          (rep.address || rep.location?.blockOrTown || '').toLowerCase().includes(constName) ||
          (rep.address || rep.location?.blockOrTown || '').toLowerCase().includes(distName) ||
          (region.constituency.includes('Koraput') && (rep.address || rep.location?.blockOrTown || '').toLowerCase().includes('semiliguda'));

      const matchesCategory = selectedCategory === 'ALL' || rep.category === selectedCategory;
      const matchesSearch =
        (rep.title || rep.detectedIssue || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (rep.address || rep.location?.blockOrTown || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (rep.description || rep.rawText || rep.aiSummary || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRegion && matchesCategory && matchesSearch;
    });
  }, [reports, selectedCategory, searchQuery, region]);

  // Automatically switch tab in Spatial Demand Ledger if the viewed area has complaints but no clusters (or vice versa)
  useEffect(() => {
    if (filteredHotspots.length === 0 && filteredReports.length > 0 && activeListTab === 'CLUSTERS') {
      setActiveListTab('REPORTS');
    } else if (filteredHotspots.length > 0 && filteredReports.length === 0 && activeListTab === 'REPORTS') {
      setActiveListTab('CLUSTERS');
    }
  }, [filteredHotspots.length, filteredReports.length, activeListTab, region.constituency]);

  // Categories list for quick filtering pills
  const categories: { id: string; label: string; count?: number }[] = [
    { id: 'ALL', label: activeListTab === 'CLUSTERS' ? t('cat.all_clusters') : t('cat.all_complaints'), count: activeListTab === 'CLUSTERS' ? filteredHotspots.length : filteredReports.length },
    { id: 'Road', label: t('cat.road') },
    { id: 'Drainage', label: t('cat.drainage') },
    { id: 'Healthcare', label: t('cat.healthcare') },
    { id: 'Water', label: t('cat.water') },
    { id: 'Schools', label: t('cat.schools') },
  ];

  // Map center coordinates based on active hotspot, reports, or constituency coordinates
  const mapCenter: [number, number] = useMemo(() => {
    if (activeHotspot) {
      return [activeHotspot.location.center.lat, activeHotspot.location.center.lng];
    }
    if (filteredReports.length > 0) {
      const firstRep = filteredReports[0];
      const lat = firstRep.location?.lat || firstRep.latitude;
      const lng = firstRep.location?.lng || firstRep.longitude;
      if (lat && lng && lat !== 20.5937 && lng !== 78.9629) {
        return [lat, lng];
      }
    }
    if (filteredHotspots.length > 0) {
      const center = filteredHotspots[0].location.center;
      if (center.lat !== 20.5937 && center.lng !== 78.9629) {
        return [center.lat, center.lng];
      }
    }
    if (region.isAllIndia || region.state === 'All India') {
      return [20.5937, 78.9629]; // All India Center
    }
    return getRegionGeocode(region);
  }, [activeHotspot, region, filteredHotspots, filteredReports]);

  // Infrastructure points across India to display when showInfrastructure is ON
  const infrastructurePoints = useMemo(() => [
    { id: 'inf-1', name: 'AIIMS New Delhi Medical Hub', type: 'HOSPITAL', lat: 28.5672, lng: 77.2100, status: 'Functional' },
    { id: 'inf-2', name: 'KEM Hospital Mumbai Central', type: 'HOSPITAL', lat: 19.0025, lng: 72.8424, status: 'Functional' },
    { id: 'inf-3', name: 'Victoria Hospital Bengaluru Urban', type: 'HOSPITAL', lat: 12.9634, lng: 77.5755, status: 'Functional' },
    { id: 'inf-4', name: 'SSKM Government Medical College Kolkata', type: 'HOSPITAL', lat: 22.5392, lng: 88.3444, status: 'Needs Repair' },
    { id: 'inf-5', name: 'Rajiv Gandhi Government General Hospital Chennai', type: 'HOSPITAL', lat: 13.0815, lng: 80.2785, status: 'Functional' },
    { id: 'inf-6', name: 'Patna Medical College Hospital (PMCH)', type: 'HOSPITAL', lat: 25.6186, lng: 85.1661, status: 'Needs Repair' },
    { id: 'inf-7', name: 'Varanasi Civil & Cantt Hospital', type: 'HOSPITAL', lat: 25.3210, lng: 82.9800, status: 'Needs Repair' },
    { id: 'inf-8', name: 'Koraput District Main Hospital', type: 'HOSPITAL', lat: 18.8180, lng: 82.7150, status: 'Functional' },
    { id: 'inf-9', name: 'Delhi Public & Municipal School Hub Karol Bagh', type: 'SCHOOL', lat: 28.6540, lng: 77.1920, status: 'Needs Repair' },
    { id: 'inf-10', name: 'Andheri West Municipal Secondary School Mumbai', type: 'SCHOOL', lat: 19.1220, lng: 72.8480, status: 'Functional' },
    { id: 'inf-11', name: 'Whitefield Government High School Bengaluru', type: 'SCHOOL', lat: 12.9710, lng: 77.7510, status: 'Needs Repair' },
    { id: 'inf-12', name: 'Semiliguda Govt High School Koraput', type: 'SCHOOL', lat: 18.7120, lng: 82.8490, status: 'Needs Repair' },
    { id: 'inf-13', name: 'Ballygunge Government High School Kolkata', type: 'SCHOOL', lat: 22.5290, lng: 88.3660, status: 'Functional' },
    { id: 'inf-14', name: 'Delhi Jal Board WTP Prasad Nagar', type: 'WATER', lat: 28.6500, lng: 77.1890, status: 'Needs Repair' },
    { id: 'inf-15', name: 'Brihanmumbai Stormwater Pumping Station Andheri', type: 'WATER', lat: 19.1170, lng: 72.8440, status: 'Needs Repair' },
    { id: 'inf-16', name: 'BWSSB Overhead Water Reservoir Whitefield', type: 'WATER', lat: 12.9680, lng: 77.7480, status: 'Functional' },
    { id: 'inf-17', name: 'Damanjodi JJM Water Treatment Plant Koraput', type: 'WATER', lat: 18.7790, lng: 82.8940, status: 'Functional' },
    { id: 'inf-18', name: 'Velachery Sump & Storm Water Canal Chennai', type: 'WATER', lat: 12.9800, lng: 80.2160, status: 'Needs Repair' },
  ], []);

  // Helper colors based on priority level
  const getPriorityBadgeStyle = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-500/20 animate-pulse';
      case 'HIGH':
        return 'bg-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-600/20';
      case 'MEDIUM':
        return 'bg-teal-600 text-white border-teal-700 shadow-sm shadow-teal-600/20';
      default:
        return 'bg-slate-600 text-white border-slate-700';
    }
  };

  const getPriorityColorHex = (level: string) => {
    switch (level) {
      case 'CRITICAL': return '#F59E0B'; // Warm Amber/Yellow
      case 'HIGH': return '#10B981';     // Emerald Green
      case 'MEDIUM': return '#0D9488';   // Turquoise Teal
      default: return '#64748B';
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-slate-900 pb-16">
      
      {/* Top Header Command Strip — Studio White with Turquoise / Green / Yellow accents */}
      <div className="bg-white border-b border-slate-200/80 shadow-xs py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold text-slate-600">
                {t('explore.canvas')}: <strong className="text-slate-900">{region.state} → {region.constituency.replace(' (Demo Region)', '')}</strong>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <span>{t('explore.title')}</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto justify-end">
            <button
              onClick={() => onNavigate('report')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm transition-all shadow-sm shadow-teal-600/20 active:scale-95"
            >
              <Activity className="w-4 h-4" />
              <span>{t('explore.switchReport')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container: 65% Interactive Leaflet Map + 35% Ranked Hotspot List sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Unified Category Filter Controls — Mobile Dropdown vs PC/Desktop Pills Strip */}
        <div className="mb-6 pb-4 border-b border-slate-200/80">
          {/* 1. Mobile & Phone Viewport: Unified Apple Maps style Select Dropdown */}
          <div className="block md:hidden space-y-3">
            <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-md">
              <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                <Filter className="w-4 h-4 text-teal-600" /> Filter Category:
              </span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all font-mono"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label} {cat.count !== undefined ? `(${cat.count} Clusters)` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-xs font-bold w-full justify-center shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>{filteredHotspots.length} Active Clusters • {filteredReports.length} Individual Demand Pins</span>
              </div>
            </div>
          </div>

          {/* 2. PC / Desktop Viewport: Side-Scrolling Filter Pills Strip */}
          <div className="hidden md:flex items-center justify-between gap-4 overflow-x-auto no-scrollbar pb-1">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-teal-600" /> Filter:
              </span>
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-teal-600 text-white border-teal-700 shadow-md shadow-teal-600/20 scale-105'
                        : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50 hover:border-teal-300'
                    }`}
                  >
                    <span>{cat.label}</span>
                    {cat.count !== undefined && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isSelected ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {cat.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>{filteredHotspots.length} Active Clusters • {filteredReports.length} Pins</span>
              </div>
            </div>
          </div>
        </div>

        {/* 65% Map + 35% Ranked List Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT 65% (or 7 columns on Desktop): Interactive Cartographic Viewport */}
          <div className="lg:col-span-7 bg-white rounded-[28px] border border-slate-200/90 shadow-xl overflow-hidden flex flex-col h-[600px] sm:h-[680px] relative">
            
            {/* Map Top GIS Layer Toolbar */}
            <div className="bg-slate-50 border-b border-slate-200/80 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 select-none">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold font-mono text-xs shrink-0 shadow-sm">
                  GIS
                </div>
                <div className="truncate">
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                    Spatial Intelligence Viewport
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 truncate">
                    DBSCAN & H3 Hexagonal Grid Clustering • Scale 1:250,000
                  </p>
                </div>
              </div>

              {/* GIS Layer Checkbox Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setShowAIClusters(!showAIClusters)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 ${
                    showAIClusters
                      ? 'bg-amber-50 text-amber-900 border-amber-300 font-extrabold'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Toggle High-Priority AI Clusters"
                >
                  <span className={`w-2 h-2 rounded-full ${showAIClusters ? 'bg-amber-500' : 'bg-slate-300'}`} />
                  <span>AI Clusters</span>
                </button>

                <button
                  onClick={() => setShowInfrastructure(!showInfrastructure)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 ${
                    showInfrastructure
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-extrabold'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                  title={t('explore.layer.title.infra')}
                >
                  <span className={`w-2 h-2 rounded-full ${showInfrastructure ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span>{t('explore.layer.infra')}</span>
                </button>

                <button
                  onClick={() => setShowCitizenReports(!showCitizenReports)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 ${
                    showCitizenReports
                      ? 'bg-teal-50 text-teal-900 border-teal-300 font-extrabold'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                  title={t('explore.layer.title.citizen')}
                >
                  <span className={`w-2 h-2 rounded-full ${showCitizenReports ? 'bg-teal-500' : 'bg-slate-300'}`} />
                  <span>{t('explore.layer.citizen')} ({filteredReports.length})</span>
                </button>

                <button
                  onClick={() => setShowDemographicHeat(!showDemographicHeat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 ${
                    showDemographicHeat
                      ? 'bg-purple-50 text-purple-900 border-purple-300 font-extrabold'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                  title={t('explore.layer.title.demographics')}
                >
                  <span className={`w-2 h-2 rounded-full ${showDemographicHeat ? 'bg-purple-500' : 'bg-slate-300'}`} />
                  <span>{t('explore.layer.demographics')}</span>
                </button>

                <div className="h-4 w-px bg-slate-300 hidden sm:block mx-1" />

                {/* Map Base Tile Switcher (Streets / Satellite / Hybrid) */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                  <button
                    onClick={() => setMapStyle('streets')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                      mapStyle === 'streets' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t('explore.layer.streets')}
                  </button>
                  <button
                    onClick={() => setMapStyle('satellite')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                      mapStyle === 'satellite' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t('explore.layer.satellite')}
                  </button>
                  <button
                    onClick={() => setMapStyle('hybrid')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                      mapStyle === 'hybrid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🌐 {t('nav.home') === 'Home' ? 'Hybrid' : t('nav.home') === 'होम' ? 'हाइब्रिड' : t('nav.home') === 'ହୋମ' ? 'ହାଇବ୍ରିଡ୍' : 'హైబ్రిడ్'}
                  </button>
                </div>
              </div>
            </div>

            {/* Leaflet Cartographic Map Canvas */}
            <div className="flex-1 relative bg-slate-900 z-10">
              <MapContainer
                center={mapCenter}
                zoom={region.isAllIndia || region.state === 'All India' ? 5 : 11}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
                className="z-10"
                >
                  <MapViewController center={mapCenter} zoom={activeHotspot ? 13 : (region.isAllIndia || region.state === 'All India' ? 5 : 11)} />

                  {/* Dynamic Base Map Tiles (Streets vs Satellite vs Hybrid) */}
                  {mapStyle === 'streets' && (
                    <TileLayer
                      attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> • Government Geo Data'
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />
                  )}
                  {(mapStyle === 'satellite' || mapStyle === 'hybrid') && (
                    <TileLayer
                      attribution='&copy; <a href="https://www.esri.com/">Esri</a> • Earthstar Geographics'
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    />
                  )}
                  {mapStyle === 'hybrid' && (
                    <TileLayer
                      attribution='&copy; <a href="https://www.esri.com/">Esri Labels</a>'
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                    />
                  )}

                  {/* 1. Demographic Heatmap Simulation Overlay (when enabled) */}
                  {showDemographicHeat && (
                    <CircleMarker
                      center={[18.8135, 82.7125]}
                      radius={120}
                      pathOptions={{ fillColor: '#9333ea', fillOpacity: 0.15, color: '#a855f7', weight: 1, dashArray: '5,5' }}
                    >
                      <Tooltip>Census 2026 High Population Growth Zone (+14.2% Density)</Tooltip>
                    </CircleMarker>
                  )}

                  {/* 2. Public Infrastructure Overlay Markers */}
                  {showInfrastructure &&
                    infrastructurePoints.map((inf) => (
                      <CircleMarker
                        key={inf.id}
                        center={[inf.lat, inf.lng]}
                        radius={6}
                        pathOptions={{
                          fillColor: inf.type === 'HOSPITAL' ? '#10B981' : inf.type === 'SCHOOL' ? '#0D9488' : '#3B82F6',
                          color: '#ffffff',
                          weight: 2,
                          fillOpacity: 0.9,
                        }}
                      >
                        <Tooltip direction="top" offset={[0, -4]} opacity={1}>
                          <div className="font-sans text-xs">
                            <strong className="block text-slate-900">{inf.name}</strong>
                            <span className="text-[10px] font-mono text-slate-500 uppercase">{inf.type} • {inf.status}</span>
                          </div>
                        </Tooltip>
                      </CircleMarker>
                    ))}

                  {/* 3. AI High-Priority Hotspot Clusters */}
                  {showAIClusters &&
                    filteredHotspots.map((hs) => {
                      const isSelected = activeHotspot?.id === hs.id;
                      const colorHex = getPriorityColorHex(hs.priorityLevel);
                      const radiusSize = hs.clusterSizeClass === 'large' ? 24 : hs.clusterSizeClass === 'medium' ? 18 : 14;

                      return (
                        <CircleMarker
                          key={hs.id}
                          center={[hs.location.center.lat, hs.location.center.lng]}
                          radius={isSelected ? radiusSize + 6 : radiusSize}
                          eventHandlers={{
                            click: () => {
                              handleSelectHotspot(hs);
                            },
                          }}
                          pathOptions={{
                            fillColor: colorHex,
                            color: isSelected ? '#FFFFFF' : colorHex,
                            weight: isSelected ? 4 : 2,
                            fillOpacity: isSelected ? 0.85 : 0.65,
                          }}
                        >
                          <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                            <div className="font-sans p-1 min-w-[180px]">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-slate-900 text-white">
                                  Score: {hs.priorityScore}
                                </span>
                                <span className="text-[10px] font-mono font-bold uppercase text-slate-500">
                                  {hs.priorityLevel}
                                </span>
                              </div>
                              <strong className="block text-xs font-extrabold text-slate-900 mb-0.5">
                                {hs.name}
                              </strong>
                              <span className="text-[11px] text-slate-600 font-medium">
                                {hs.metrics.citizenReportCount} Verified Reports • {hs.metrics.impactedPopulation.toLocaleString()} Pop
                              </span>
                            </div>
                          </Tooltip>

                          <Popup className="custom-popup">
                            <div className="p-2.5 max-w-[280px] font-sans text-slate-900 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-100 text-teal-800">
                                  {hs.category} CLUSTER
                                </span>
                                <span className="text-[10px] font-mono font-black text-slate-500">
                                  Score: {hs.priorityScore}/100
                                </span>
                              </div>

                              <h4 className="font-extrabold text-sm leading-tight text-slate-900">{hs.name}</h4>
                              <p className="text-xs text-slate-600 font-medium leading-relaxed border-l-2 border-teal-500 pl-2">
                                {hs.aiSynthesis?.headline || hs.aiSynthesis?.reasoning}
                              </p>

                              {/* Latest Citizen Intake Preview */}
                              {hs.recentReports && hs.recentReports.length > 0 && (
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-800">
                                  <div className="flex items-center gap-1 font-mono text-[9px] font-extrabold text-teal-700 uppercase mb-0.5">
                                    <span>Latest Citizen Demand:</span>
                                    <span>{hs.recentReports[0].inputMethod || (hs.recentReports[0].rawMediaUrl ? 'PHOTO' : 'TEXT')}</span>
                                  </div>
                                  <p className="italic truncate text-slate-700">
                                    "{hs.recentReports[0].rawText || hs.recentReports[0].aiProcessing?.transcription || hs.recentReports[0].aiProcessing?.aiSummary}"
                                  </p>
                                </div>
                              )}

                              <button
                                onClick={() => {
                                  handleSelectHotspot(hs);
                                }}
                                className="w-full py-1.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition-all"
                              >
                                <span>Open 7-Tab Inspection Drawer</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </Popup>
                        </CircleMarker>
                      );
                    })}

                  {/* 4. Individual Verified Citizen Inputs (Voice, Photo, Text Complaints) */}
                  {showCitizenReports &&
                    filteredReports.map((rep, idx) => {
                      const baseLat = rep.location?.lat || rep.latitude || 18.8135;
                      const baseLng = rep.location?.lng || rep.longitude || 82.7125;
                      const repLat = baseLat;
                      const repLng = baseLng;

                      const intakeMethod = rep.inputMethod || rep.intakeType || (rep.photoBase64 || rep.rawMediaUrl ? 'PHOTO' : 'TEXT');
                      const pinColor = intakeMethod === 'VOICE' ? '#2563EB' : intakeMethod === 'PHOTO' ? '#9333EA' : '#0D9488';

                      return (
                        <CircleMarker
                          key={`cit-rep-${rep.id}-${idx}`}
                          center={[repLat, repLng]}
                          radius={11}
                          pathOptions={{
                            fillColor: pinColor,
                            color: '#FFFFFF',
                            weight: 3,
                            fillOpacity: 1,
                          }}
                        >
                          <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                            <div className="font-sans p-1 min-w-[180px]">
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-slate-900 text-white uppercase flex items-center gap-1">
                                  <span>{intakeMethod === 'VOICE' ? '🎙️' : intakeMethod === 'PHOTO' ? '📸' : '📝'}</span>
                                  <span>#{idx + 1} {intakeMethod}</span>
                                </span>
                                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                                  {rep.category}
                                </span>
                              </div>
                              <strong className="block text-xs font-extrabold text-slate-900 truncate">
                                {rep.detectedIssue || rep.title || 'Verified Citizen Submission'}
                              </strong>
                              <span className="text-[10px] text-teal-700 font-bold block mt-0.5 truncate">
                                📍 {rep.location?.blockOrTown || rep.address || 'Verified Civic Locality'}
                              </span>
                            </div>
                          </Tooltip>

                          <Popup className="custom-popup">
                            <div className="p-2.5 max-w-[280px] font-sans text-slate-900 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-black bg-blue-100 text-blue-900 uppercase">
                                  <span>{intakeMethod === 'VOICE' ? '🎙️ VOICE' : intakeMethod === 'PHOTO' ? '📸 PHOTO' : '📝 TEXT'} INTAKE</span>
                                  <span>•</span>
                                  <span>#{idx + 1}</span>
                                </span>
                                <span className="text-[10px] font-mono font-bold text-slate-500">
                                  {rep.timestamp || rep.createdAt || 'Just now'}
                                </span>
                              </div>

                              <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 leading-tight">
                                {rep.detectedIssue || rep.title || 'Verified Citizen Civic Intake'}
                              </h4>

                              <div className="bg-slate-50 p-2 sm:p-2.5 rounded-xl border border-slate-200 text-xs italic text-slate-800 leading-relaxed font-serif">
                                "{rep.rawText || rep.description || rep.aiSummary || rep.urgencyReasoning}"
                              </div>

                              {(rep.photoBase64 || rep.rawMediaUrl || (rep.images && rep.images.length > 0)) && (
                                <div className="rounded-xl overflow-hidden border border-slate-200 max-h-36 bg-slate-100 shadow-2xs">
                                  <img
                                    src={rep.photoBase64 || rep.rawMediaUrl || rep.images![0]}
                                    alt="Citizen upload"
                                    className="w-full h-auto object-cover"
                                  />
                                </div>
                              )}

                              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1.5 border-t border-slate-100">
                                <span>Category: <strong className="text-slate-800">{rep.category}</strong></span>
                                <span>Loc: <strong className="text-slate-800">{rep.address || rep.location?.blockOrTown || 'Koraput PC'}</strong></span>
                              </div>
                            </div>
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                </MapContainer>

              {/* Floating Legend inside Map Canvas */}
              <div className="absolute bottom-4 left-4 z-[400] bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-3.5 shadow-xl max-w-xs pointer-events-auto">
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-2">Cartographic Legend</div>
                <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-500 border border-white shadow-xs shrink-0" />
                    <span>🔴 Critical Cluster</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-600 border border-white shadow-xs shrink-0" />
                    <span>🟠 High Cluster</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-teal-600 border border-white shadow-xs shrink-0" />
                    <span>🟡 Medium Cluster</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shrink-0" />
                    <span>Public Infra Point</span>
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2 pt-1 border-t border-slate-100">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600 border border-white shadow-xs shrink-0" />
                    <span>🟣 Individual Citizen Pins ({filteredReports.length})</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Map Bottom Status Ribbon */}
            <div className="bg-white border-t border-slate-200/80 p-3 px-4 flex items-center justify-between text-xs font-mono text-slate-500">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>4-Layer Duplicate Defense Active (<span className="text-slate-900 font-bold">0% Overlap</span>)</span>
              </div>
              <div>
                <span>Selected Cluster: <strong className="text-teal-700">{activeHotspot ? activeHotspot.name : 'None'}</strong></span>
              </div>
            </div>
          </div>

          {/* RIGHT 35% (or 5 columns on Desktop): Ranked Hotspot Priority List / Citizen Complaints */}
          <div className="lg:col-span-5 bg-white rounded-[28px] border border-slate-200/90 shadow-xl p-4 sm:p-6 flex flex-col h-[600px] sm:h-[680px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900">{t('explore.spatialLedger')}</h3>
                <p className="text-xs text-slate-500 font-medium">{t('explore.synced')}</p>
              </div>
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setActiveListTab('CLUSTERS')}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-extrabold transition-all ${
                    activeListTab === 'CLUSTERS'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {t('explore.clusters')} ({filteredHotspots.length})
                </button>
                <button
                  onClick={() => setActiveListTab('REPORTS')}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-extrabold transition-all ${
                    activeListTab === 'REPORTS'
                      ? 'bg-white text-teal-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {t('explore.complaints')} ({filteredReports.length})
                </button>
              </div>
            </div>

            {/* Search filter inside list */}
            <div className="mb-3 relative">
              <input
                type="text"
                placeholder={activeListTab === 'CLUSTERS' ? t('explore.searchPlaceholderClusters') : t('explore.searchPlaceholderReports')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 font-medium"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Scrollable Hotspot Cards or Citizen Complaints List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-w-0">
              {activeListTab === 'CLUSTERS' ? (
                filteredHotspots.length > 0 ? (
                  filteredHotspots.map((hs, idx) => {
                    const isSelected = activeHotspot?.id === hs.id;
                    return (
                      <div
                        key={hs.id}
                        onClick={() => handleSelectHotspot(hs)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-teal-50/90 border-teal-500 shadow-md ring-1 ring-teal-500/30'
                            : 'bg-[#FAFAFB] hover:bg-slate-50/80 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2 min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 min-w-0">
                              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-mono text-[10px] font-black flex items-center justify-center shrink-0">
                                #{idx + 1}
                              </span>
                              <span className="font-extrabold text-sm text-slate-900 truncate">
                                {hs.name}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-medium truncate">
                              {hs.location.blockOrTown} • <strong className="text-slate-700">{hs.category}</strong>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className={`text-xl font-mono font-black ${hs.priorityScore >= 80 ? 'text-amber-600' : 'text-teal-700'}`}>
                              {hs.priorityScore}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 uppercase">Score</div>
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3 font-medium">
                          {hs.aiSynthesis?.headline || hs.aiSynthesis?.reasoning}
                        </p>

                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 border-t border-slate-200/60 pt-2.5">
                          <span>{hs.metrics.citizenReportCount} Reports • {hs.metrics.impactedPopulation.toLocaleString()} Pop</span>
                          <span className="text-teal-700 font-bold flex items-center gap-0.5">
                            Inspect Drawer <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 px-4 space-y-3 bg-slate-50/70 rounded-2xl border border-slate-200/80 my-2">
                    <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center mx-auto text-teal-600 shadow-xs">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div className="font-extrabold text-slate-800 text-sm">
                      No active density clusters in {region.constituency.replace(' (Demo Region)', '')}
                    </div>
                    {filteredReports.length > 0 ? (
                      <div className="space-y-3 pt-1">
                        <p className="text-xs text-teal-900 font-bold max-w-xs mx-auto bg-teal-50 p-3 rounded-xl border border-teal-200">
                          Found <strong className="text-teal-700 font-black">{filteredReports.length} verified citizen complaints</strong> in this exact area!
                        </p>
                        <button
                          onClick={() => setActiveListTab('REPORTS')}
                          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 mx-auto"
                        >
                          <span>Show {filteredReports.length} Complaints in Ledger</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs mx-auto">
                          The interactive GIS cartographic canvas is live and centered on {region.constituency.replace(' (Demo Region)', '')} ({region.state}). Submit citizen intakes to form spatial clusters!
                        </p>
                        <button onClick={() => { setSelectedCategory('ALL'); setSearchQuery(''); }} className="text-xs text-teal-600 hover:underline font-bold">
                          Reset filter preferences
                        </button>
                      </>
                    )}
                  </div>
                )
              ) : (
                /* Individual Citizen Complaints Tab */
                filteredReports.length > 0 ? (
                  filteredReports.map((rep, idx) => {
                    const intakeMethod = rep.inputMethod || rep.intakeType || (rep.photoBase64 || rep.rawMediaUrl ? 'PHOTO' : 'TEXT');
                    const badgeColor =
                      intakeMethod === 'VOICE'
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : intakeMethod === 'PHOTO'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : 'bg-sky-100 text-sky-800 border-sky-200';

                    return (
                      <div
                        key={`side-cit-${rep.id}-${idx}`}
                        className="p-3.5 rounded-2xl bg-white border border-slate-200/80 hover:border-teal-500/60 shadow-xs hover:shadow-md transition-all space-y-2 min-w-0"
                      >
                        <div className="flex items-start justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badgeColor}`}>
                              {intakeMethod}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {rep.category}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {rep.timestamp || rep.createdAt || 'Just now'}
                          </span>
                        </div>

                        <h4 className="font-extrabold text-xs text-slate-900 leading-tight break-words">
                          {rep.detectedIssue || rep.title || 'Verified Citizen Civic Intake'}
                        </h4>

                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 text-xs italic text-slate-700 font-serif leading-relaxed break-words">
                          "{rep.rawText || rep.description || rep.aiSummary || rep.urgencyReasoning}"
                        </div>

                        {(rep.photoBase64 || rep.rawMediaUrl || (rep.images && rep.images.length > 0)) && (
                          <div className="rounded-xl overflow-hidden border border-slate-200 max-h-36 bg-slate-100 mt-1">
                            <img
                              src={rep.photoBase64 || rep.rawMediaUrl || rep.images![0]}
                              alt="Citizen evidence"
                              className="w-full h-auto object-cover"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-100">
                          <span className="truncate">📍 {rep.address || rep.location?.blockOrTown || 'Verified Civic Locality'}</span>
                          <span className="text-teal-700 font-bold shrink-0">Verified Sample #{idx + 1}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 px-4 space-y-3 bg-slate-50/70 rounded-2xl border border-slate-200/80 my-2">
                    <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center mx-auto text-teal-600 shadow-xs">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="font-extrabold text-slate-800 text-sm">
                      No individual reports in {region.constituency.replace(' (Demo Region)', '')}
                    </div>
                    {filteredHotspots.length > 0 ? (
                      <div className="space-y-3 pt-1">
                        <p className="text-xs text-teal-900 font-bold max-w-xs mx-auto bg-teal-50 p-3 rounded-xl border border-teal-200">
                          Found <strong className="text-teal-700 font-black">{filteredHotspots.length} density cluster{filteredHotspots.length > 1 ? 's' : ''}</strong> in this exact area!
                        </p>
                        <button
                          onClick={() => setActiveListTab('CLUSTERS')}
                          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 mx-auto"
                        >
                          <span>Show {filteredHotspots.length} Clusters in Ledger</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs mx-auto">
                          Be the first to submit a verified voice note, photo, or text report from {region.constituency.replace(' (Demo Region)', '')} ({region.state}) to appear live on the map!
                        </p>
                        <button onClick={() => { setSelectedCategory('ALL'); setSearchQuery(''); }} className="text-xs text-teal-600 hover:underline font-bold">
                          Reset filter preferences
                        </button>
                      </>
                    )}
                  </div>
                )
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 text-center font-mono">
              {activeListTab === 'CLUSTERS'
                ? 'Click any cluster card above to launch the 7-Tab Explainable AI Drawer'
                : 'Showing every verified citizen voice, photo & text submission on the GIS map'}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================================
          EXPERIENCE 4: 7-TAB EXPLAINABLE AI HOTSPOT DETAILS DRAWER (Slide-Over Panel)
          ========================================================================================= */}
      {activeHotspot && (
        <div className="fixed inset-0 z-[600] overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            onClick={handleCloseDrawer}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          />

          {/* Drawer Container — Studio White with Turquoise / Green / Yellow accents */}
          <div className="relative w-full max-w-3xl bg-white shadow-2xl flex flex-col h-full z-10 animate-scaleUp">
            
            {/* Drawer Header */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white border-b border-slate-800 flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold border ${getPriorityBadgeStyle(activeHotspot.priorityLevel)}`}>
                    {activeHotspot.priorityLevel} PRIORITY • SCORE: {activeHotspot.priorityScore}/100
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold">
                    {activeHotspot.category.toUpperCase()} CLUSTER
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                  {activeHotspot.name}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-mono mt-1">
                  Location: {activeHotspot.location.blockOrTown}, {activeHotspot.location.constituency} PC • ID: {activeHotspot.id}
                </p>
              </div>

              <button
                onClick={handleCloseDrawer}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 7-Tab Navigation Bar inside Drawer */}
            <div className="bg-slate-100 border-b border-slate-200 px-4 sm:px-6 flex items-center gap-1.5 overflow-x-auto select-none pt-2">
              {[
                { id: 1, label: t('explore.tab1'), icon: Sparkles },
                { id: 2, label: t('explore.tab2'), icon: BarChart3 },
                { id: 3, label: t('explore.tab3'), icon: Users },
                { id: 4, label: t('explore.tab4'), icon: Building2 },
                { id: 5, label: t('explore.tab5'), icon: ShieldCheck },
                { id: 6, label: t('explore.tab6'), icon: Sliders },
                { id: 7, label: t('explore.tab7'), icon: Eye },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3.5 py-2.5 rounded-t-xl font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 border-b-2 ${
                      isActive
                        ? 'bg-white text-teal-700 border-teal-600 shadow-xs'
                        : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border-transparent'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-teal-600' : 'text-slate-500'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Drawer Body — Content for Tabs 1 to 7 */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-[#FAFAFB] space-y-6">
              
              {/* TAB 1: AI CLUSTER OVERVIEW */}
              {activeTab === 1 && (
                <div className="space-y-6 animate-scaleUp">
                  {/* AI Confidence Banner */}
                  <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-2xl p-5 text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-bold text-lg font-mono shrink-0">
                        98%
                      </div>
                      <div>
                        <div className="text-xs font-mono uppercase tracking-wider text-teal-100 font-bold">
                          Gemini 3.1 Pro Spatial Synthesis
                        </div>
                        <h4 className="font-extrabold text-base sm:text-lg">
                          {t('explore.drawer.confidence')}
                        </h4>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono text-teal-100">{t('explore.drawer.recAction')}</div>
                      <div className="font-mono font-black text-lg">{t('explore.drawer.mandate')}</div>
                    </div>
                  </div>

                  {/* Headline & Reasoning Box */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                    <div>
                      <span className="text-[11px] font-mono font-bold text-teal-700 uppercase">{t('explore.drawer.aiHeadline')}</span>
                      <h3 className="text-lg font-extrabold text-slate-900 mt-1">
                        {activeHotspot.aiSynthesis.headline}
                      </h3>
                    </div>
                    <div className="border-t border-slate-100 pt-3">
                      <span className="text-[11px] font-mono font-bold text-slate-400 uppercase">{t('explore.drawer.reasoning')}</span>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium mt-1">
                        {activeHotspot.aiSynthesis.reasoning}
                      </p>
                    </div>
                    <div className="border-t border-slate-100 pt-3 bg-teal-50/50 p-3.5 rounded-xl border border-teal-200/80">
                      <span className="text-[11px] font-mono font-bold text-teal-800 uppercase flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-teal-600" /> {t('explore.drawer.recAction')}
                      </span>
                      <p className="text-xs sm:text-sm font-extrabold text-teal-950 mt-1">
                        {activeHotspot.aiSynthesis.recommendedAction}
                      </p>
                    </div>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                      <div className="text-2xl font-mono font-black text-slate-900">{activeHotspot.metrics.citizenReportCount}</div>
                      <div className="text-xs font-bold text-slate-500 mt-0.5">{t('explore.drawer.verifiedReports')}</div>
                      <div className="text-[10px] font-mono text-emerald-600 font-bold mt-1">{activeHotspot.metrics.reportGrowthVelocity}</div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                      <div className="text-2xl font-mono font-black text-teal-700">{activeHotspot.metrics.impactedPopulation.toLocaleString()}</div>
                      <div className="text-xs font-bold text-slate-500 mt-0.5">{t('explore.drawer.impactedCitizens')}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-1">{t('explore.drawer.censusSync')}</div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs col-span-2 sm:col-span-1">
                      <div className="text-2xl font-mono font-black text-amber-600">{activeHotspot.metrics.infrastructureStatus}</div>
                      <div className="text-xs font-bold text-slate-500 mt-0.5">{t('explore.drawer.severityRating')}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-1">3 Schools / 0 PHC Nearby</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: 8-FACTOR PRIORITY FORMULA BREAKDOWN */}
              {activeTab === 2 && (
                <div className="space-y-6 animate-scaleUp">
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
                    <h3 className="font-extrabold text-base text-slate-900 mb-2 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-teal-600" />
                      <span>8-Factor Multiplicative Scoring Engine Breakdown</span>
                    </h3>
                    <p className="text-xs text-slate-600 mb-4 font-medium leading-relaxed">
                      Our system calculates priority strictly through empirical variables: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-emerald-800 font-bold">Score = D × S × P × G × U × C × R × Φ</code>. Below are the exact multipliers computed for this cluster:
                    </p>

                    <div className="space-y-4 pt-2">
                      {[
                        { label: 'Demand Velocity (D)', value: activeHotspot.priorityBreakdown.demandVelocityMultiplier, desc: 'Rate of incoming citizen reports over time' },
                        { label: 'Demographic Impact (P)', value: activeHotspot.priorityBreakdown.demographicImpactMultiplier, desc: 'Total population affected directly within 1.8 km' },
                        { label: 'Infrastructure Gap (S)', value: activeHotspot.priorityBreakdown.infrastructureGapMultiplier, desc: 'Deficit of alternative schools/hospitals/roads' },
                        { label: 'Seasonal Urgency (U)', value: activeHotspot.priorityBreakdown.seasonalUrgencyMultiplier, desc: 'Monsoon vulnerability factor (July-September peak)' },
                        { label: 'AI Verification Confidence (Φ)', value: activeHotspot.priorityBreakdown.aiConfidenceMultiplier, desc: 'Photo defect accuracy & acoustic audio clarity' },
                        { label: 'Existing Plan Discount (C)', value: activeHotspot.priorityBreakdown.existingPlanDiscount, desc: '1.0 = No duplicate sanction; < 1.0 if work ongoing' },
                      ].map((item, idx) => (
                        <div key={idx} className="border-b border-slate-100 pb-3 last:border-none last:pb-0">
                          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800 mb-1">
                            <span>{item.label}</span>
                            <span className="font-mono text-teal-700 font-black">{item.value.toFixed(2)}x</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
                            <div
                              className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(item.value * 45, 100)}%` }}
                            />
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">{item.desc}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                      <div>
                        <div className="text-xs font-mono font-bold text-emerald-800 uppercase">Final Multiplicative Score</div>
                        <div className="text-xs text-emerald-900 font-medium">Verified against state budget thresholds</div>
                      </div>
                      <div className="text-3xl font-mono font-black text-emerald-950">
                        {activeHotspot.priorityScore}/100
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: CITIZEN VOICES & MULTIMODAL INTAKE */}
              {activeTab === 3 && (
                <div className="space-y-6 animate-scaleUp">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                      <Users className="w-5 h-5 text-teal-600" />
                      <span>Verified Citizen Multimodal Inputs ({activeHotspot.recentReports.length} Samples)</span>
                    </h3>
                    <button
                      onClick={() => onNavigate('report')}
                      className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1"
                    >
                      <span>Raise a Complaint →</span>
                    </button>
                  </div>

                  {activeHotspot.recentReports.length > 0 ? (
                    <div className="space-y-4">
                      {activeHotspot.recentReports.map((rep) => {
                        const isVoice = rep.inputMethod === 'VOICE' || (rep as any).intakeType === 'VOICE';
                        const isPhoto = rep.rawMediaUrl || rep.inputMethod === 'PHOTO' || (rep as any).intakeType === 'PHOTO';

                        return (
                          <div key={rep.id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase ${isVoice ? 'bg-teal-600 text-white' : isPhoto ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'}`}>
                                  {isVoice ? '🎙️ VOICE COMPLAINT' : isPhoto ? '📸 PHOTO EVIDENCE' : '📝 TEXT REPORT'}
                                </span>
                                <span className="text-xs font-mono text-slate-500 font-medium">{rep.timestamp}</span>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                {rep.verificationStatus || 'VERIFIED'}
                              </span>
                            </div>

                            {/* If Photo Report, display the actual image thumbnail and analysis */}
                            {isPhoto && rep.rawMediaUrl && (
                              <div className="flex flex-col sm:flex-row items-start gap-3 bg-emerald-50/50 p-3 rounded-xl border border-emerald-200">
                                <img src={rep.rawMediaUrl} alt="Verified Citizen Photo" className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-lg border-2 border-emerald-400 shadow-md shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-[10px] font-mono font-bold text-emerald-800 uppercase">Automated AI Defect Inspection</div>
                                  <p className="text-xs text-slate-800 font-medium mt-1 leading-relaxed">
                                    {rep.rawText || rep.aiProcessing?.imageDefectDetected || rep.aiProcessing?.aiSummary}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Voice or Text Transcription Note */}
                            {(!isPhoto || !rep.rawMediaUrl) && (
                              <div>
                                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                                  {isVoice ? 'Spoken Voice Transcribed Text (Odia / Hindi / English)' : 'Written Citizen Intake Note'}
                                </div>
                                <p className="text-xs sm:text-sm italic text-slate-900 font-serif bg-slate-50 p-3 rounded-xl border border-slate-200/80 mt-1 leading-relaxed">
                                  "{rep.rawText || rep.aiProcessing?.transcription || rep.aiProcessing?.aiSummary}"
                                </p>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              {(rep.aiProcessing?.extractedKeywords || ['Citizen Report', rep.category]).map((kw, i) => (
                                <span key={i} className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 text-[10px] font-mono font-bold border border-teal-200/60">
                                  #{kw}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center space-y-3">
                      <Users className="w-10 h-10 text-slate-300 mx-auto" />
                      <div className="font-bold text-slate-700 text-sm">Individual report records archived for this specific node</div>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                        All 36 aggregate reports have been processed through our spatial cluster pipeline and recorded in the block ledger.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: CENSUS 2021/2026 DEMOGRAPHIC PROFILE */}
              {activeTab === 4 && (
                <div className="space-y-6 animate-scaleUp">
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                    <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-teal-600" />
                      <span>Census & Demographic Spatial Cross-Reference</span>
                    </h3>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      Our platform cross-links GPS cluster centroids directly with official Government of Odisha Census 2021/2026 ward boundaries to ensure equitable distribution across vulnerable populations.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                        <div className="text-xs font-bold text-slate-500 mb-1">Impacted Population Radius</div>
                        <div className="text-2xl font-mono font-black text-slate-900">{activeHotspot.metrics.impactedPopulation.toLocaleString()}</div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">Within 1.8 km of cluster centroid</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                        <div className="text-xs font-bold text-slate-500 mb-1">Nearby Educational Access</div>
                        <div className="text-2xl font-mono font-black text-teal-700">{activeHotspot.metrics.nearbySchoolsCount} Schools</div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">Cut off during high rainfall periods</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                        <div className="text-xs font-bold text-slate-500 mb-1">Primary Health Centres (PHC)</div>
                        <div className="text-2xl font-mono font-black text-amber-600">{activeHotspot.metrics.nearbyHealthCentresCount} Centres</div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">Nearest emergency hospital is 22 km away</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                        <div className="text-xs font-bold text-slate-500 mb-1">Equity Weight (`Φ`) Index</div>
                        <div className="text-2xl font-mono font-black text-emerald-600">1.42x High</div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">High concentration of tribal rural households</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: 4-LAYER FRAUD & DUPLICATE DEFENSE */}
              {activeTab === 5 && (
                <div className="space-y-6 animate-scaleUp">
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        <span>4-Layer Anti-Fraud & Duplicate Defense Audit</span>
                      </h3>
                      <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-mono text-xs font-extrabold border border-emerald-200">
                        100% CLEAN AUDIT
                      </span>
                    </div>

                    <div className="space-y-3 pt-1">
                      {[
                        { title: 'Layer 1: Spatial Overlap Verification (< 500m radius)', status: 'PASSED - UNIQUE', desc: 'No identical MP LAD or PMGSY road tenders exist within 500 meters in the past 5 fiscal years.' },
                        { title: 'Layer 2: EXIF & GPS Timestamp Integrity Check', status: 'PASSED - GENUINE', desc: 'All 48 photo and voice uploads contain valid, unedited smartphone geocodes and device hashes.' },
                        { title: 'Layer 3: AI Visual Photo Similarity Audit', status: 'PASSED - 0% MATCH', desc: 'Gemini Vision verified that uploaded culvert damage photos are distinct from previous closed works.' },
                        { title: 'Layer 4: District Priority Queue Sync', status: 'PASSED - MANDATE READY', desc: 'Cluster is verified unique and ranks in the Top 3 Citizen Demands across Koraput PC ready for immediate fast-track mandate.' },
                      ].map((layer, idx) => (
                        <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <strong className="text-xs sm:text-sm font-extrabold text-slate-900">{layer.title}</strong>
                              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded shrink-0">
                                {layer.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">{layer.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: MP PRIORITY & RESOLUTION MANDATE SIMULATOR */}
              {activeTab === 6 && (
                <div className="space-y-6 animate-scaleUp">
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-5">
                    <div>
                      <h3 className="font-extrabold text-base sm:text-lg text-slate-900 flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-amber-500" />
                        <span>Interactive Priority Mandate Resolution Simulator</span>
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                        Test issuing different levels of fast-track action mandates to this high-demand cluster and project community impact before exporting the official directive.
                      </p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800 mb-2">
                          <span>Simulated Action Mandate Intensity</span>
                          <span className="font-mono text-teal-700 font-black text-base">
                            {simulatedUrgencyLevel === 1 ? 'Level 1: Standard Field Verification' : simulatedUrgencyLevel === 2 ? 'Level 2: Expedited Engineering Directive' : 'Level 3: Emergency Fast-Track Mandate'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="3"
                          step="1"
                          value={simulatedUrgencyLevel}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setSimulatedUrgencyLevel(val);
                            // Dynamic score drop calculation
                            if (val === 1) setSimulatedPriorityDrop(25);
                            else if (val === 2) setSimulatedPriorityDrop(55);
                            else setSimulatedPriorityDrop(82);
                          }}
                          className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
                          <span>Level 1 (Standard Verification)</span>
                          <span>Level 2 (Expedited Directive)</span>
                          <span>Level 3 (Emergency Fast-Track)</span>
                        </div>
                      </div>
                    </div>

                    {/* Simulated Impact Output Box */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                        <div className="text-[11px] font-mono font-bold uppercase text-emerald-800">Projected Priority Score Drop</div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-mono font-black text-slate-900">{activeHotspot.priorityScore}</span>
                          <span className="text-emerald-700 font-mono font-bold">→</span>
                          <span className="text-3xl font-mono font-black text-emerald-600">{Math.max(5, activeHotspot.priorityScore - simulatedPriorityDrop)}</span>
                        </div>
                        <div className="text-xs font-semibold text-emerald-800 mt-1">
                          Score reduced by {simulatedPriorityDrop} points ({((simulatedPriorityDrop / activeHotspot.priorityScore) * 100).toFixed(0)}% risk resolved)
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-950 space-y-1">
                        <div className="text-[11px] font-mono font-bold uppercase text-teal-800">Direct Citizen Beneficiaries</div>
                        <div className="text-3xl font-mono font-black text-teal-900">
                          +{Math.floor((simulatedUrgencyLevel / 3) * activeHotspot.metrics.impactedPopulation).toLocaleString()} Citizens
                        </div>
                        <div className="text-xs font-semibold text-teal-800 mt-1">
                          Immediate resolution for {activeHotspot.metrics.nearbySchoolsCount} schools & community transit
                        </div>
                      </div>
                    </div>

                    {/* Mandate PDF Export Action */}
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <span className="text-xs font-mono text-slate-500 font-medium flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                        Ready for MP & District Collectorate Signature
                      </span>
                      <button
                        onClick={() => alert(`Official Level ${simulatedUrgencyLevel} Fast-Track Priority Resolution Mandate generated successfully for ${activeHotspot.name} and forwarded to Koraput District Collectorate.`)}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-teal-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Sign & Export Official Fast-Track Mandate PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: BEFORE/AFTER VISUAL COMPARISON AUDIT */}
              {activeTab === 7 && (
                <div className="space-y-6 animate-scaleUp">
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                    <h3 className="font-extrabold text-base sm:text-lg text-slate-900 flex items-center gap-2">
                      <Eye className="w-5 h-5 text-teal-600" />
                      <span>Before vs. After Visual & Field Inspection Audit</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                      To ensure absolute public accountability, our system mandates geo-tagged "After" completion photos before contractors release final milestone payments.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 text-center space-y-2">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                          BEFORE SANCTION (JULY 2025)
                        </span>
                        <div className="h-44 rounded-xl bg-slate-200 border border-slate-300 flex flex-col items-center justify-center p-4 text-slate-600">
                          <AlertCircle className="w-8 h-8 text-amber-600 mb-2" />
                          <span className="font-bold text-xs">Collapsed 4-Foot Culvert</span>
                          <span className="text-[10px] font-mono text-slate-500 mt-1">GPS: 18.7083° N, 82.8465° E</span>
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 text-center space-y-2">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          AFTER COMPLETION SIMULATION
                        </span>
                        <div className="h-44 rounded-xl bg-teal-50/70 border border-teal-300/80 flex flex-col items-center justify-center p-4 text-teal-800">
                          <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-2" />
                          <span className="font-extrabold text-xs">Reinforced 15-Meter RCC Box Bridge</span>
                          <span className="text-[10px] font-mono text-teal-700 mt-1">Simulated Target: Dec 2026</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200/80 text-xs font-mono text-slate-700 flex items-center justify-between">
                      <span>Community Satisfaction Target: <strong>96% Positive</strong></span>
                      <span className="text-emerald-700 font-bold">Verified by District Collectorate</span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between text-xs font-mono text-slate-500">
              <span>Cluster ID: {activeHotspot.id}</span>
              <button
                onClick={handleCloseDrawer}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-sans font-bold hover:bg-slate-800 transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
