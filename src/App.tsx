import { useState, useEffect } from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { Analytics } from '@vercel/analytics/react';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { ExplorePage } from './pages/ExplorePage';
import { ReportPage } from './pages/ReportPage';
import { DashboardPage } from './pages/DashboardPage';
import { ManagementPage } from './pages/ManagementPage';
import { CitizenStoreProvider, useCitizenStore } from './context/CitizenStoreContext';
import type { Region } from './types';

function RegionStoreSync({ region }: { region: Region }) {
  const { setBaseHotspots } = useCitizenStore();

  useEffect(() => {
    // For nationwide view or any state/district/constituency selection across India,
    // we initialize with a clean base and let the ClusterEngine dynamically cluster real citizen intakes!
    setBaseHotspots([]);
  }, [region, setBaseHotspots]);

  return null;
}

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('landing');
  const [isOnline] = useState<boolean>(true);
  const [region, setRegion] = useState<Region>({
    state: 'All India',
    district: 'Nationwide',
    constituency: 'All India (Nationwide View)',
    isAllIndia: true,
  });

  // Scroll to top instantly on every tab/page change
  const navigateTo = (tab: string) => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setCurrentTab(tab);
  };

  const handleResetToDemoRegion = () => {
    setRegion({
      state: 'All India',
      district: 'Nationwide',
      constituency: 'All India (Nationwide View)',
      isAllIndia: true,
    });
  };

  return (
    <LanguageProvider>
    <CitizenStoreProvider>
      <RegionStoreSync region={region} />
      <div className="min-h-screen bg-[#FAFAFB] text-slate-900 flex flex-col font-sans selection:bg-teal-600 selection:text-white pb-12 sm:pb-16">
        {/* Unified Top Navbar — Handles Brand, Constituency Selector, and all 5 Navigation Tabs! */}
        <Navbar
          currentTab={currentTab}
          onSelectTab={navigateTo}
          region={region}
          onSelectRegion={setRegion}
          isOnline={isOnline}
        />

        {/* Main content wrapper with responsive top padding so mobile 2-row navbar (pt-[140px]) and desktop single-row navbar (md:pt-[96px]) both sit cleanly above the edge-to-edge status ribbon */}
        <main className="flex-1 flex flex-col pt-[140px] md:pt-[96px]">
          {currentTab === 'landing' && (
            <LandingPage
              onNavigate={navigateTo}
              region={region}
              onResetToDemoRegion={handleResetToDemoRegion}
            />
          )}

          {currentTab === 'explore' && (
            <ExplorePage region={region} onNavigate={navigateTo} />
          )}

          {currentTab === 'dashboard' && (
            <DashboardPage region={region} onNavigate={navigateTo} />
          )}

          {currentTab === 'report' && (
            <ReportPage region={region} onSelectRegion={setRegion} onNavigate={navigateTo} />
          )}

          {currentTab === 'management' && (
            <ManagementPage region={region} onNavigate={navigateTo} />
          )}
        </main>
        <Analytics />
      </div>
    </CitizenStoreProvider>
    </LanguageProvider>
  );
}

export default App;
