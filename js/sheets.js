// Fetches public Google Sheets tabs via the gviz CSV endpoint and caches
// the parsed rows in sessionStorage for a short TTL to avoid refetching
// on every section render within the same visit.
const SHEETS = (() => {
  const SPREADSHEET_ID = '1VEYOt3nnNSARpqtRWgVop3FGjtQKuQAz-F3p2WHcJns';
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  function csvUrl(sheetName) {
    return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  }

  // Minimal RFC4180 CSV parser: handles quoted fields, embedded commas,
  // embedded newlines, and escaped quotes ("").
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
        continue;
      }

      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (c === '\r') {
        // skip, \n handles the row break
      } else {
        field += c;
      }
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    const headers = rows[0].map((h) => h.trim());
    return rows.slice(1)
      .filter((r) => r.some((cell) => cell.trim() !== ''))
      .map((r) => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = (r[i] ?? '').trim();
        });
        return obj;
      });
  }

  function cacheKey(sheetName) {
    return `gsheet_cache_${SPREADSHEET_ID}_${sheetName}`;
  }

  function readCache(sheetName) {
    try {
      const raw = sessionStorage.getItem(cacheKey(sheetName));
      if (!raw) return null;
      const { timestamp, data } = JSON.parse(raw);
      if (Date.now() - timestamp > CACHE_TTL_MS) return null;
      return data;
    } catch {
      return null;
    }
  }

  function writeCache(sheetName, data) {
    try {
      sessionStorage.setItem(
        cacheKey(sheetName),
        JSON.stringify({ timestamp: Date.now(), data })
      );
    } catch {
      // sessionStorage unavailable or full — ignore, caching is best-effort
    }
  }

  async function fetchSheet(sheetName) {
    const cached = readCache(sheetName);
    if (cached) return cached;

    const res = await fetch(csvUrl(sheetName));
    if (!res.ok) {
      throw new Error(`Failed to fetch sheet "${sheetName}": ${res.status}`);
    }
    const text = await res.text();
    const data = rowsToObjects(parseCsv(text));
    writeCache(sheetName, data);
    return data;
  }

  return { fetchSheet };
})();
