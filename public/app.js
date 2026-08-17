const $ = (id) => document.getElementById(id);

const datumInput = $('datum');
const literInput = $('liter');
const kmInput = $('km');
const preisInput = $('preis');
const verbrauchInput = $('verbrauch');

datumInput.value = new Date().toISOString().slice(0, 10);

function berechneVerbrauch() {
  const liter = parseFloat(literInput.value);
  const km = parseFloat(kmInput.value);
  if (Number.isFinite(liter) && Number.isFinite(km) && km > 0) {
    verbrauchInput.value = ((liter / km) * 100).toFixed(2) + ' l/100km';
  } else {
    verbrauchInput.value = '';
  }
}
literInput.addEventListener('input', berechneVerbrauch);
kmInput.addEventListener('input', berechneVerbrauch);

function setStatus(el, text, kind) {
  el.textContent = text;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

async function scanFoto({ fileInputId, buttonId, statusId, endpoint, onResult }) {
  const fileInput = $(fileInputId);
  const button = $(buttonId);
  const statusEl = $(statusId);

  if (!fileInput.files || fileInput.files.length === 0) {
    setStatus(statusEl, 'Bitte zuerst ein Foto auswaehlen.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('foto', fileInput.files[0]);

  button.disabled = true;
  setStatus(statusEl, 'Foto wird ausgelesen …');

  try {
    const res = await fetch(endpoint, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unbekannter Fehler');
    onResult(data);
  } catch (err) {
    setStatus(statusEl, 'Fehler: ' + err.message, 'error');
  } finally {
    button.disabled = false;
  }
}

$('btnScanKassenbon').addEventListener('click', () => {
  scanFoto({
    fileInputId: 'fotoKassenbon',
    buttonId: 'btnScanKassenbon',
    statusId: 'statusKassenbon',
    endpoint: '/api/ocr/kassenbon',
    onResult: (data) => {
      const gefunden = [];
      if (data.liter !== null) {
        literInput.value = data.liter;
        gefunden.push('Liter: ' + data.liter);
      }
      if (data.preis !== null) {
        preisInput.value = data.preis;
        gefunden.push('Preis: ' + data.preis + ' €');
      }
      berechneVerbrauch();
      if (gefunden.length === 0) {
        setStatus($('statusKassenbon'), 'Nichts erkannt, bitte manuell eintragen.', 'error');
      } else if (data.geschaetzt) {
        setStatus(
          $('statusKassenbon'),
          'Keine Beschriftung erkannt, Werte grob geschaetzt – ' + gefunden.join(', ') + '. Unbedingt pruefen!',
          'error'
        );
      } else {
        setStatus($('statusKassenbon'), 'Erkannt – ' + gefunden.join(', ') + '. Bitte pruefen.', 'ok');
      }
    },
  });
});

$('btnScanKm').addEventListener('click', () => {
  scanFoto({
    fileInputId: 'fotoKm',
    buttonId: 'btnScanKm',
    statusId: 'statusKm',
    endpoint: '/api/ocr/kilometerstand',
    onResult: (data) => {
      if (data.km !== null) {
        kmInput.value = data.km;
        berechneVerbrauch();
        setStatus($('statusKm'), 'Erkannt – km: ' + data.km + '. Bitte pruefen.', 'ok');
      } else {
        setStatus($('statusKm'), 'Nichts erkannt, bitte manuell eintragen.', 'error');
      }
    },
  });
});

async function ladeEintraege() {
  const res = await fetch('/api/eintraege');
  const rows = await res.json();
  const tbody = $('tabelleBody');
  tbody.innerHTML = '';
  $('leerHinweis').hidden = rows.length > 0;

  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.datum}</td>
      <td>${row.liter.toFixed(2)}</td>
      <td>${row.km.toFixed(1)}</td>
      <td>${row.verbrauch.toFixed(2)}</td>
      <td>${row.preis.toFixed(2)}</td>
      <td><button class="btn-delete" data-id="${row.id}" title="Loeschen">✕</button></td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await fetch('/api/eintraege/' + btn.dataset.id, { method: 'DELETE' });
      ladeEintraege();
    });
  });
}

$('eintragForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const statusEl = $('statusSpeichern');
  const payload = {
    datum: datumInput.value,
    liter: parseFloat(literInput.value),
    km: parseFloat(kmInput.value),
    preis: parseFloat(preisInput.value),
  };

  setStatus(statusEl, 'Speichere …');
  try {
    const res = await fetch('/api/eintraege', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unbekannter Fehler');

    setStatus(statusEl, 'Eintrag gespeichert.', 'ok');
    e.target.reset();
    datumInput.value = new Date().toISOString().slice(0, 10);
    verbrauchInput.value = '';
    $('statusKassenbon').textContent = '';
    $('statusKm').textContent = '';
    ladeEintraege();
  } catch (err) {
    setStatus(statusEl, 'Fehler: ' + err.message, 'error');
  }
});

ladeEintraege();
