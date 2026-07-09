import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { CitizenReport, Hotspot, DashboardStats } from '../types';
import { CitizenReportService } from '../services/CitizenReportService';

interface CitizenStoreState {
  reports: CitizenReport[];
  hotspots: Hotspot[];
  rankedPriorityList: CitizenReport[];
  stats: DashboardStats;
  isLoading: boolean;
  submitReport: (payload: Partial<CitizenReport> & { photoBase64?: string; detectedIssue?: string; urgencyReasoning?: string; intakeType?: 'VOICE' | 'PHOTO' | 'TEXT' }) => Promise<CitizenReport>;
  updateReport: (id: string, updates: Partial<CitizenReport>) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  setBaseHotspots: (baseList: Hotspot[]) => void;
}

const CitizenStoreContext = createContext<CitizenStoreState | undefined>(undefined);

export const CitizenStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [rankedPriorityList, setRankedPriorityList] = useState<CitizenReport[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalReports: 0,
    criticalReports: 0,
    verifiedReports: 0,
    categoryCounts: {},
    avgAiConfidence: 96,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = CitizenReportService.subscribe((newReports, newHotspots, newStats, newRankedList) => {
      setReports(newReports);
      setHotspots(newHotspots);
      setStats(newStats);
      setRankedPriorityList(newRankedList);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const submitReport = useCallback(async (payload: Partial<CitizenReport> & { photoBase64?: string; detectedIssue?: string; urgencyReasoning?: string; intakeType?: 'VOICE' | 'PHOTO' | 'TEXT' }) => {
    return await CitizenReportService.submitCitizenReport(payload);
  }, []);

  const updateReport = useCallback(async (id: string, updates: Partial<CitizenReport>) => {
    return await CitizenReportService.updateCitizenReport(id, updates);
  }, []);

  const deleteReport = useCallback(async (id: string) => {
    return await CitizenReportService.deleteCitizenReport(id);
  }, []);

  const setBaseHotspots = useCallback((baseList: Hotspot[]) => {
    CitizenReportService.setBaseHotspots(baseList);
  }, []);

  return (
    <CitizenStoreContext.Provider
      value={{
        reports,
        hotspots,
        rankedPriorityList,
        stats,
        isLoading,
        submitReport,
        updateReport,
        deleteReport,
        setBaseHotspots,
      }}
    >
      {children}
    </CitizenStoreContext.Provider>
  );
};

export function useCitizenStore(): CitizenStoreState {
  const context = useContext(CitizenStoreContext);
  if (!context) {
    throw new Error('useCitizenStore must be used within a CitizenStoreProvider');
  }
  return context;
}
