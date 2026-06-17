"use client";

import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { usePersons, useRecords } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { RecordCard } from "@/components/RecordCard";
import { EditRecordModal } from "@/components/EditRecordModal";
import { Spotlight } from "@/components/Spotlight";
import { PersonSelect } from "@/components/PersonSelect";
import { deleteRecord } from "@/lib/client";
import type { RecordItem } from "@/lib/types";

type SortField = "createdAt" | "updatedAt";
const PAGE_SIZE = 25;

export default function RegistrosPage() {
  const [view, setView] = useState<"list" | "spotlight">("list");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [sortMenu, setSortMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [spotlightId, setSpotlightId] = useState("");
  const [editing, setEditing] = useState<RecordItem | null>(null);

  const { persons } = usePersons();
  const { records, isLoading } = useRecords(sortField, sortDir);
  const { mutate } = useSWRConfig();
  const toast = useToast();

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return records;
    return records.filter((r) =>
      [r.asignado, r.ayudante, r.sala, r.asignacion, r.tipo, r.fecha]
        .some((v) => String(v || "").toLowerCase().includes(q)),
    );
  }, [records, query]);

  const visible = filtered.slice(0, limit);

  const onDelete = async (rec: RecordItem) => {
    if (!confirm("¿Eliminar este registro?")) return;
    try {
      await deleteRecord(rec.id);
      await mutate((k) => typeof k === "string" && k.startsWith("/api/records"));
      toast("🗑️ Registro eliminado");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  return (
    <div className="page-inner fade-up">
      <div className="view-toggle">
        <button
          className={`vt-btn${view === "list" ? " active" : ""}`}
          onClick={() => setView("list")}
        >
          Lista
        </button>
        <button
          className={`vt-btn${view === "spotlight" ? " active" : ""}`}
          onClick={() => setView("spotlight")}
        >
          Por persona
        </button>
      </div>

      {view === "list" ? (
        <>
          <div className="list-toolbar">
            <input
              className="list-search-input"
              type="text"
              placeholder="🔍 Filtrar…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE_SIZE);
              }}
            />
            <button
              className={`sort-btn${sortMenu ? " active" : ""}`}
              onClick={() => setSortMenu((s) => !s)}
            >
              ⇅ Ordenar
            </button>
            <div className="list-count">
              {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>

          {sortMenu && (
            <div className="sort-menu">
              <div className="sort-menu-title">Ordenar por</div>
              <div className="sort-row">
                <div
                  className={`sort-opt${sortField === "createdAt" ? " active" : ""}`}
                  onClick={() => setSortField("createdAt")}
                >
                  <div className="chk" />
                  <div>
                    <div style={{ fontSize: ".76rem", fontWeight: 500 }}>Fecha de registro</div>
                    <div style={{ fontSize: ".63rem", color: "var(--text3)" }}>Cuándo se creó</div>
                  </div>
                </div>
                <div
                  className={`sort-opt${sortField === "updatedAt" ? " active" : ""}`}
                  onClick={() => setSortField("updatedAt")}
                >
                  <div className="chk" />
                  <div>
                    <div style={{ fontSize: ".76rem", fontWeight: 500 }}>Última actualización</div>
                    <div style={{ fontSize: ".63rem", color: "var(--text3)" }}>Cuándo se editó</div>
                  </div>
                </div>
              </div>
              <div className="sort-dir-row">
                <button
                  className={`sort-dir-btn${sortDir === "desc" ? " active" : ""}`}
                  onClick={() => setSortDir("desc")}
                >
                  ↓ Más reciente
                </button>
                <button
                  className={`sort-dir-btn${sortDir === "asc" ? " active" : ""}`}
                  onClick={() => setSortDir("asc")}
                >
                  ↑ Más antiguo
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="empty-state">
              <div className="empty-icon">⏳</div>
              <h3>Cargando…</h3>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <h3>Sin registros</h3>
              <p>{query ? "Prueba con otro filtro." : 'Ve a "Nuevo" para agregar el primero.'}</p>
            </div>
          ) : (
            <>
              {visible.map((rec) => (
                <RecordCard key={rec.id} rec={rec} onEdit={setEditing} onDelete={onDelete} />
              ))}
              {limit < filtered.length && (
                <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
                  <button
                    className="btn btn-ghost"
                    style={{ width: "auto", padding: "10px 28px" }}
                    onClick={() => setLimit((l) => l + PAGE_SIZE)}
                  >
                    Cargar más registros ↓
                  </button>
                  <div style={{ fontSize: ".65rem", color: "var(--text3)", marginTop: 6 }}>
                    Mostrando {visible.length} de {filtered.length} registros
                  </div>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className="spotlight-search-wrap">
            <div className="field-label" style={{ marginBottom: 6 }}>
              Selecciona una persona para analizar
            </div>
            <PersonSelect
              persons={persons}
              value={spotlightId}
              onChange={setSpotlightId}
              placeholder="Buscar persona…"
              allowClear={false}
            />
          </div>
          {spotlightId && (
            <Spotlight personId={spotlightId} persons={persons} records={records} />
          )}
        </>
      )}

      {editing && (
        <EditRecordModal rec={editing} persons={persons} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
