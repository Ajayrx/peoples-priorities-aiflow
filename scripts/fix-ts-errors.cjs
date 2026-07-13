const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;
  
  for (const { from, to } of replacements) {
    content = content.replace(from, to);
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${path.relative(srcDir, filePath)}`);
  }
}

// 1. ExplorePage.tsx
const explorePage = path.join(srcDir, 'pages', 'ExplorePage.tsx');
if (fs.existsSync(explorePage)) {
  replaceInFile(explorePage, [
    { from: /rep\.address/g, to: 'rep.location.blockOrTown' },
    { from: /rep\.latitude/g, to: 'rep.location.lat' },
    { from: /rep\.longitude/g, to: 'rep.location.lng' },
    { from: /rep\.rawMediaUrl/g, to: 'rep.photoBase64' },
    { from: /report\.rawMediaUrl/g, to: 'report.photoBase64' },
    { from: /report\.address/g, to: 'report.location.blockOrTown' },
    { from: /report\.latitude/g, to: 'report.location.lat' },
    { from: /report\.longitude/g, to: 'report.location.lng' },
    { from: /\(kw, i\)/g, to: '(kw: string, i: number)' } // Fix TS7006
  ]);
}

// 2. LandingPage.tsx
const landingPage = path.join(srcDir, 'pages', 'LandingPage.tsx');
if (fs.existsSync(landingPage)) {
  replaceInFile(landingPage, [
    { from: /rep\.address/g, to: 'rep.location.blockOrTown' },
    { from: /rep\.priority/g, to: 'rep.priorityLevel' }
  ]);
}

// 3. ReportPage.tsx
const reportPage = path.join(srcDir, 'pages', 'ReportPage.tsx');
if (fs.existsSync(reportPage)) {
  replaceInFile(reportPage, [
    { from: /name: '',/g, to: '' },
    { from: /name: 'Demo Citizen',/g, to: '' }
  ]);
}

// 4. CitizenReportService.ts
const crs = path.join(srcDir, 'services', 'CitizenReportService.ts');
if (fs.existsSync(crs)) {
  replaceInFile(crs, [
    { from: /this\.normalizeReport/g, to: 'normalizeCitizenReportDocument("local", ' }, // Dirty fix for old normalizer calls, I will fix manually though
  ]);
}

// 5. ClusterEngine.ts
const clusterEngine = path.join(srcDir, 'services', 'ClusterEngine.ts');
if (fs.existsSync(clusterEngine)) {
  replaceInFile(clusterEngine, [
    { from: /rep\.hotspotId/g, to: 'rep.assignedHotspotId' } // wait, assignedHotspotId isn't on CitizenReport either. I will add it to types.
  ]);
}

console.log("Replacements done.");
