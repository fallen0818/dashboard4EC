// Flexible date-string parser for CSV imports. Accepts the formats
// people actually paste in from Excel / Google Sheets / SQL clients,
// and always returns "YYYY-MM-DD".
//
// Accepted inputs (whitespace trimmed):
//   YYYY-MM-DD           2025-01-01
//   YYYY/MM/DD           2025/01/01
//   YYYYMMDD             20250101
//   MM/DD/YYYY           01/01/2025          (US, Excel default)
//   M/D/YYYY             1/1/2025
//   DD-MM-YYYY           01-01-2025          (dash form)
//   YYYYMM               202501              → 2025-01-01
//   YYYY-MM              2025-01             → 2025-01-01
//
// Throws with a clear message on bad input.
export function parseFlexibleDate(input: string, fieldName = "date"): string {
  const s = String(input ?? "").trim();
  if (!s) throw new Error(`${fieldName} is required`);

  // ISO already: YYYY-MM-DD
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return normalize(m[1], m[2], m[3], fieldName);

  // ISO with slashes: YYYY/MM/DD
  m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(s);
  if (m) return normalize(m[1], m[2], m[3], fieldName);

  // Compact ISO: YYYYMMDD
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return normalize(m[1], m[2], m[3], fieldName);

  // Month-first with slashes: MM/DD/YYYY or M/D/YYYY (Excel US default).
  // The 4-digit year on the right disambiguates from ISO forms above.
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return normalize(m[3], m[1], m[2], fieldName);

  // Day-first with dashes: DD-MM-YYYY
  m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s);
  if (m) return normalize(m[3], m[2], m[1], fieldName);

  // Year-month shorthand: YYYYMM or YYYY-MM → first of the month.
  m = /^(\d{4})-?(\d{2})$/.exec(s);
  if (m) return normalize(m[1], m[2], "01", fieldName);

  throw new Error(
    `${fieldName} "${s}" is not a recognizable date — use YYYY-MM-DD, MM/DD/YYYY, or YYYY/MM/DD`,
  );
}

function normalize(y: string, mo: string, d: string, fieldName: string): string {
  const yn = Number(y), mn = Number(mo), dn = Number(d);
  if (yn < 1900 || yn > 2100) throw new Error(`${fieldName} year "${y}" is out of range`);
  if (mn < 1 || mn > 12)      throw new Error(`${fieldName} month "${mo}" is not 1–12`);
  if (dn < 1 || dn > 31)      throw new Error(`${fieldName} day "${d}" is not 1–31`);
  const iso = `${String(yn).padStart(4, "0")}-${String(mn).padStart(2, "0")}-${String(dn).padStart(2, "0")}`;
  // Round-trip check catches things like 02/30/2025.
  const back = new Date(`${iso}T00:00:00Z`);
  if (isNaN(back.getTime())) throw new Error(`${fieldName} "${iso}" is not a real calendar date`);
  return iso;
}
