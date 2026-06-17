"use client";

import { useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { apiFetch } from "@/lib/client";
import { useToast } from "@/components/Toast";
import type { Person, RecordItem } from "@/lib/types";

interface ImportResult {
  personsCreated: number;
  recordsImported: number;
  skipped: number;
}

export function ImportExport() {
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    try {
      const [persons, records] = await Promise.all([
        apiFetch<Person[]>("/api/persons"),
        apiFetch<RecordItem[]>("/api/records?sort=createdAt&dir=desc"),
      ]);
      const payload = JSON.stringify(
        { records, persons, exportedAt: new Date().toISOString() },
        null,
        2,
      );
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "asignaciones_" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      URL.revokeObjectURL(url);
      toast("💾 Archivo exportado", "success");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const d = JSON.parse(String(ev.target?.result));
        setBusy(true);
        const res = await apiFetch<ImportResult>("/api/import", {
          method: "POST",
          body: JSON.stringify({ persons: d.persons ?? [], records: d.records ?? [] }),
        });
        await Promise.all([
          mutate((k) => typeof k === "string" && k.startsWith("/api/records")),
          mutate("/api/persons"),
        ]);
        toast(
          `📤 Importado: ${res.personsCreated} personas, ${res.recordsImported} registros` +
            (res.skipped ? ` (${res.skipped} omitidos)` : ""),
          "success",
        );
      } catch (err) {
        toast("❌ " + (err as Error).message, "error");
      } finally {
        setBusy(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <button className="hbtn" onClick={handleExport} title="Exportar JSON">
        💾 Exportar
      </button>
      <button
        className="hbtn"
        onClick={() => fileInput.current?.click()}
        title="Importar JSON"
        disabled={busy}
      >
        {busy ? "…" : "📤 Importar"}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".json"
        onChange={handleImportFile}
        style={{ display: "none" }}
      />
    </>
  );
}
