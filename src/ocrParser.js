const path = require('path');
const sharp = require('sharp');
const { createWorker } = require('tesseract.js');

const TESSDATA_PATH = path.join(__dirname, '..', 'data', 'tessdata');

// Handyfotos sind oft 20+ Megapixel und tragen die tatsaechliche Ausrichtung
// nur als EXIF-Flag (Rohpixel bleiben "quer"). Tesseract liest Rohpixel ohne
// EXIF zu beachten und liefert bei zu grossen/falsch gedrehten Bildern
// praktisch nur noch Datenmuell. .rotate() ohne Argumente wendet die
// EXIF-Orientation an und entfernt sie danach; resize begrenzt die laengste
// Seite auf ein Mass, mit dem Tesseract zuverlaessig und schnell arbeitet.
async function preprocessImage(imageBuffer) {
  // PNG (verlustfrei) statt JPEG: eine erneute verlustbehaftete Kompression
  // erzeugt Artefakte an Ziffernkanten, die OCR-Ergebnisse verfaelschen koennen.
  return sharp(imageBuffer)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
}

let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(['deu', 'eng'], undefined, {
      langPath: TESSDATA_PATH,
      cachePath: TESSDATA_PATH,
    });
  }
  return workerPromise;
}

async function recognizeText(imageBuffer) {
  const worker = await getWorker();
  const processed = await preprocessImage(imageBuffer);
  const { data } = await worker.recognize(processed);
  return { text: data.text, confidence: data.confidence };
}

function toNumber(rawMatch) {
  const normalized = rawMatch.replace(/\./g, '').replace(',', '.');
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

// German-style decimal number, e.g. "12,34" or "1.234,56" or "12.5"
const NUMBER = '(\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{1,3})?|\\d+[.,]\\d{1,3})';

function extractLiter(text) {
  const candidates = [];
  // Fuehrendes \b verhindert, dass z. B. aus "4196" faelschlich "196" herausgeschnitten wird.
  const literKeyword = new RegExp(`\\b${NUMBER}\\s*(?:l|ltr|liter)\\b`, 'gi');
  let m;
  while ((m = literKeyword.exec(text)) !== null) {
    const value = toNumber(m[1]);
    if (value !== null && value > 0.5 && value < 200) candidates.push(value);
  }
  if (candidates.length > 0) return candidates[0];

  const menge = new RegExp(`menge\\D{0,10}\\b${NUMBER}`, 'gi');
  while ((m = menge.exec(text)) !== null) {
    const value = toNumber(m[1]);
    if (value !== null && value > 0.5 && value < 200) return value;
  }
  return null;
}

function extractPreis(text) {
  // "Maximalbetrag" auf Kartenzahlungsbelegen ist das Autorisierungslimit der
  // Karte, nicht der tatsaechlich gezahlte Betrag (der steht meist direkt
  // danach als "Verfuegungsbetrag"/"Gesamtbetrag"). (?<!maximal) verhindert,
  // dass die generische "betrag"-Regel faelschlich dort zuschlaegt.
  const keywordLine = new RegExp(
    `(?:gesamt(?:betrag)?|summe|(?<!maximal)betrag|zu\\s*zahlen|total)\\D{0,10}\\b${NUMBER}\\s*(?:€|eur)?`,
    'gi'
  );
  let m = keywordLine.exec(text);
  if (m) {
    const value = toNumber(m[1]);
    if (value !== null && value > 0 && value < 1000) return value;
  }

  const currency = new RegExp(`\\b${NUMBER}\\s*(?:€|eur)\\b`, 'gi');
  const candidates = [];
  while ((m = currency.exec(text)) !== null) {
    const value = toNumber(m[1]);
    if (value !== null && value > 0 && value < 1000) candidates.push(value);
  }
  if (candidates.length > 0) return Math.max(...candidates);

  return null;
}

function extractAllNumbers(text) {
  const re = new RegExp(NUMBER, 'g');
  const numbers = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const value = toNumber(m[1]);
    if (value !== null) numbers.push(value);
  }
  return numbers;
}

// Fallback fuer Zapfsaeulen-Displays ohne erkennbare Beschriftung (z. B. "MENGE"/"SUMME"),
// die nur die nackten Zahlen anzeigen. Nutzt die typische Groessenordnung:
// Gesamtbetrag ist die groesste Zahl, die Literzahl liegt meist zwischen 3 und 200
// und ist groesser als der Literpreis (der ueblicherweise unter 3 liegt).
function extractLiterUndPreisFallback(text) {
  const nums = extractAllNumbers(text).filter((n) => n > 0 && n < 1000);
  if (nums.length < 2) return { liter: null, preis: null };

  const preis = Math.max(...nums);
  const literKandidaten = nums.filter((n) => n !== preis && n >= 3 && n <= 200);
  const liter = literKandidaten.length > 0 ? Math.max(...literKandidaten) : null;

  return { liter, preis };
}

function extractKm(text) {
  const keyword = new RegExp(`\\b${NUMBER}\\s*km\\b`, 'gi');
  const candidates = [];
  let m;
  while ((m = keyword.exec(text)) !== null) {
    const value = toNumber(m[1]);
    if (value !== null && value > 0 && value < 5000) candidates.push(value);
  }
  if (candidates.length > 0) return candidates[0];

  const bare = new RegExp(`\\b${NUMBER}\\b`, 'g');
  while ((m = bare.exec(text)) !== null) {
    const value = toNumber(m[1]);
    if (value !== null && value > 0 && value < 5000 && m[1].includes(',')) {
      candidates.push(value);
    }
  }
  if (candidates.length > 0) return candidates[0];

  return null;
}

module.exports = {
  recognizeText,
  extractLiter,
  extractPreis,
  extractKm,
  extractLiterUndPreisFallback,
};
