"use client";

import { useCallback, useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { parseShopeeRows } from "@/lib/shopee";
import { fmtInt, fmtMoney } from "@/lib/format";
import { STORE } from "@/lib/config";

type Stage = "idle" | "parsed" | "uploading" | "done" | "error";

interface Parsed {
  records: ReturnType<typeof parseShopeeRows>["records"];
  skipped: number;
  matchedColumns: string[];
  fileName: string;
  revenue: number;
}

export default function Uploader() {
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState<string>("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [shopName, setShopName] = useState(STORE.name);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setStage("idle");
    setMessage("");
    setParsed(null);
    try {
      const rows = await readRows(file);
      const result = parseShopeeRows(rows);
      if (result.missingRequired.length > 0) {
        setStage("error");
        setMessage(
          `Could not find required columns: ${result.missingRequired.join(", ")}. ` +
            `Make sure this is a Shopee order export.`
        );
        return;
      }
      const revenue = result.records.reduce((a, r) => a + r.revenue, 0);
      setParsed({
        records: result.records,
        skipped: result.skipped,
        matchedColumns: result.matchedColumns,
        fileName: file.name,
        revenue,
      });
      setStage("parsed");
    } catch (err: any) {
      setStage("error");
      setMessage(err?.message ?? "Failed to read file.");
    }
  }, []);

  const upload = useCallback(async () => {
    if (!parsed) return;
    setStage("uploading");
    setMessage("");
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopName, records: parsed.records }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setStage("done");
      setMessage(
        `Imported ${fmtInt(json.inserted)} rows into “${json.shop}”. ` +
          (json.note ? json.note : "")
      );
    } catch (err: any) {
      setStage("error");
      setMessage(err?.message ?? "Upload failed.");
    }
  }, [parsed, shopName]);

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <label className="mb-1 block text-sm font-medium text-slate-700">Store name</label>
        <input
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="My Shopee Store"
        />
        <p className="mt-1 text-xs text-slate-400">
          Rows are grouped under this store. Reuse the same name to append more data.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-10 text-center transition ${
          dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-brand-400"
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl text-brand-500">
          ↑
        </div>
        <p className="text-sm font-medium text-slate-700">
          Drop your Shopee export here, or click to browse
        </p>
        <p className="text-xs text-slate-400">Supports .csv, .xlsx, .xls</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {parsed && stage !== "done" && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900">Preview — {parsed.fileName}</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Rows ready" value={fmtInt(parsed.records.length)} />
            <Stat label="Total revenue" value={fmtMoney(parsed.revenue)} />
            <Stat label="Skipped" value={fmtInt(parsed.skipped)} />
            <Stat label="Columns matched" value={fmtInt(parsed.matchedColumns.length)} />
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Matched: {parsed.matchedColumns.join(", ")}
          </p>
          <button
            onClick={upload}
            disabled={stage === "uploading" || parsed.records.length === 0}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {stage === "uploading" ? "Importing…" : `Import ${fmtInt(parsed.records.length)} rows`}
          </button>
        </div>
      )}

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            stage === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

async function readRows(file: File): Promise<Record<string, unknown>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });
    return result.data;
  }
  // Excel
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}
