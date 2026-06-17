"use client";

import { fmtDate, fmtDT } from "@/lib/client";
import type { RecordItem } from "@/lib/types";

interface Props {
  rec: RecordItem;
  onEdit: (rec: RecordItem) => void;
  onDelete: (rec: RecordItem) => void;
}

export function RecordCard({ rec, onEdit, onDelete }: Props) {
  const tc = rec.tipo === "Asignado" ? "var(--green)" : "var(--text3)";
  const tb = rec.tipo === "Asignado" ? "var(--green-dim)" : "var(--surface2)";

  return (
    <div className="record-card anim-pop">
      <div className="rc-head">
        <div>
          <div className="rc-name">{rec.asignado}</div>
          {rec.ayudante && <div className="rc-helper">👤 {rec.ayudante}</div>}
        </div>
        {rec.tipo && (
          <span
            className="rc-badge"
            style={{ background: tb, borderColor: tc, color: tc }}
          >
            {rec.tipo}
          </span>
        )}
      </div>
      <div className="rc-body">
        {rec.fecha && (
          <div className="rc-pill">
            📅 <strong>{fmtDate(rec.fecha)}</strong>
          </div>
        )}
        {rec.sala && (
          <div className="rc-pill">
            🏛️ <strong>{rec.sala}</strong>
          </div>
        )}
        {rec.asignacion && (
          <div className="rc-pill">
            📌 <strong>{rec.asignacion}</strong>
          </div>
        )}
      </div>
      <div className="rc-foot">
        <div className="rc-dates">
          🕓 {fmtDT(rec.createdAt)}
          <br />✏️ {fmtDT(rec.updatedAt)}
        </div>
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
  );
}
