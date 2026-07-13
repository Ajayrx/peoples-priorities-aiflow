const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'services', 'liveCloudBus.ts');

let content = fs.readFileSync(filePath, 'utf-8');

// Replace LiveCitizenReport with CitizenReport
content = content.replace(/LiveCitizenReport/g, 'CitizenReport');

// Replace 'types' imports to import CitizenReport directly
if (!content.includes('import type { CitizenReport')) {
  content = content.replace(/import type { CategoryType, PriorityLevel } from '\.\.\/types';/g, "import type { CategoryType, PriorityLevel, CitizenReport } from '../types';");
}

// Remove the LiveCitizenReport interface definition since we import CitizenReport now
content = content.replace(/export interface CitizenReport \{[\s\S]*?\n\}\n/m, ''); // This might be brittle, let's just delete the block
content = content.replace(/export interface CitizenReport \{[^]*?location: \{[^]*?\};[^]*?\}/, ''); // more specific

// In publishLocalityReport we construct a new report. We need to use normalizeCitizenReportDocument or just create a raw payload and call CitizenReportService.
// Wait, publishLocalityReport is a duplicate of CitizenReportService.submitCitizenReport!
// Let's check if it's used at all.

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed liveCloudBus.ts');
