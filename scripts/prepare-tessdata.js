// Kopiert die Tesseract-Sprachdaten aus den npm-Paketen @tesseract.js-data/*
// in ein lokales Cache-Verzeichnis. So laedt tesseract.js die Trainingsdaten
// beim Start aus dem lokalen Dateisystem statt von einem externen CDN.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGET_DIR = path.join(ROOT, 'data', 'tessdata');

const LANGS = ['eng', 'deu'];

fs.mkdirSync(TARGET_DIR, { recursive: true });

for (const lang of LANGS) {
  const source = path.join(ROOT, 'node_modules', '@tesseract.js-data', lang, '4.0.0_best_int', `${lang}.traineddata.gz`);
  const target = path.join(TARGET_DIR, `${lang}.traineddata.gz`);
  if (!fs.existsSync(source)) {
    console.warn(`[prepare-tessdata] Quelle nicht gefunden, ueberspringe: ${source}`);
    continue;
  }
  fs.copyFileSync(source, target);
  console.log(`[prepare-tessdata] ${lang}.traineddata.gz bereitgestellt.`);
}
