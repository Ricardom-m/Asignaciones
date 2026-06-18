"use client";

import { fmtShort, dateStatus, relativeLabel } from "@/lib/client";
import { RoleBadge } from "@/components/RoleBadge";
import { GenderIcon } from "@/components/GenderIcon";
import type { Person, RecordItem } from "@/lib/types";

interface Props {
  rec: RecordItem;
  personsById: Map<string, Person>;
  onEdit: (rec: RecordItem) => void;
  onDelete: (rec: RecordItem) => void;
}

export function RecordCard({ rec, personsById, onEdit, onDelete }: Props) {
  const status = dateStatus(rec.fecha);
  const asignadoP = personsById.get(rec.asignadoId);
  const ayudanteP = rec.ayudanteId ? personsById.get(rec.ayudanteId) : undefined;

  return (
    <div className="record-card">
      <div className="rc-top">
        <div className="rc-when">
          <span className={`rc-status ${status.level}`}>{status.label}</span>
          <span className="rc-date">
            {fmtShort(rec.fecha)} · {relativeLabel(rec.fecha)}
          </span>
        </div>
        {rec.sala && <span className="rc-sala">{rec.sala}</span>}
      </div>

      <div className="rc-people">
        <span className="rc-person">
          {asignadoP && <GenderIcon genero={asignadoP.genero} />}
          <span className="rc-pname">{rec.asignado}</span>
          {asignadoP?.roles[0] && <RoleBadge role={asignadoP.roles[0]} />}
        </span>
        {rec.ayudante && (
          <>
            <span className="rc-con">con</span>
            <span className="rc-person">
              {ayudanteP && <GenderIcon genero={ayudanteP.genero} />}
              <span className="rc-pname">{rec.ayudante}</span>
              {ayudanteP?.roles[0] && <RoleBadge role={ayudanteP.roles[0]} />}
            </span>
          </>
        )}
      </div>

      {rec.asignacion && <div className="rc-task">{rec.asignacion}</div>}

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
  );
}
