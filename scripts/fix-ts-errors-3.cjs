const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const replacements = [
  { from: /\.latitude/g, to: '.location.lat' },
  { from: /\.longitude/g, to: '.location.lng' },
  { from: /\.rawMediaUrl/g, to: '.photoBase64' },
  { from: /\.priority\b/g, to: '.priorityLevel' },
  { from: /\.address\b/g, to: '.location.blockOrTown' },
];

walkDir(srcDir, (filePath) => {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
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
});

// Also manually fix `name` in ReportPage.tsx
const reportPage = path.join(srcDir, 'pages', 'ReportPage.tsx');
if (fs.existsSync(reportPage)) {
  let rpContent = fs.readFileSync(reportPage, 'utf-8');
  rpContent = rpContent.replace(/name: '',\s*/g, '');
  rpContent = rpContent.replace(/name: 'Demo Citizen',\s*/g, '');
  fs.writeFileSync(reportPage, rpContent, 'utf-8');
}

console.log("Global replace done.");
