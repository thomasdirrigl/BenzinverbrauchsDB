# Benzinverbrauch-Tracker

HTML5-App mit Node.js/Express-Backend zum Erfassen von Tankvorgaengen. Kassenbon
und Kilometerstand werden per Foto erfasst, Literzahl/Preis/km per OCR
ausgelesen, der Durchschnittsverbrauch berechnet und alles in der
`BenzinverbrauchsDB` (SQLite) gespeichert.

### Datenmodell (`eintraege`)

| Feld       | Bedeutung                          |
|------------|-------------------------------------|
| datum      | Tankdatum                          |
| liter      | Literzahl                          |
| km         | gefahrene km seit letztem Tanken   |
| verbrauch  | Durchschnittsverbrauch in l/100km (= liter / km * 100) |
| preis      | Gesamtpreis in EUR                 |

### Ablauf in der App

1. Foto vom Kassenbon aufnehmen/hochladen -> "Foto auslesen" liest Literzahl und Preis per OCR aus.
2. Foto vom Tacho/Trip-Zaehler aufnehmen/hochladen -> "Foto auslesen" liest die gefahrenen km per OCR aus.
3. Erkannte Werte pruefen/korrigieren (OCR ist eine Heuristik, keine Garantie), Durchschnittsverbrauch wird live berechnet.
4. "Eintrag speichern" schreibt den Datensatz in die BenzinverbrauchsDB.
5. Bisherige Eintraege werden tabellarisch angezeigt und koennen geloescht werden.

### Starten

```bash
npm install   # installiert Abhaengigkeiten und legt lokale OCR-Sprachdaten an
npm start     # startet den Server auf http://localhost:3000
```

Die SQLite-Datenbank wird unter `storage/BenzinverbrauchsDB.sqlite` angelegt
(nicht versioniert, Pfad ueber `DB_DIR` konfigurierbar). Die OCR-Sprachdaten
(Deutsch/Englisch) werden beim `npm install` per `postinstall`-Skript aus den
npm-Paketen `@tesseract.js-data/deu` und `@tesseract.js-data/eng` nach
`data/tessdata` kopiert, damit die Texterkennung vollstaendig lokal laeuft
(kein Laden von einem externen CDN zur Laufzeit).

### Deployment (Docker / Coolify)

Die App laeuft als Container (`Dockerfile` + `docker-compose.yml` im Repo).
Die OCR-Sprachdaten werden beim Image-Build ins Image gebacken (`data/`,
statisch, kein Volume noetig). Nur die SQLite-Datenbank unter `/app/storage`
muss persistent gemountet werden.

**Lokal testen:**

```bash
docker compose up --build
# App: http://localhost:3000, Health-Check: http://localhost:3000/health
```

**Auf Hetzner Cloud mit Coolify:**

1. Neue Ressource anlegen -> "Docker Compose" (oder "Dockerfile") -> dieses
   Repo (Branch `main`) auswaehlen. Coolify erkennt `docker-compose.yml`
   automatisch.
2. Persistentes Volume/Storage in Coolify auf den Container-Pfad
   `/app/storage` mappen (ohne das geht bei jedem Redeploy die Datenbank
   verloren).
3. Domain/Subdomain in Coolify eintragen, Port `3000` als internen
   Service-Port setzen (Coolify uebernimmt HTTPS via Let's Encrypt
   automatisch).
4. Health-Check-Pfad in Coolify auf `/health` setzen.
5. Deploy anstossen. Umgebungsvariablen `PORT`/`DB_DIR` sind bereits mit
   sinnvollen Defaults im Dockerfile gesetzt und muessen i. d. R. nicht
   veraendert werden.

### Hinweis

Die OCR-Erkennung ist eine Heuristik auf Basis von Tesseract.js und liest u. a.
nach den Schluesselwoertern "Menge"/"l" (Liter), "Gesamt"/"Summe"/"€" (Preis)
und "km" (Kilometerstand). Je nach Bildqualitaet/Kassenbon-Layout kann die
Erkennung ungenau sein — die erkannten Werte sind daher in der App vor dem
Speichern editierbar.
