"use client";

import { useState } from "react";
import { fmtShort, fmtDT, dateStatus, relativeLabel } from "@/lib/client";
import { RoleBadge } from "@/components/RoleBadge";
import { GenderIcon } from "@/components/GenderIcon";
import type { Person, RecordItem } from "@/lib/types";

interface Props {
  rec: RecordItem;
  personsById: Map<string, Person>;
  onEdit: (rec: RecordItem) => void;
  onDelete: (rec: RecordItem) => void;
  onPerson?: (id: string) => void;
}

export function RecordCard({ rec, personsById, onEdit, onDelete, onPerson }: Props) {
  const [open, setOpen] = useState(false);
  const status = dateStatus(rec.fecha);
  const asignadoP = personsById.get(rec.asignadoId);
  const ayudanteP = rec.ayudanteId ? personsById.get(rec.ayudanteId) : undefined;

  return (
    <div className={`record-card${open ? " open" : ""}`}>
      {/* Cabecera minimalista (clic para expandir) */}
      <button className="rc-header" onClick={() => setOpen((o) => !o)}>
        <span className={`rc-status ${status.level}`}>{status.label}</span>
        <span className="rc-people-min">
          <span className="rc-pname">{rec.asignado}</span>
          {rec.ayudante && (
            <>
              <span className="rc-con"> con </span>
              {rec.ayudante}
            </>
          )}
        </span>
        <span className="rc-date-min">{fmtShort(rec.fecha)}</span>
        <svg className="rc-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Detalle (acordeón) */}
      {open && (
        <div className="rc-detail field-reveal">
          <div className="rc-detail-row">
            <span className="rc-detail-label">Cuándo</span>
            <span>
              {fmtShort(rec.fecha)} · {relativeLabel(rec.fecha)}
              {rec.sala && <span className="rc-sala" style={{ marginLeft: 8 }}>{rec.sala}</span>}
            </span>
          </div>

          <div className="rc-detail-row">
            <span className="rc-detail-label">Personas</span>
            <span className="rc-people">
              <span className="rc-person">
                {asignadoP && <GenderIcon genero={asignadoP.genero} />}
                {onPerson ? (
                  <button className="person-link rc-pname" onClick={() => onPerson(rec.asignadoId)}>
                    {rec.asignado}
                  </button>
                ) : (
                  <span className="rc-pname">{rec.asignado}</span>
                )}
                {asignadoP?.roles[0] && <RoleBadge role={asignadoP.roles[0]} />}
              </span>
              {rec.ayudante && rec.ayudanteId && (
                <>
                  <span className="rc-con">con</span>
                  <span className="rc-person">
                    {ayudanteP && <GenderIcon genero={ayudanteP.genero} />}
                    {onPerson ? (
                      <button className="person-link rc-pname" onClick={() => onPerson(rec.ayudanteId!)}>
                        {rec.ayudante}
                      </button>
                    ) : (
                      <span className="rc-pname">{rec.ayudante}</span>
                    )}
                    {ayudanteP?.roles[0] && <RoleBadge role={ayudanteP.roles[0]} />}
                  </span>
                </>
              )}
            </span>
          </div>

          {rec.asignacion && (
            <div className="rc-detail-row">
              <span className="rc-detail-label">Asignación</span>
              <span className="rc-task">{rec.asignacion}</span>
            </div>
          )}

          <div className="rc-dates">
            🕓 Creado {fmtDT(rec.createdAt)} · ✏️ {fmtDT(rec.updatedAt)}
          </div>

          <div className="rc-foot">
            <div className="rc-actions">
              <button className="btn btn-edit btn-sm" onClick={() => onEdit(rec)}>
                Editar
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => onDelete(rec)}>
                Borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
