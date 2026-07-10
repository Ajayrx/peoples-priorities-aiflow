import React, { useState, useEffect } from 'react';
import { Cloud, Key, CheckCircle2, AlertTriangle, X, ShieldCheck, Sparkles, Database, ExternalLink } from 'lucide-react';
import { getCloudConfig, saveCloudConfig, hasValidGeminiKey, hasValidFirebaseConfig, type CloudConfigState } from '../services/cloudConfig';

interface CloudConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudConfigModal: React.FC<CloudConfigModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<CloudConfigState>(getCloudConfig());
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(getCloudConfig());
      setIsSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveCloudConfig(config);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1200);
  };

  const isGeminiReady = hasValidGeminiKey() || (config.geminiApiKey.length > 15 && config.geminiApiKey.startsWith('AIza'));
  const isFirebaseReady = hasValidFirebaseConfig() || Boolean(config.firebaseConfig.apiKey && config.firebaseConfig.projectId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
      <div className="bg-white rounded-[28px] border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden text-slate-900 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/40 text-teal-400 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <span>Real-Time Cloud & Gemini Vision Setup</span>
                <span className="text-[10px] font-mono bg-teal-950 text-teal-400 px-2 py-0.5 rounded border border-teal-800">
                  DUAL MODE
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Configure keys for live Vercel deployment or test instantly in Real-Time Session Mode
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 overflow-y-auto space-y-5">
          
          {/* Gemini API Key Section */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
                <Key className="w-4 h-4 text-teal-600" />
                <span>Google Gemini API Key (for Live Photo Vision Evaluation)</span>
              </label>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
                isGeminiReady ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {isGeminiReady ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                {isGeminiReady ? 'CONNECTED' : 'SIMULATION MODE'}
              </span>
            </div>

            <input
              type="password"
              placeholder="AIzaSy... (Paste your Gemini API key here)"
              value={config.geminiApiKey}
              onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 font-mono text-xs text-slate-800 outline-none transition-all"
            />

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>If empty or rate-limited (`429`), our engine uses dual-mode client-side Vision AI.</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-teal-700 font-bold hover:underline inline-flex items-center gap-1"
              >
                <span>Get Free Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Troubleshooting Guide for 400, 403, 404, 429 */}
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2.5 text-[11px] text-amber-900 font-medium space-y-1 mt-2">
              <div className="font-extrabold flex items-center gap-1 text-amber-950">
                <span>💡 Gemini API Status & Quota Troubleshooting:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[10px] text-amber-900 font-mono leading-relaxed">
                <li><b>429 (TooManyRequests):</b> Free API Studio quota hit (`15 RPM`). Our engine automatically falls back to High-Precision Client-Side Vision so you are never blocked.</li>
                <li><b>403 (Forbidden):</b> Verify in GCP Console that "Generative Language API" is enabled and not restricted by HTTP referrer/IP.</li>
                <li><b>404 / 400:</b> Auto-mitigated by our tiered multi-model fallback (`gemini-1.5-flash` → `gemini-1.5-pro`).</li>
              </ul>
            </div>
          </div>

          {/* Firebase Cloud Sync Section */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-teal-600" />
                <span>Firebase Cloud Firestore (Real-Time Sync across PC, Phone & Dashboard)</span>
              </label>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
                isFirebaseReady ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-teal-100 text-teal-800 border border-teal-300'
              }`}>
                {isFirebaseReady ? <CheckCircle2 className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                {isFirebaseReady ? 'FIRESTORE ACTIVE' : 'LOCAL REAL-TIME BUS'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-600 uppercase mb-1 block">API Key</span>
                <input
                  type="text"
                  placeholder="AIzaSy... (Firebase API Key)"
                  value={config.firebaseConfig.apiKey || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    firebaseConfig: { ...config.firebaseConfig, apiKey: e.target.value }
                  })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 focus:border-teal-500 font-mono text-xs text-slate-800 outline-none"
                />
              </div>

              <div>
                <span className="text-[10px] font-mono font-bold text-slate-600 uppercase mb-1 block">Project ID</span>
                <input
                  type="text"
                  placeholder="peoples-priorities-cloud"
                  value={config.firebaseConfig.projectId || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    firebaseConfig: {
                      ...config.firebaseConfig,
                      projectId: e.target.value,
                    }
                  })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 focus:border-teal-500 font-mono text-xs text-slate-800 outline-none"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-500 font-medium">
              With Firebase Cloud Firestore active (`citizen_reports` collection), any civic complaint or photo submitted from your PC, smartphone, or tablet is automatically compressed below 1MB and synced instantaneously via `onSnapshot` across every open device and dashboard!
            </p>
          </div>

          {/* Vercel Deployment Recommendation Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-900 to-slate-900 text-white space-y-2 text-xs">
            <div className="font-extrabold text-teal-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Recommended Live Deployment: VERCEL</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              For real-time smartphone photo capture (`capture="environment"`), your live app must run over HTTPS. <strong>Vercel</strong> provides instant global SSL, zero-config Vite React CDN, and direct GitHub continuous deployment from your repository: <code>github.com/Ajayrx/People-s-Priorities</code>.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold text-xs shadow-md shadow-teal-600/20 active:scale-95 transition-all flex items-center gap-2"
            >
              {isSaved ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Cloud className="w-4 h-4" />}
              <span>{isSaved ? 'Config Saved & Synced!' : 'Save & Activate Cloud Mode'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
