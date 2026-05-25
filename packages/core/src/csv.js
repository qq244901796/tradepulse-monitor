export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => normalizeHeader(header));

  return rows
    .slice(1)
    .filter((items) => items.some((item) => item.trim()))
    .map((items) => Object.fromEntries(headers.map((header, index) => [
      header,
      items[index]?.trim() || '',
    ])));
}

export function normalizeHeader(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function toNumber(value) {
  const parsed = Number(String(value || '').replaceAll(',', ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.00';
}
