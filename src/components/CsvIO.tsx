import { useRef, useState } from "react";
import { CsvCell, downloadCsv, parseCsv, readFileText, rowsToCsv } from "../lib/csv";

export interface CsvSchema<Row, NewRow> {
  /** Filename shown in the "Save as" dialog on export. */
  filename: string;
  /** Ordered CSV column headers. */
  headers: string[];
  /** Turn one loaded row into a CSV cell array (same order as headers). */
  serialize: (r: Row) => CsvCell[];
  /**
   * Turn one parsed CSV record into a payload the caller can save.
   * Throw with a message on any per-row validation error — the row is
   * skipped and its number + message is reported at the end.
   */
  parseRow: (record: Record<string, string>) => NewRow;
  /** One example row used for the template download. */
  templateRow: Record<string, string>;
  /**
   * Optional: called once per imported row (already validated).
   * Omit to disable import — only export + template will show.
   */
  onImport?: (payload: NewRow) => Promise<void>;
}

interface CsvIOProps<Row, NewRow> {
  rows: Row[];
  schema: CsvSchema<Row, NewRow>;
  onAfterImport?: () => void | Promise<void>;
}

export default function CsvIO<Row, NewRow>({ rows, schema, onAfterImport }: CsvIOProps<Row, NewRow>) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"info" | "ok" | "err">("info");

  function say(kind: "info" | "ok" | "err", msg: string) {
    setStatusKind(kind);
    setStatus(msg);
  }

  function handleExport() {
    const body = rows.map((r) => schema.serialize(r));
    const csv = rowsToCsv(schema.headers, body);
    downloadCsv(schema.filename, csv);
    say("ok", `Exported ${rows.length} ${rows.length === 1 ? "row" : "rows"}.`);
  }

  function handleTemplate() {
    const body = [schema.headers.map((h) => schema.templateRow[h] ?? "")];
    const csv = rowsToCsv(schema.headers, body);
    downloadCsv(`template_${schema.filename}`, csv);
    say("info", "Template downloaded.");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so the same file can be re-selected later.
    if (fileInput.current) fileInput.current.value = "";
    if (!file || !schema.onImport) return;

    setBusy(true);
    say("info", `Reading ${file.name}…`);
    try {
      const text = await readFileText(file);
      const records = parseCsv(text);
      if (records.length === 0) {
        say("err", "That file has no data rows.");
        return;
      }

      const rowErrors: string[] = [];
      let ok = 0;
      for (let i = 0; i < records.length; i++) {
        try {
          const payload = schema.parseRow(records[i]);
          await schema.onImport(payload);
          ok++;
        } catch (err) {
          rowErrors.push(`row ${i + 2}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (rowErrors.length === 0) {
        say("ok", `Imported ${ok} ${ok === 1 ? "row" : "rows"}.`);
      } else {
        say(
          "err",
          `Imported ${ok} of ${records.length}. Failures: ${rowErrors.slice(0, 3).join("; ")}${rowErrors.length > 3 ? ` (+${rowErrors.length - 3} more)` : ""}`,
        );
      }
      if (onAfterImport) await onAfterImport();
    } catch (err) {
      say("err", err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const statusClass =
    statusKind === "ok"
      ? "text-[#22F0B0]"
      : statusKind === "err"
        ? "text-[#FF4D6D]"
        : "text-[#9CA3D9]";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={handleExport}
        disabled={busy}
        className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] border border-[#2C3168] rounded px-3 py-1.5 disabled:opacity-50"
      >
        ⤓ Export CSV
      </button>

      {schema.onImport && (
        <>
          <button
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] border border-[#2C3168] rounded px-3 py-1.5 disabled:opacity-50"
          >
            {busy ? "Importing…" : "⤒ Import CSV"}
          </button>
          <button
            onClick={handleTemplate}
            disabled={busy}
            className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] border border-[#2C3168] rounded px-3 py-1.5 disabled:opacity-50"
          >
            ↓ Template
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="hidden"
          />
        </>
      )}

      {status && (
        <span className={`font-mono text-xs ${statusClass}`}>{status}</span>
      )}
    </div>
  );
}
