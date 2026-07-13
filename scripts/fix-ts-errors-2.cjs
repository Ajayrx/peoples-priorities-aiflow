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
replaceInFile(path.join(srcDir, 'pages', 'ExplorePage.tsx'), [
  { from: /rep\.latitude/g, to: 'rep.location.lat' },
  { from: /rep\.longitude/g, to: 'rep.location.lng' },
  { from: /rep\.rawMediaUrl/g, to: 'rep.photoBase64' }
]);

// 2. LandingPage.tsx
replaceInFile(path.join(srcDir, 'pages', 'LandingPage.tsx'), [
  { from: /rep\.priority/g, to: 'rep.priorityLevel' },
  { from: /rep\.address/g, to: 'rep.location.blockOrTown' }
]);

// 3. ReportPage.tsx
replaceInFile(path.join(srcDir, 'pages', 'ReportPage.tsx'), [
  { from: /name: '',\n/g, to: '' },
  { from: /name: 'Demo Citizen',\n/g, to: '' }
]);

// 4. CitizenReportService.ts - remove `toLiveReports` entirely
let crsContent = fs.readFileSync(path.join(srcDir, 'services', 'CitizenReportService.ts'), 'utf-8');
crsContent = crsContent.replace(/import type \{ LiveCitizenReport \} from '\.\/liveCloudBus';/, '');
crsContent = crsContent.replace(/\/\*\*[\s\S]*?toLiveReports[\s\S]*?\}\n/m, ''); // Try to remove the method
crsContent = crsContent.replace(/this\.toLiveReports\(\[([^\]]+)\]\)\[0\]/g, '$1');
crsContent = crsContent.replace(/this\.toLiveReports\(reports\)/g, 'reports');
fs.writeFileSync(path.join(srcDir, 'services', 'CitizenReportService.ts'), crsContent, 'utf-8');

// 5. liveCloudBus.ts - fix broken mock data
let lcbContent = fs.readFileSync(path.join(srcDir, 'services', 'liveCloudBus.ts'), 'utf-8');
lcbContent = lcbContent.replace(/isRealCloudItem: true,/g, '');
lcbContent = lcbContent.replace(/name: '.*?',/g, '');
lcbContent = lcbContent.replace(/clientSubmissionId: undefined/g, 'clientSubmissionId: "mock"'); // string | undefined fix
fs.writeFileSync(path.join(srcDir, 'services', 'liveCloudBus.ts'), lcbContent, 'utf-8');

console.log("Cleanup done.");
