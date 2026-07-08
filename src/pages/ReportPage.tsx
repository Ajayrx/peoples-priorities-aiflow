import React, { useState } from 'react';
import {
  Send,
  Mic,
  Camera,
  FileText,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  Radio,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Upload,
  Volume2,
  ArrowRight
} from 'lucide-react';
import type { Region, CategoryType } from '../types';

interface ReportPageProps {
  region: Region;
  onNavigate: (tab: string) => void;
}

export const ReportPage: React.FC<ReportPageProps> = ({ region, onNavigate }) => {
  const isDemoRegion = region.constituency.includes('Koraput');

  // Intake mode: 'VOICE' | 'PHOTO' | 'TEXT'
  const [intakeMode, setIntakeMode] = useState<'VOICE' | 'PHOTO' | 'TEXT'>('VOICE');

  // Selected category
  const [category, setCategory] = useState<CategoryType>('Road');

  // GPS Coordinates (simulated locking)
  const [gpsLocked, setGpsLocked] = useState<boolean>(true);
  const [coordinates, setCoordinates] = useState<{ lat: string; lng: string; locationName: string }>({
    lat: '18.7083',
    lng: '82.8465',
    locationName: isDemoRegion ? 'Pottangi Road Ward 4, Semiliguda Block' : `${region.district} Verified GPS Hub`,
  });

  // Voice recording simulation state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [voiceRecorded, setVoiceRecorded] = useState<boolean>(true);
  const [selectedLanguage, setSelectedLanguage] = useState<'ODIA' | 'ENGLISH'>('ODIA');

  // Photo simulation state
  const [photoUploaded, setPhotoUploaded] = useState<boolean>(true);
  const [photoPreviewUrl] = useState<string>('https://images.unsplash.com/photo-1584463667104-122ff1129b11?auto=format&fit=crop&w=600&q=80');

  // Text intake state
  const [textNote, setTextNote] = useState<string>(
    'Semiliguda main block road has a 4-foot deep washout due to heavy rainfall yesterday. 3 local primary schools are cut off and children are unable to travel safely.'
  );

  // Submission success state
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // Simulated AI processing feedback
  const simulatedTranscriptionOdia = 'ସେମିଳିଗୁଡ଼ା ମୁଖ୍ୟ ବ୍ଲକ୍ ରାସ୍ତାରେ ବଡ଼ ଗାତ ଅଛି, ବର୍ଷା ଦିନରେ ପିଲାମାନେ ସ୍କୁଲ୍ ଯାଇପାରୁନାହାନ୍ତି। ତୁରନ୍ତ ମରାମତି ଦରକାର।';
  const simulatedTranscriptionEnglish = 'Semiliguda main block road has severe potholes and a 4-foot washout, during monsoon children cannot go to school. Urgent repair needed immediately.';
  
  const simulatedImageDefect = 'Gemini 3.1 Pro Vision Defect Detection: Severe structural erosion & collapsed box culvert across 15 meters. Water velocity hazard identified.';
  const simulatedConfidence = 96;
  const simulatedUrgency = 'CRITICAL';

  const categoriesList: { id: CategoryType; label: string; icon: string }[] = [
    { id: 'Road', label: 'Roads & Bridges', icon: '🛣️' },
    { id: 'Drainage', label: 'Urban Drainage', icon: '🌊' },
    { id: 'Healthcare', label: 'Healthcare', icon: '🏥' },
    { id: 'Water', label: 'Drinking Water', icon: '🚰' },
    { id: 'Schools', label: 'Schools & Edu', icon: '🏫' },
    { id: 'Electricity', label: 'Electricity', icon: '⚡' },
  ];

  const handleSimulateRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      setVoiceRecorded(true);
    } else {
      setIsRecording(true);
      setVoiceRecorded(false);
      setRecordingSeconds(1);
      const timer = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 6) {
            clearInterval(timer);
            setIsRecording(false);
            setVoiceRecorded(true);
            return 7;
          }
          return prev + 1;
        });
      }, 800);
    }
  };

  const handleRelockGPS = () => {
    setGpsLocked(false);
    setTimeout(() => {
      setCoordinates({
        lat: (18.7000 + Math.random() * 0.02).toFixed(4),
        lng: (82.8400 + Math.random() * 0.02).toFixed(4),
        locationName: 'Pottangi Road Ward 4, Semiliguda Block (GPS Verified)',
      });
      setGpsLocked(true);
    }, 600);
  };

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#FAFAFB] text-slate-900 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-xl w-full bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 text-center space-y-6 animate-scaleUp">
          <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-mono text-xs font-black border border-emerald-200">
              LEDGER ID: #REP-2026-8841 • VERIFIED UNIQUE
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">
              Multimodal Intake Logged Successfully
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-2 leading-relaxed">
              Your report has been verified by <strong className="text-teal-700">Gemini 3.1 Pro AI</strong>, locked to GPS coordinates <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-800">{coordinates.lat}° N, {coordinates.lng}° E</code>, and merged into the <strong>Semiliguda Road Cluster</strong> on our interactive cartographic map.
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-left space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500">Spatial Verification:</span>
              <span className="font-extrabold text-emerald-700">Radius Check Passed (&lt; 500m unique)</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500">Assigned Cluster Priority:</span>
              <span className="font-extrabold text-amber-600">CRITICAL (Score: 94/100)</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500">Status in Priority Queue:</span>
              <span className="font-extrabold text-teal-700">Ranked Top 3 for Fast-Track Mandate</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={() => onNavigate('explore')}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold text-sm shadow-md shadow-teal-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>View Report on Interactive Map</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setIsSubmitted(false);
                setVoiceRecorded(true);
              }}
              className="w-full sm:w-auto py-3.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-colors"
            >
              Submit Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-slate-900 pb-16">
      
      {/* Header Command Strip */}
      <div className="bg-white border-b border-slate-200/80 shadow-xs py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-mono text-xs font-bold">
                <Radio className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
                <span>EXPERIENCE 3</span>
              </span>
              <span className="text-xs font-mono text-slate-400 font-bold">•</span>
              <span className="text-xs font-mono font-bold text-slate-600">
                ACTIVE CANVAS: <strong className="text-slate-900">{region.state} → {region.constituency.replace(' (Demo Region)', '')}</strong>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <span>Multimodal Citizen Voice & Photo Intake Portal</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigate('explore')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-all shadow-sm active:scale-95"
            >
              <span>View Live Map Viewport</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Form Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Step Progress Bar Pill */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
          <div className="flex items-center gap-2 text-teal-700">
            <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center font-mono text-[11px] font-black">1</span>
            <span>Category & GPS Lock</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 hidden sm:block" />
          <div className="flex items-center gap-2 text-slate-900 font-extrabold">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-mono text-[11px] font-black">2</span>
            <span>Multimodal Intake (Voice / Photo / Text)</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 hidden sm:block" />
          <div className="flex items-center gap-2 text-slate-600">
            <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-mono text-[11px] font-black">3</span>
            <span>AI Verification & Cluster Merge</span>
          </div>
        </div>

        <form onSubmit={handleSubmitReport} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN (5 cols): Location Locking & Category Selection */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* 1. GPS Spatial Coordinate Lock Box */}
            <div className="bg-white rounded-[24px] border border-slate-200/90 p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-teal-600" />
                  <h3 className="font-extrabold text-base text-slate-900">1. Spatial GPS Lock</h3>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold flex items-center gap-1 ${gpsLocked ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${gpsLocked ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {gpsLocked ? 'GPS LOCKED' : 'ACQUIRING...'}
                </span>
              </div>

              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Coordinates:</span>
                  <strong className="text-slate-900">{coordinates.lat}° N, {coordinates.lng}° E</strong>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>District / PC:</span>
                  <strong className="text-teal-700">{region.district} ({region.constituency.replace(' (Demo Region)', '')})</strong>
                </div>
                <div className="pt-1 border-t border-slate-200 text-slate-800 font-sans font-extrabold text-xs">
                  📍 {coordinates.locationName}
                </div>
              </div>

              <button
                type="button"
                onClick={handleRelockGPS}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-teal-600 ${!gpsLocked ? 'animate-spin' : ''}`} />
                <span>Relock Smartphone Geocode / Pin on Map</span>
              </button>
            </div>

            {/* 2. Category Selector Pills */}
            <div className="bg-white rounded-[24px] border border-slate-200/90 p-5 shadow-xl space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-base text-slate-900">2. Select Issue Category</h3>
                <p className="text-xs text-slate-500 font-medium">Auto-assigns to the relevant block department</p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {categoriesList.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'bg-teal-50 border-teal-600 text-teal-950 font-extrabold shadow-sm ring-1 ring-teal-500/20 scale-[1.02]'
                          : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-bold'
                      }`}
                    >
                      <span className="text-lg shrink-0">{cat.icon}</span>
                      <span className="text-xs truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4-Layer Security Trust Badge */}
            <div className="bg-emerald-50 rounded-[24px] border border-emerald-200 p-4.5 flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-extrabold text-xs text-emerald-950">Active Anti-Duplicate & Fraud Filter</h4>
                <p className="text-[11px] text-emerald-900/80 font-medium leading-relaxed mt-0.5">
                  Your report undergoes EXIF timestamp verification and spatial DBSCAN clustering within a 500-meter threshold before merging into the MP LAD priority queue.
                </p>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN (7 cols): Multimodal Intake Selector & Live AI Processing Preview */}
          <div className="lg:col-span-7 space-y-6">
            
            <div className="bg-white rounded-[28px] border border-slate-200/90 p-6 shadow-xl space-y-6">
              
              {/* Intake Mode Switcher Tabs */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 flex-wrap gap-3">
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900">3. Choose Intake Method</h3>
                  <p className="text-xs text-slate-500 font-medium">Our AI supports rural voice memos, smartphone photos, and direct text</p>
                </div>

                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                  {[
                    { id: 'VOICE', label: 'Voice Memo', icon: Mic },
                    { id: 'PHOTO', label: 'Photo Inspection', icon: Camera },
                    { id: 'TEXT', label: 'Direct Text', icon: FileText },
                  ].map((mode) => {
                    const Icon = mode.icon;
                    const isActive = intakeMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setIntakeMode(mode.id as any)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'bg-transparent text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{mode.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* MODE 1: VOICE RECORDING (Odia / English) */}
              {intakeMode === 'VOICE' && (
                <div className="space-y-5 animate-scaleUp">
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4 text-teal-600" /> Transcription Language:
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedLanguage('ODIA')}
                        className={`px-3 py-1 rounded-md text-xs font-extrabold transition-all ${selectedLanguage === 'ODIA' ? 'bg-teal-600 text-white shadow-2xs' : 'bg-white text-slate-600 border border-slate-200'}`}
                      >
                        Odia (ଓଡ଼ିଆ)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedLanguage('ENGLISH')}
                        className={`px-3 py-1 rounded-md text-xs font-extrabold transition-all ${selectedLanguage === 'ENGLISH' ? 'bg-teal-600 text-white shadow-2xs' : 'bg-white text-slate-600 border border-slate-200'}`}
                      >
                        English
                      </button>
                    </div>
                  </div>

                  {/* Recording Button Area */}
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-4 bg-slate-50/50">
                    <button
                      type="button"
                      onClick={handleSimulateRecord}
                      className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center transition-all shadow-xl ${
                        isRecording
                          ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-500/30'
                          : voiceRecorded
                          ? 'bg-teal-600 text-white hover:bg-teal-700'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      <Mic className={`w-8 h-8 ${isRecording ? 'animate-bounce' : ''}`} />
                    </button>

                    <div>
                      <h4 className="font-black text-sm sm:text-base text-slate-900">
                        {isRecording ? 'Recording Voice Note... Speak Clearly' : voiceRecorded ? 'Voice Note Recorded Successfully' : 'Click Microphone to Record'}
                      </h4>
                      <p className="text-xs font-mono text-slate-500 mt-1">
                        {isRecording ? `00:0${recordingSeconds} / 00:30 max` : voiceRecorded ? 'Duration: 00:14s • Format: WAV / Opus 16kHz' : 'Supports Odia dialect & English technical terms'}
                      </p>
                    </div>

                    {isRecording && (
                      <div className="flex items-center justify-center gap-1 h-6">
                        {[40, 70, 30, 90, 60, 80, 50, 100, 35, 65].map((h, idx) => (
                          <div
                            key={idx}
                            className="w-1.5 bg-teal-600 rounded-full animate-pulse"
                            style={{ height: `${h}%`, animationDelay: `${idx * 100}ms` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* AI Transcription Result */}
                  {voiceRecorded && !isRecording && (
                    <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-extrabold text-teal-900 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-teal-600" /> Gemini 3.1 Pro Live Transcription ({selectedLanguage})
                        </span>
                        <span className="px-2 py-0.5 rounded bg-teal-200/70 text-teal-900 font-bold">98.4% Accuracy</span>
                      </div>
                      <p className="text-xs sm:text-sm font-serif italic text-slate-800 bg-white p-3 rounded-xl border border-teal-200/60 leading-relaxed">
                        "{selectedLanguage === 'ODIA' ? simulatedTranscriptionOdia : simulatedTranscriptionEnglish}"
                      </p>
                      {selectedLanguage === 'ODIA' && (
                        <div className="pt-1 text-[11px] font-mono text-slate-600">
                          <strong>English Synthesis:</strong> "{simulatedTranscriptionEnglish}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* MODE 2: PHOTO INSPECTION (Gemini Vision) */}
              {intakeMode === 'PHOTO' && (
                <div className="space-y-5 animate-scaleUp">
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-4 bg-slate-50/50">
                    {photoUploaded ? (
                      <div className="space-y-3">
                        <div className="relative max-w-sm mx-auto rounded-xl overflow-hidden shadow-md border border-slate-300">
                          <img src={photoPreviewUrl} alt="Reported defect" className="w-full h-44 object-cover" />
                          <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-xs text-white px-2 py-1 rounded text-[10px] font-mono font-bold">
                            GPS VERIFIED • EXIF GENUINE
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPhotoUploaded(false)}
                          className="text-xs text-teal-700 font-bold hover:underline"
                        >
                          Change photo / Upload another sample
                        </button>
                      </div>
                    ) : (
                      <div className="py-8 space-y-3" onClick={() => setPhotoUploaded(true)}>
                        <Upload className="w-10 h-10 text-teal-600 mx-auto cursor-pointer" />
                        <div className="font-extrabold text-sm text-slate-900 cursor-pointer">Click or drag smartphone photo here</div>
                        <p className="text-xs text-slate-500 font-mono">Supports JPG, PNG, WEBP with embedded geocodes</p>
                      </div>
                    )}
                  </div>

                  {photoUploaded && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-extrabold text-amber-950 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-600" /> AI Visual Defect Assessment
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-bold">Confidence: 96%</span>
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-amber-950 bg-white p-3 rounded-xl border border-amber-200/60 leading-relaxed">
                        {simulatedImageDefect}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* MODE 3: DIRECT TEXT INTAKE */}
              {intakeMode === 'TEXT' && (
                <div className="space-y-4 animate-scaleUp">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Detailed Citizen Description
                    </label>
                    <textarea
                      rows={5}
                      value={textNote}
                      onChange={(e) => setTextNote(e.target.value)}
                      placeholder="Describe the infrastructure gap, exact landmark, and community impact..."
                      className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 font-medium leading-relaxed"
                    />
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1">
                      <span>Suggested Tags: #RoadWashout #KoraputMonsoon</span>
                      <span>{textNote.length} / 500 characters</span>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Verification Summary Banner */}
              <div className="bg-slate-900 rounded-2xl p-5 text-white space-y-3 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-xs font-mono font-extrabold text-teal-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" /> AI Pre-Submission Verification Summary
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500 text-white font-mono text-[10px] font-black">
                    URGENCY: {simulatedUrgency}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 block text-[10px]">VERIFIED DEPARTMENT:</span>
                    <strong className="text-white">{category} Dept • Semiliguda</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">AI CONFIDENCE SCORE:</span>
                    <strong className="text-emerald-400 font-extrabold">{simulatedConfidence}% High</strong>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-slate-400 block text-[10px]">DUPLICATE CLUSTER MERGE:</span>
                    <strong className="text-teal-300 truncate block">Merged → #HS-SEMILIGUDA</strong>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-black text-sm shadow-lg shadow-teal-600/25 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
                >
                  <span>Submit & Verify on Spatial Ledger</span>
                  <Send className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>

        </form>

      </div>
    </div>
  );
};
