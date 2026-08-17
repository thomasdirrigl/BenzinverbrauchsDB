const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'BenzinverbrauchsDB.sqlite');

const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

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
