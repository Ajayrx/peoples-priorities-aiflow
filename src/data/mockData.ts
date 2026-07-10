import type { Hotspot, DatasetHealthRecord } from '../types';

export const MOCK_HOTSPOTS: Hotspot[] = [];

export const MOCK_DATASET_HEALTH: DatasetHealthRecord[] = [
  {
    id: 'ds-1',
    datasetName: 'Census_India_2021_2026_Blocks_Districts.json',
    status: 'Verified',
    lastUpdated: '2 days ago',
    recordsCount: 6419,
    validationSummary: '0 Errors (100% Valid Schema — All 6,419 Block & Ward demographic figures verified across 36 States/UTs)',
    version: 'v3.1 Active',
  },
  {
    id: 'ds-2',
    datasetName: 'National_Schools_Network_UDISE_Plus.geojson',
    status: 'Verified',
    lastUpdated: '5 days ago',
    recordsCount: 1482000,
    validationSummary: '0 Errors (100% Valid GeoJSON — 14.82 Lakh primary & secondary schools geotagged nationwide)',
    version: 'v2.8 Active',
  },
  {
    id: 'ds-3',
    datasetName: 'Ayushman_Bharat_Health_SubCentres_Network.geojson',
    status: 'Verified',
    lastUpdated: 'Yesterday',
    recordsCount: 161000,
    validationSummary: '0 Errors (1,61,000 PHC, CHC & Wellness Centres verified with exact GPS polylines)',
    version: 'v3.0 Active',
  },
  {
    id: 'ds-4',
    datasetName: 'PMGSY_All_Weather_Road_Network_India.geojson',
    status: 'Verified',
    lastUpdated: '12 hours ago',
    recordsCount: 720000,
    validationSummary: '0 Errors (100% Valid — 7.20 Lakh km rural & urban road segments mapped)',
    version: 'v4.2 Active',
  },
  {
    id: 'ds-5',
    datasetName: 'MPLAD_Sanctioned_Works_All_India_2025_2026.json',
    status: 'Verified',
    lastUpdated: 'Just now',
    recordsCount: 543,
    validationSummary: '0 Errors (Synced with National Treasury & MPLAD e-SAKSHI Portal across all 543 Parliamentary Constituencies)',
    version: 'v3.5 Active',
  },
];
