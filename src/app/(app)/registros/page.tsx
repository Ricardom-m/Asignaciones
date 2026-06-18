"use client";

import { useEffect, useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { usePersons, useRecords } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { RecordCard } from "@/components/RecordCard";
import { EditRecordModal } from "@/components/EditRecordModal";
import { Spotlight } from "@/components/Spotlight";
import { PersonSelect } from "@/components/PersonSelect";
import { PageHeader } from "@/components/PageHeader";
import { deleteRecord, todayYMD, addDaysYMD, weekdayOf } from "@/lib/client";
import type { Person, RecordItem } from "@/lib/types";

// Agrupa registros (ya ordenados) por mes/año de la FECHA de la asignación.
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
const PAGE_SIZE = 25;

export default function RegistrosPage() {
  const [view, setView] = useState<"list" | "spotlight">("list");
  const [dateFilter, setDateFilter] = useState<DateFilter>("prox");
  const [salaFilter, setSalaFilter] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [spotlightId, setSpotlightId] = useState("");
  const [editing, setEditing] = useState<RecordItem | null>(null);

  const { persons } = usePersons();
  const { records, isLoading } = useRecords();
  const { mutate } = useSWRConfig();
  const toast = useToast();

  const personsById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);

  // Llegada desde la paleta de comandos (⌘K → ver análisis de una persona).
  useEffect(() => {
    const id = sessionStorage.getItem("asgn_spotlight");
    if (id) {
      sessionStorage.removeItem("asgn_spotlight");
      setView("spotlight");
      setSpotlightId(id);
    }
  }, []);

  const today = todayYMD();

  // Resumen
  const monday = addDaysYMD(today, -((weekdayOf(today) + 6) % 7));
  const sunday = addDaysYMD(monday, 6);
  const proximasCount = records.filter((r) => (r.fecha || "") >= today).length;
  const estaSemanaCount = records.filter((r) => r.fecha >= monday && r.fecha <= sunday).length;

  // Salas presentes (para el filtro)
  const salas = useMemo(
    () => Array.from(new Set(records.map((r) => r.sala).filter(Boolean))) as string[],
    [records],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let list = records.filter((r) => {
      if (dateFilter === "prox" && (r.fecha || "") < today) return false;
      if (dateFilter === "pas" && (r.fecha || "") >= today) return false;
      if (salaFilter && r.sala !== salaFilter) return false;
      if (q && ![r.asignado, r.ayudante, r.sala, r.asignacion, r.fecha].some((v) => String(v || "").toLowerCase().includes(q)))
        return false;
      return true;
    });
    // Orden por fecha de asignación: próximas → la más cercana primero; resto → más reciente primero.
    list = [...list].sort((a, b) =>
      dateFilter === "prox" ? (a.fecha || "").localeCompare(b.fecha || "") : (b.fecha || "").localeCompare(a.fecha || ""),
    );
    return list;
  }, [records, dateFilter, salaFilter, query, today]);

  const visible = filtered.slice(0, limit);
  const groups = groupByFechaMonth(visible);

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

  const resetLimit = () => setLimit(PAGE_SIZE);

  return (
    <div className="page-inner fade-up">
      <PageHeader
        title="Registros"
        subtitle={`${proximasCount} próximas · ${estaSemanaCount} esta semana · ${records.length} en total`}
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
          {/* Filtro temporal */}
          <div className="seg">
            {([
              { k: "prox", label: "Próximas" },
              { k: "pas", label: "Pasadas" },
              { k: "todas", label: "Todas" },
            ] as const).map((o) => (
              <button
                key={o.k}
                className={`seg-btn${dateFilter === o.k ? " active" : ""}`}
                onClick={() => {
                  setDateFilter(o.k);
                  resetLimit();
                }}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Buscador + filtro de sala */}
          <input
            className="list-search-input"
            style={{ width: "100%", marginBottom: 10 }}
            type="text"
            placeholder="🔍 Buscar por persona, tarea…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetLimit();
            }}
          />
          {salas.length > 1 && (
            <div className="role-filter-bar">
              <button
                className="role-chip"
                onClick={() => setSalaFilter("")}
                style={!salaFilter ? { color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-dim)" } : undefined}
              >
                Todas las salas
              </button>
              {salas.map((s) => (
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
          )}

          <div className="list-count">
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
          </div>

          {isLoading ? (
            <div className="empty-state">
              <div className="empty-icon">⏳</div>
              <h3>Cargando…</h3>
            </div>
          ) : filtered.length === 0 ? (
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
              {limit < filtered.length && (
                <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
                  <button className="btn btn-ghost" style={{ width: "auto", padding: "10px 28px" }} onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                    Cargar más ↓
                  </button>
                  <div style={{ fontSize: ".65rem", color: "var(--text3)", marginTop: 6 }}>
                    Mostrando {visible.length} de {filtered.length}
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
            <PersonSelect persons={persons} value={spotlightId} onChange={setSpotlightId} placeholder="Buscar persona…" allowClear={false} />
          </div>
          {spotlightId && <Spotlight personId={spotlightId} persons={persons} records={records} />}
        </>
      )}

      {editing && <EditRecordModal rec={editing} persons={persons} onClose={() => setEditing(null)} />}
    </div>
  );
}
