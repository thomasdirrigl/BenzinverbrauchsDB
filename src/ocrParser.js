const path = require('path');
const { createWorker } = require('tesseract.js');

const TESSDATA_PATH = path.join(__dirname, '..', 'data', 'tessdata');

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
  const { data } = await worker.recognize(imageBuffer);
  return data.text;
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
  const literKeyword = new RegExp(`${NUMBER}\\s*(?:l|ltr|liter)\\b`, 'gi');
  let m;
  while ((m = literKeyword.exec(text)) !== null) {
    const value = toNumber(m[1]);
    if (value !== null && value > 0.5 && value < 200) candidates.push(value);
  }
  if (candidates.length > 0) return candidates[0];

  const menge = new RegExp(`menge\\D{0,10}${NUMBER}`, 'gi');
  while ((m = menge.exec(text)) !== null) {
    const value = toNumber(m[1]);
    if (value !== null && value > 0.5 && value < 200) return value;
  }
  return null;
}

function extractPreis(text) {
  const keywordLine = new RegExp(
    `(?:gesamt(?:betrag)?|summe|betrag|zu\\s*zahlen|total)\\D{0,10}${NUMBER}\\s*(?:€|eur)?`,
    'gi'
  );
  let m = keywordLine.exec(text);
  if (m) {
    const value = toNumber(m[1]);
    if (value !== null && value > 0 && value < 1000) return value;
  }

  const currency = new RegExp(`${NUMBER}\\s*(?:€|eur)\\b`, 'gi');
  const candidates = [];
  while ((m = currency.exec(text)) !== null) {
    const value = toNumber(m[1]);
    if (value !== null && value > 0 && value < 1000) candidates.push(value);
  }
  if (candidates.length > 0) return Math.max(...candidates);

  return null;
}

function extractKm(text) {
  const keyword = new RegExp(`${NUMBER}\\s*km\\b`, 'gi');
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

module.exports = { recognizeText, extractLiter, extractPreis, extractKm };
