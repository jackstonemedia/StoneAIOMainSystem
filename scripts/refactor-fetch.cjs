const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      if (dirPath.endsWith('.ts') || dirPath.endsWith('.tsx')) {
        callback(dirPath);
      }
    }
  });
}

let modifiedCount = 0;
const srcDir = path.join(__dirname, '../src');
const apiClientPath = path.join(srcDir, 'lib', 'apiClient.ts');

walkDir(srcDir, (filePath) => {
  // skip apiClient.ts itself
  if (filePath === apiClientPath) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // We are looking for exactly "fetch('/api/" or "fetch(`/api/"
  // We need to match fetch(...) where the url starts with /api
  const regex = /\bfetch\((['"`])\/api\//g;
  
  if (regex.test(content)) {
    // Determine relative path to apiClient
    let relPath = path.relative(path.dirname(filePath), path.join(srcDir, 'lib', 'apiClient'));
    // Ensure it starts with ./ or ../
    if (!relPath.startsWith('.')) relPath = './' + relPath;
    // Replace backslashes with forward slashes for imports
    relPath = relPath.replace(/\\/g, '/');

    // Make sure we are not already importing apiFetch
    if (!content.includes('import { apiFetch }')) {
        // Find the last import statement or start of file
        const lines = content.split('\n');
        let lastImportIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('import ')) {
                lastImportIndex = i;
            }
        }
        
        const importStatement = `import { apiFetch } from '${relPath}';`;
        if (lastImportIndex !== -1) {
            lines.splice(lastImportIndex + 1, 0, importStatement);
        } else {
            lines.unshift(importStatement);
        }
        content = lines.join('\n');
    }

    // Replace fetch with apiFetch
    content = content.replace(regex, "apiFetch($1/api/");
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
    modifiedCount++;
  }
});

console.log(`\nFinished replacing fetch() in ${modifiedCount} files.`);
