const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Getrennt von den OCR-Sprachdaten (data/tessdata, im Image gebacken), damit
// im Deployment nur dieses Verzeichnis als persistentes Volume gemountet
// werden muss.
const DATA_DIR = process.env.DB_DIR || path.join(__dirname, '..', 'storage');
const DB_PATH = path.join(DATA_DIR, 'BenzinverbrauchsDB.sqlite');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS eintraege (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    datum TEXT NOT NULL,
    liter REAL NOT NULL,
    km REAL NOT NULL,
    verbrauch REAL NOT NULL,
    preis REAL NOT NULL,
    erstellt_am TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

module.exports = db;
