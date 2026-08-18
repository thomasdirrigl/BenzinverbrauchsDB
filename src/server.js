const path = require('path');
const express = require('express');
const multer = require('multer');
const db = require('./db');
const {
  recognizeText,
  extractLiter,
  extractPreis,
  extractKm,
  extractLiterUndPreisFallback,
} = require('./ocrParser');

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Nur Bilddateien sind erlaubt.'));
    }
    cb(null, true);
  },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

app.post('/api/ocr/kassenbon', upload.single('foto'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Kein Foto empfangen.' });
  try {
    const text = await recognizeText(req.file.buffer);

    let liter = extractLiter(text);
    let preis = extractPreis(text);
    let geschaetzt = false;

    // Fallback fuer Zapfsaeulen-Displays ohne erkennbare Beschriftung (z. B. "MENGE"/"SUMME"):
    // ordnet die reinen Zahlen anhand ihrer typischen Groessenordnung zu.
    if (liter === null || preis === null) {
      const fallback = extractLiterUndPreisFallback(text);
      if (liter === null && fallback.liter !== null) {
        liter = fallback.liter;
        geschaetzt = true;
      }
      if (preis === null && fallback.preis !== null) {
        preis = fallback.preis;
        geschaetzt = true;
      }
    }

    res.json({ liter, preis, geschaetzt, rawText: text });
  } catch (err) {
    res.status(500).json({ error: 'OCR fehlgeschlagen: ' + err.message });
  }
});

app.post('/api/ocr/kilometerstand', upload.single('foto'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Kein Foto empfangen.' });
  try {
    const text = await recognizeText(req.file.buffer);
    res.json({
      km: extractKm(text),
      rawText: text,
    });
  } catch (err) {
    res.status(500).json({ error: 'OCR fehlgeschlagen: ' + err.message });
  }
});

app.get('/api/eintraege', (req, res) => {
  const rows = db.prepare('SELECT * FROM eintraege ORDER BY datum DESC, id DESC').all();
  res.json(rows);
});

app.post('/api/eintraege', (req, res) => {
  const { datum, liter, km, preis } = req.body;

  const literNum = Number(liter);
  const kmNum = Number(km);
  const preisNum = Number(preis);

  if (!datum || !Number.isFinite(literNum) || !Number.isFinite(kmNum) || !Number.isFinite(preisNum)) {
    return res.status(400).json({ error: 'datum, liter, km und preis sind erforderlich und muessen gueltig sein.' });
  }
  if (literNum <= 0 || kmNum <= 0 || preisNum <= 0) {
    return res.status(400).json({ error: 'liter, km und preis muessen groesser als 0 sein.' });
  }

  const verbrauch = round((literNum / kmNum) * 100, 2);

  const result = db
    .prepare('INSERT INTO eintraege (datum, liter, km, verbrauch, preis) VALUES (?, ?, ?, ?, ?)')
    .run(datum, round(literNum, 2), round(kmNum, 1), verbrauch, round(preisNum, 2));

  const row = db.prepare('SELECT * FROM eintraege WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

app.delete('/api/eintraege/:id', (req, res) => {
  const result = db.prepare('DELETE FROM eintraege WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Eintrag nicht gefunden.' });
  res.status(204).end();
});

app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`Benzinverbrauch-Tracker laeuft auf http://localhost:${PORT}`);
});
