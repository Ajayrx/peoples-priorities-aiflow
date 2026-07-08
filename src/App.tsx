import { useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { ExplorePage } from './pages/ExplorePage';
import { ReportPage } from './pages/ReportPage';
import { DashboardPage } from './pages/DashboardPage';
import { ManagementPage } from './pages/ManagementPage';

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('landing');
  const [isOnline] = useState<boolean>(true);
  const [region, setRegion] = useState<{ state: string; district: string; constituency: string }>({
    state: 'Odisha',
    district: 'Koraput District',
    constituency: 'Koraput PC (Demo Region)',
  });

  const handleResetToDemoRegion = () => {
    setRegion({
      state: 'Odisha',
      district: 'Koraput District',
      constituency: 'Koraput PC (Demo Region)',
    });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-slate-900 flex flex-col font-sans selection:bg-teal-600 selection:text-white pb-12 sm:pb-16">
      {/* Unified Top Navbar — Handles Brand, Constituency Selector, and all 5 Navigation Tabs! */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        region={region}
        onSelectRegion={setRegion}
        isOnline={isOnline}
      />

      {/* Main content wrapper with responsive top padding so mobile 2-row navbar (pt-[140px]) and desktop single-row navbar (md:pt-[96px]) both sit cleanly above the edge-to-edge status ribbon */}
      <main className="flex-1 flex flex-col pt-[140px] md:pt-[96px]">
        {currentTab === 'landing' && (
          <LandingPage 
            onNavigate={setCurrentTab} 
            region={region}
            onResetToDemoRegion={handleResetToDemoRegion}
          />
        )}

        {currentTab === 'explore' && (
          <ExplorePage region={region} onNavigate={setCurrentTab} />
        )}

        {currentTab === 'dashboard' && (
          <DashboardPage region={region} onNavigate={setCurrentTab} />
        )}

        {currentTab === 'report' && (
          <ReportPage region={region} onNavigate={setCurrentTab} />
        )}

        {currentTab === 'management' && (
          <ManagementPage region={region} onNavigate={setCurrentTab} />
        )}
      </main>
      <Analytics />
    </div>
  );
}

export default App;
