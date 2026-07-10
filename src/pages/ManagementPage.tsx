import React, { useState } from 'react';
import {
  Database,
  CheckCircle2,
  RefreshCw,
  Upload,
  ShieldCheck,
  Layers,
  Activity,
  History,
  Sparkles,
  ArrowRight,
  Terminal
} from 'lucide-react';
import type { Region } from '../types';
import { MOCK_DATASET_HEALTH } from '../data/mockData';
import { useCitizenStore } from '../context/CitizenStoreContext';
import { useLanguage } from '../context/LanguageContext';

interface ManagementPageProps {
  region: Region;
  onNavigate: (tab: string) => void;
}

export const ManagementPage: React.FC<ManagementPageProps> = ({ region, onNavigate }) => {
  const { t } = useLanguage();
  const isDemoRegion = region.constituency.includes('Koraput');

  const { reports } = useCitizenStore();

  const totalGeoRecords = reports.length + MOCK_DATASET_HEALTH.reduce((sum, d) => sum + d.recordsCount, 0);

  // Recalibration pipeline execution simulation
  const [isRecalibrating, setIsRecalibrating] = useState<boolean>(false);
  const [pipelineStep, setPipelineStep] = useState<number>(0);
  const [recalibrationComplete, setRecalibrationComplete] = useState<boolean>(false);

  // Uploaded mock dataset state
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [customFile, setCustomFile] = useState<string | null>(null);

  // Snapshot restoration simulation
  const [activeSnapshot, setActiveSnapshot] = useState<string>('v2.4 - July 2026 (Live Prod)');

  const handleTriggerRecalibration = () => {
    if (isRecalibrating) return;
    setIsRecalibrating(true);
    setRecalibrationComplete(false);
    setPipelineStep(1);

    const steps = [
      { step: 1, delay: 1000 },
      { step: 2, delay: 2000 },
      { step: 3, delay: 3000 },
      { step: 4, delay: 4000 },
    ];

    steps.forEach(({ step, delay }) => {
      setTimeout(() => {
        setPipelineStep(step);
        if (step === 4) {
          setTimeout(() => {
            setIsRecalibrating(false);
            setRecalibrationComplete(true);
          }, 800);
        }
      }, delay);
    });
  };

  const handleMockUpload = () => {
    setCustomFile('Koraput_PC_2026_High_Resolution_Demographics.geojson');
    setUploadSuccess(true);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-slate-900 pb-16">
      
      {/* Header Command Strip */}
      <div className="bg-white border-b border-slate-200/80 shadow-xs py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold text-slate-600">
                {t('admin.pipelineStatus')}: <strong className="text-emerald-700">{t('admin.onlineSync')}</strong>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <span>{t('admin.title')}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigate('dashboard')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-all shadow-sm active:scale-95"
            >
              <span>{t('admin.backToDashboard')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Top Metrics Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-mono font-bold text-slate-400 uppercase">Total Geo Records</div>
              <div className="text-xl font-mono font-black text-slate-900 mt-0.5">{totalGeoRecords.toLocaleString()}</div>
            </div>
          </div>

          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-mono font-bold text-slate-400 uppercase">Schema Integrity</div>
              <div className="text-xl font-mono font-black text-emerald-700 mt-0.5">99.4% Verified</div>
            </div>
          </div>

          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-mono font-bold text-slate-400 uppercase">Active GIS Layers</div>
              <div className="text-xl font-mono font-black text-slate-900 mt-0.5">5 Core Vectors</div>
            </div>
          </div>

          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-mono font-bold text-slate-400 uppercase">Last Sync Status</div>
              <div className="text-xl font-mono font-black text-teal-700 mt-0.5">Just now</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN (7 cols): Dataset Health Ledger Table */}
          <div className="lg:col-span-7 bg-white rounded-[28px] border border-slate-200/90 shadow-xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                  <Database className="w-5 h-5 text-teal-600" />
                  <span>{t('admin.verifiedDatasets')}</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Automated schema validation and GIS spatial index integrity</p>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200 text-teal-800 font-mono text-[10px] font-extrabold">
                {activeSnapshot}
              </span>
            </div>

            <div className="space-y-3">
              {MOCK_DATASET_HEALTH.map((ds) => {
                const isVerified = ds.status === 'Verified';
                return (
                  <div
                    key={ds.id}
                    className="p-4 rounded-2xl bg-[#FAFAFB] border border-slate-200/80 hover:bg-slate-50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isVerified ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <strong className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                          {ds.datasetName} {isDemoRegion ? '' : `(${region.district})`}
                        </strong>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        Version: <strong className="text-slate-800">{ds.version}</strong> • Updated: {ds.lastUpdated}
                      </div>
                      <div className="text-[11px] font-mono font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200/60 inline-block">
                        {ds.validationSummary}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="text-right font-mono">
                        <div className="text-sm font-black text-slate-900">{ds.recordsCount.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400 uppercase">Records</div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-black ${
                        isVerified ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {ds.status}
                      </span>
                    </div>
                  </div>
                );
              })}

              {uploadSuccess && customFile && (
                <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-between animate-scaleUp">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
                    <div>
                      <div className="text-xs font-black text-teal-950">{customFile}</div>
                      <div className="text-[10px] font-mono text-teal-800">412 Records • v1.0 Custom Upload • Verified Schema</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-teal-600 text-white font-mono text-[10px] font-extrabold">NEWLY INGESTED</span>
                </div>
              )}
            </div>

            {/* Upload Mock GeoJSON Dataset Area */}
            <div className="pt-3 border-t border-slate-100">
              <button
                onClick={handleMockUpload}
                className="w-full py-3.5 px-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-teal-400 bg-slate-50/50 hover:bg-teal-50/30 text-slate-700 hover:text-teal-900 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4 text-teal-600" />
                <span>{t('admin.uploadBtn')}</span>
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN (5 cols): Recalibration Engine & Version Snapshots */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Backend Recalibration Trigger Panel */}
            <div className="bg-white rounded-[28px] border border-slate-200/90 shadow-xl p-5 sm:p-6 space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-amber-600" />
                  <span>{t('admin.dbscanTitle')}</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Triggers full backend re-clustering across all {totalGeoRecords.toLocaleString()} records and recalculates formula weights
                </p>
              </div>

              {/* Execution Progress UI */}
              <div className="bg-slate-900 rounded-2xl p-4 text-white font-mono text-xs space-y-3 shadow-md">
                <div className="flex items-center justify-between text-slate-400 text-[11px] border-b border-slate-800 pb-2">
                  <span>EXECUTION LOG</span>
                  <span className="text-teal-400 font-bold">{isRecalibrating ? 'RUNNING PIPELINE...' : recalibrationComplete ? 'COMPLETE' : 'IDLE'}</span>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className={pipelineStep >= 1 ? 'text-emerald-400 font-bold' : 'text-slate-600'}>
                      {pipelineStep >= 1 ? '✓' : '1.'}
                    </span>
                    <span>Ingesting {totalGeoRecords.toLocaleString()} spatial vector items & EXIF hashes</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className={pipelineStep >= 2 ? 'text-emerald-400 font-bold' : 'text-slate-600'}>
                      {pipelineStep >= 2 ? '✓' : '2.'}
                    </span>
                    <span>Running DBSCAN spatial density clustering (&lt; 500m)</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className={pipelineStep >= 3 ? 'text-emerald-400 font-bold' : 'text-slate-600'}>
                      {pipelineStep >= 3 ? '✓' : '3.'}
                    </span>
                    <span>Calculating 8-Factor priority coefficients ($D \times S \times P$)</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className={pipelineStep >= 4 ? 'text-emerald-400 font-bold' : 'text-slate-600'}>
                      {pipelineStep >= 4 ? '✓' : '4.'}
                    </span>
                    <span>Re-indexing vector tiles & syncing live map cache</span>
                  </div>
                </div>

                {recalibrationComplete && (
                  <div className="pt-2 border-t border-slate-800 text-emerald-400 font-bold flex items-center gap-1.5 animate-scaleUp text-xs">
                    <Sparkles className="w-4 h-4" /> Pipeline Recalibration Complete in 3.42s!
                  </div>
                )}
              </div>

              <button
                disabled={isRecalibrating}
                onClick={handleTriggerRecalibration}
                className={`w-full py-3.5 px-6 rounded-xl font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                  isRecalibrating
                    ? 'bg-amber-500 text-white animate-pulse cursor-wait'
                    : 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white active:scale-95 shadow-teal-600/25'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${isRecalibrating ? 'animate-spin' : ''}`} />
                <span>{isRecalibrating ? (t('nav.home') === 'Home' ? 'Recalibrating Spatial Clusters...' : t('nav.home') === 'होम' ? 'स्थानिक समूहों का पुनर्गठन...' : t('nav.home') === 'ହୋମ' ? 'ସ୍ଥାନୀୟ କ୍ଲଷ୍ଟର୍ ପୁନର୍ଗଠନ ଚାଲିଛି...' : 'ప్రాంతీయ క్లస్టర్ల పునర్వ్యవస్థీకరణ...') : t('admin.triggerBtn')}</span>
              </button>
            </div>

            {/* Version Timeline & Rollback Snapshots */}
            <div className="bg-white rounded-[28px] border border-slate-200/90 shadow-xl p-5 sm:p-6 space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-teal-600" />
                  <span>{t('admin.snapshotRollback')}</span>
                </h3>
              </div>

              <div className="space-y-2.5">
                {[
                  'v2.4 - July 2026 (Live Prod)',
                  'v2.3 - June 2026 (Pre-Monsoon Model)',
                  'v2.2 - May 2026 (Baseline Census Sync)',
                ].map((snap) => {
                  const isActive = activeSnapshot === snap;
                  return (
                    <div
                      key={snap}
                      onClick={() => setActiveSnapshot(snap)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs font-mono font-bold ${
                        isActive
                          ? 'bg-teal-50 border-teal-600 text-teal-950 ring-1 ring-teal-500/20'
                          : 'bg-[#FAFAFB] border-slate-200/80 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{snap}</span>
                      {isActive ? (
                        <span className="px-2 py-0.5 rounded bg-teal-600 text-white text-[10px]">ACTIVE</span>
                      ) : (
                        <span className="text-[10px] text-teal-700 hover:underline">Restore</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
