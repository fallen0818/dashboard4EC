import { useRef, useState } from "react";
import { CsvCell, downloadCsv, parseCsv, readFileText, rowsToCsv } from "../lib/csv";
import Modal from "./Modal";

export interface CsvSchema<Row, NewRow> {
  filename: string;
  headers: string[];
  serialize: (r: Row) => CsvCell[];
  parseRow: (record: Record<string, string>) => NewRow;
  templateRow: Record<string, string>;
  onImport?: (payload: NewRow) => Promise<void>;
}

interface CsvIOProps<Row, NewRow> {
  rows: Row[];
  schema: CsvSchema<Row, NewRow>;
  onAfterImport?: () => void | Promise<void>;
}

interface RowFailure {
  line: number;                          // 1-based file line (2 = first data row)
  message: string;
  record: Record<string, string>;         // the raw CSV record so users can see what went wrong
}

interface ImportReport {
  filename: string;
  totalRows: number;
  ok: number;
  failures: RowFailure[];
}

export default function CsvIO<Row, NewRow>({ rows, schema, onAfterImport }: CsvIOProps<Row, NewRow>) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"info" | "ok" | "err">("info");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [showReport, setShowReport] = useState(false);

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
    if (fileInput.current) fileInput.current.value = "";
    if (!file || !schema.onImport) return;

    setBusy(true);
    setReport(null);
    say("info", `Reading ${file.name}…`);
    try {
      const text = await readFileText(file);
      const records = parseCsv(text);
      if (records.length === 0) {
        say("err", "That file has no data rows.");
        return;
      }

      const failures: RowFailure[] = [];
      let ok = 0;
      for (let i = 0; i < records.length; i++) {
        try {
          const payload = schema.parseRow(records[i]);
          await schema.onImport(payload);
          ok++;
        } catch (err) {
          failures.push({
            line: i + 2, // 1-based file line (row 1 is the header)
            message: err instanceof Error ? err.message : String(err),
            record: records[i],
          });
        }
      }

      const nextReport: ImportReport = {
        filename: file.name,
        totalRows: records.length,
        ok,
        failures,
      };
      setReport(nextReport);

      if (failures.length === 0) {
        say("ok", `Imported ${ok} of ${records.length} rows.`);
      } else {
        say("err", `Imported ${ok} of ${records.length}. ${failures.length} failed — click "View report".`);
      }

      if (onAfterImport) await onAfterImport();
    } catch (err) {
      say("err", err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadFailuresCsv() {
    if (!report || report.failures.length === 0) return;
    const headers = ["file_line", "error", ...schema.headers];
    const body: CsvCell[][] = report.failures.map((f) => [
      f.line,
      f.message,
      ...schema.headers.map((h) => f.record[h] ?? ""),
    ]);
    downloadCsv(`failures_${report.filename}`, rowsToCsv(headers, body));
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

      {status && <span className={`font-mono text-xs ${statusClass}`}>{status}</span>}

      {report && report.failures.length > 0 && (
        <button
          onClick={() => setShowReport(true)}
          className="font-mono text-xs uppercase tracking-wide text-[#FF4D6D] hover:text-[#F5F0FF] border border-[#FF4D6D] rounded px-3 py-1.5"
        >
          View report ({report.failures.length})
        </button>
      )}

      {report && (
        <Modal
          open={showReport}
          onClose={() => setShowReport(false)}
          title={`Import report · ${report.filename}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 font-mono text-xs">
              <ReportStat label="Total rows" value={report.totalRows} color="#9CA3D9" />
              <ReportStat label="Imported"   value={report.ok}         color="#22F0B0" />
              <ReportStat label="Failed"     value={report.failures.length} color="#FF4D6D" />
            </div>

            {report.failures.length === 0 ? (
              <p className="font-mono text-xs text-[#9CA3D9]">Every row imported successfully.</p>
            ) : (
              <>
                <div className="flex justify-between items-baseline">
                  <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9]">
                    Failures ({report.failures.length})
                  </p>
                  <button
                    onClick={downloadFailuresCsv}
                    className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] border border-[#2C3168] rounded px-3 py-1"
                  >
                    ⤓ Download failures.csv
                  </button>
                </div>

                <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                  {report.failures.map((f) => (
                    <div
                      key={f.line}
                      className="border border-[#FF4D6D33] rounded p-3 bg-[#3A0F1E33]"
                    >
                      <div className="flex justify-between items-baseline mb-1">
                        <p className="font-mono text-xs text-[#FF4D6D]">
                          Row {f.line}
                        </p>
                      </div>
                      <p className="font-mono text-xs text-[#F5F0FF] mb-2">{f.message}</p>
                      <details className="font-mono text-[11px] text-[#9CA3D9]">
                        <summary className="cursor-pointer hover:text-[#F5F0FF]">
                          Show row values
                        </summary>
                        <table className="mt-2 w-full">
                          <tbody>
                            {schema.headers.map((h) => (
                              <tr key={h} className="border-b border-[#1F2450]">
                                <td className="py-1 pr-3 text-[#6C74A8] whitespace-nowrap">{h}</td>
                                <td className="py-1 text-[#F5F0FF] break-all">
                                  {f.record[h] ?? <span className="text-[#6C74A8]">(empty)</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </details>
                    </div>
                  ))}
                </div>

                <p className="font-mono text-[11px] text-[#6C74A8]">
                  Tip: fix the failing rows in the original file (or in the downloaded
                  <span className="text-[#F5F0FF]"> failures.csv</span>) and re-import.
                  Successfully imported rows are already saved — importing again will duplicate them.
                </p>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function ReportStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="border border-[#2C3168] rounded px-3 py-2">
      <p className="uppercase tracking-wide text-[#9CA3D9]">{label}</p>
      <p className="text-lg tabular-nums mt-0.5" style={{ color }}>
        {value.toLocaleString("en-PH")}
      </p>
    </div>
  );
}
