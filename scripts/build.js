// scripts/build.js — copies web assets to www/ for Capacitor
const fs   = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const www  = path.join(root, 'www');

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const file of fs.readdirSync(srcDir)) {
    const s = path.join(srcDir, file);
    const d = path.join(destDir, file);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else copy(s, d);
  }
}

copy(path.join(root, 'index.html'), path.join(www, 'index.html'));
copyDir(path.join(root, 'css'),    path.join(www, 'css'));
copyDir(path.join(root, 'js'),     path.join(www, 'js'));
copyDir(path.join(root, 'assets'), path.join(www, 'assets'));

console.log('✓ www/ updated');
