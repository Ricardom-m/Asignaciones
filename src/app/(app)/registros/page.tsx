"use client";

import { useEffect, useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { usePersons, useRecordsList, useRecordsStats, usePersonRecords } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { RecordCard } from "@/components/RecordCard";
import { EditRecordModal } from "@/components/EditRecordModal";
import { Spotlight } from "@/components/Spotlight";
import { PersonSelect } from "@/components/PersonSelect";
import { PageHeader } from "@/components/PageHeader";
import { deleteRecord, todayYMD } from "@/lib/client";
import type { Person, RecordItem } from "@/lib/types";

const SALAS = ["Sala A", "Sala B", "Otro"];

// Agrupa registros (ya ordenados por el servidor) por mes/año de la FECHA.
function groupByFechaMonth(items: RecordItem[]) {
  const groups: { key: string; items: RecordItem[] }[] = [];
  for (const r of items) {
    const d = new Date((r.fecha || todayYMD()) + "T00:00:00Z");
    const label = d.toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });
    const key = label.charAt(0).toUpperCase() + label.slice(1);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(r);
    else groups.push({ key, items: [r] });
  }
  return groups;
}

type DateFilter = "prox" | "pas" | "todas";

export default function RegistrosPage() {
  const [view, setView] = useState<"list" | "spotlight">("list");
  const [dateFilter, setDateFilter] = useState<DateFilter>("prox");
  const [salaFilter, setSalaFilter] = useState("");
  const [query, setQuery] = useState("");
  const [spotlightId, setSpotlightId] = useState("");
  const [editing, setEditing] = useState<RecordItem | null>(null);

  const { persons } = usePersons();
  const { stats } = useRecordsStats();
  const { items, hasMore, loadMore, isLoading, mutate } = useRecordsList({
    scope: dateFilter,
    sala: salaFilter || undefined,
    q: query || undefined,
  });
  const personsById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const { mutate: globalMutate } = useSWRConfig();
  const toast = useToast();

  // "Por persona": solo los registros de esa persona (consulta indexada).
  const { items: personRecords } = usePersonRecords(view === "spotlight" ? spotlightId : null);

  // Llegada desde la paleta de comandos (⌘K → ver análisis de una persona).
  useEffect(() => {
    const id = sessionStorage.getItem("asgn_spotlight");
    if (id) {
      sessionStorage.removeItem("asgn_spotlight");
      setView("spotlight");
      setSpotlightId(id);
    }
  }, []);

  const groups = groupByFechaMonth(items);

  const onDelete = async (rec: RecordItem) => {
    if (!confirm("¿Eliminar este registro?")) return;
    try {
      await deleteRecord(rec.id);
      await Promise.all([mutate(), globalMutate("/api/records/stats")]);
      toast("🗑️ Registro eliminado");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  return (
    <div className="page-inner fade-up">
      <PageHeader
        title="Registros"
        subtitle={`${stats.proximas} próximas · ${stats.estaSemana} esta semana · ${stats.total} en total`}
      />

      <div className="view-toggle">
        <button className={`vt-btn${view === "list" ? " active" : ""}`} onClick={() => setView("list")}>
          Lista
        </button>
        <button className={`vt-btn${view === "spotlight" ? " active" : ""}`} onClick={() => setView("spotlight")}>
          Por persona
        </button>
      </div>

      {view === "list" ? (
        <>
          <div className="seg">
            {([
              { k: "prox", label: "Próximas" },
              { k: "pas", label: "Pasadas" },
              { k: "todas", label: "Todas" },
            ] as const).map((o) => (
              <button
                key={o.k}
                className={`seg-btn${dateFilter === o.k ? " active" : ""}`}
                onClick={() => setDateFilter(o.k)}
              >
                {o.label}
              </button>
            ))}
          </div>

          <input
            className="list-search-input"
            style={{ width: "100%", marginBottom: 10 }}
            type="text"
            placeholder="🔍 Buscar por persona, tarea…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="role-filter-bar">
            <button
              className="role-chip"
              onClick={() => setSalaFilter("")}
              style={!salaFilter ? { color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-dim)" } : undefined}
            >
              Todas las salas
            </button>
            {SALAS.map((s) => (
              <button
                key={s}
                className="role-chip"
                onClick={() => setSalaFilter(salaFilter === s ? "" : s)}
                style={salaFilter === s ? { color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-dim)" } : undefined}
              >
                {s}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="empty-state">
              <div className="empty-icon">⏳</div>
              <h3>Cargando…</h3>
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <h3>Sin registros</h3>
              <p>
                {dateFilter === "prox"
                  ? "No hay asignaciones próximas."
                  : query || salaFilter
                    ? "Prueba con otro filtro."
                    : 'Ve a "Nuevo" para agregar el primero.'}
              </p>
            </div>
          ) : (
            <>
              {groups.map((g) => (
                <div key={g.key}>
                  <div className="month-group-title">{g.key}</div>
                  {g.items.map((rec) => (
                    <RecordCard key={rec.id} rec={rec} personsById={personsById} onEdit={setEditing} onDelete={onDelete} />
                  ))}
                </div>
              ))}
              {hasMore && (
                <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
                  <button className="btn btn-ghost" style={{ width: "auto", padding: "10px 28px" }} onClick={loadMore}>
                    Cargar más ↓
                  </button>
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
            <PersonSelect persons={persons} value={spotlightId} onChange={setSpotlightId} placeholder="Buscar persona…" allowClear={false} />
          </div>
          {spotlightId && <Spotlight personId={spotlightId} persons={persons} records={personRecords} />}
        </>
      )}

      {editing && <EditRecordModal rec={editing} persons={persons} onClose={() => setEditing(null)} />}
    </div>
  );
}
