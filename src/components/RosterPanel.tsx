"use client";

import { useState } from "react";
import { useRoster } from "@/lib/hooks";
import { RoleBadge } from "@/components/RoleBadge";
import { GenderIcon } from "@/components/GenderIcon";
import type { Role } from "@/lib/types";

// "hace X" en grano grueso a partir de los días.
export function agoShort(days: number | null): string {
  if (days === null) return "nunca";
  if (days <= 0) return "hoy";
  if (days < 45) return `hace ${days}d`;
  const m = Math.round(days / 30);
  if (m < 12) return `hace ${m} mes${m !== 1 ? "es" : ""}`;
  const y = Math.floor(m / 12);
  return `hace ${y} año${y !== 1 ? "s" : ""}`;
}

interface Props {
  fecha: string;
  roles: Role[];
  onPick?: (personId: string) => void;
  title?: string;
}

// Vista de equidad / rotación: a quién le toca para una fecha.
export function RosterPanel({ fecha, roles, onPick, title = "¿A quién le toca?" }: Props) {
  const [roleFilter, setRoleFilter] = useState("");
  const { roster, isLoading } = useRoster(fecha, roleFilter || undefined);

  return (
    <div className="content-card">
      <div className="section-label">{title}</div>
      <div className="field-hint" style={{ marginTop: 0, marginBottom: 10 }}>
        Ordenado por quién lleva más tiempo sin participar. {onPick ? "Toca a alguien para asignarlo." : ""}
      </div>

      <div className="role-filter-bar" style={{ marginBottom: 10 }}>
        <button
          className="role-chip"
          onClick={() => setRoleFilter("")}
          style={!roleFilter ? { color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-dim)" } : undefined}
        >
          Todos
        </button>
        {roles.map((r) => (
          <button
            key={r.id}
            className="role-chip"
            onClick={() => setRoleFilter(roleFilter === r.id ? "" : r.id)}
            style={roleFilter === r.id ? { color: r.color, borderColor: r.color, background: r.color + "22" } : undefined}
          >
            {r.nombre}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="spotlight-empty">Cargando…</div>
      ) : roster.length === 0 ? (
        <div className="spotlight-empty">Sin personas en este filtro.</div>
      ) : (
        <div className="roster-list">
          {roster.map((p) => {
            const overdue = p.daysSince === null || p.daysSince > 60;
            return (
              <button
                key={p.id}
                className={`roster-row${p.assignedOnTarget ? " taken" : ""}`}
                onClick={() => onPick?.(p.id)}
                disabled={!onPick}
              >
                <div className="roster-main">
                  <div className="roster-name">
                    {p.nombre}
                    <GenderIcon genero={p.genero} />
                  </div>
                  <div className="roster-roles">
                    {p.roles.slice(0, 2).map((r) => (
                      <RoleBadge key={r.id} role={r} />
                    ))}
                  </div>
                </div>
                <div className="roster-stats">
                  {p.assignedOnTarget ? (
                    <span className="roster-taken-tag">ya ese día</span>
                  ) : (
                    <>
                      <span className={`roster-ago${overdue ? " over" : ""}`}>{agoShort(p.daysSince)}</span>
                      <span className="roster-load">{p.countMonth} este mes</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
