"use client";

import { useMemo, useState } from "react";
import { usePersons } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { createPerson, updatePerson, deletePerson } from "@/lib/client";
import type { Person } from "@/lib/types";

const PAGE = 30;

export default function PersonasPage() {
  const { persons, mutate } = usePersons();
  const toast = useToast();

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<Person | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const all = persons.slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
    return q
      ? all.filter((p) => `${p.nombre} ${p.apellido}`.toLowerCase().includes(q))
      : all;
  }, [persons, query]);

  const visible = filtered.slice(0, limit);

  const add = async () => {
    if (!nombre.trim()) return toast("⚠️ El nombre es obligatorio", "error");
    if (!apellido.trim()) return toast("⚠️ El apellido es obligatorio", "error");
    setSaving(true);
    try {
      await createPerson({ nombre: nombre.trim(), apellido: apellido.trim() });
      await mutate();
      setNombre("");
      setApellido("");
      toast("✅ Persona agregada", "success");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Person) => {
    if (!confirm(`¿Eliminar a ${p.nombre} ${p.apellido}?`)) return;
    try {
      await deletePerson(p.id);
      await mutate();
      toast("🗑️ Persona eliminada");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  return (
    <div className="page-inner fade-up">
      <div className="content-card">
        <div className="section-label">Nueva persona</div>
        <div className="form-grid">
          <div className="row-2">
            <div className="field-group">
              <label className="field-label">
                Nombre <span className="req">*</span>
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Juan"
                autoComplete="off"
              />
            </div>
            <div className="field-group">
              <label className="field-label">
                Apellido <span className="req">*</span>
              </label>
              <input
                type="text"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                placeholder="Ej. Pérez"
                autoComplete="off"
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
            </div>
          </div>
          <button className="btn btn-primary" onClick={add} disabled={saving}>
            {saving ? "Agregando…" : "Agregar persona"}
          </button>
        </div>

        <div className="divider" />
        <div className="section-label">Personas registradas</div>

        <div className="persons-search-wrap">
          <span className="persons-search-ico">⌕</span>
          <input
            className="persons-search-input"
            type="text"
            placeholder="Buscar persona…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            autoComplete="off"
          />
        </div>
        <div className="persons-count">
          {filtered.length} persona{filtered.length !== 1 ? "s" : ""}
          {query ? ` encontrada${filtered.length !== 1 ? "s" : ""}` : ""}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <h3>{query ? "Sin coincidencias" : "Sin personas registradas"}</h3>
            <p>{query ? "Prueba con otro nombre." : "Agrega personas para usarlas en los registros."}</p>
          </div>
        ) : (
          <div className="persons-list">
            {visible.map((p) => (
              <div className="person-row anim-slide" key={p.id}>
                <span className="person-name">
                  {p.nombre} {p.apellido}
                </span>
                <div className="person-actions">
                  <button className="btn btn-edit btn-sm" onClick={() => setEditing(p)}>
                    Editar
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>
                    Borrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {limit < filtered.length && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <button
              className="btn btn-ghost"
              style={{ width: "auto", padding: "8px 24px", fontSize: ".78rem" }}
              onClick={() => setLimit((l) => l + PAGE)}
            >
              Cargar más ↓
            </button>
          </div>
        )}
      </div>

      {editing && (
        <EditPersonModal
          person={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            mutate();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EditPersonModal({
  person,
  onClose,
  onSaved,
}: {
  person: Person;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState(person.nombre);
  const [apellido, setApellido] = useState(person.apellido);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!nombre.trim()) return toast("⚠️ El nombre es obligatorio", "error");
    if (!apellido.trim()) return toast("⚠️ El apellido es obligatorio", "error");
    setSaving(true);
    try {
      await updatePerson(person.id, { nombre: nombre.trim(), apellido: apellido.trim() });
      toast("✏️ Persona actualizada", "success");
      onSaved();
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Editar persona</span>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="form-grid">
          <div className="row-2">
            <div className="field-group">
              <label className="field-label">
                Nombre <span className="req">*</span>
              </label>
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" />
            </div>
            <div className="field-group">
              <label className="field-label">
                Apellido <span className="req">*</span>
              </label>
              <input type="text" value={apellido} onChange={(e) => setApellido(e.target.value)} autoComplete="off" />
            </div>
          </div>
          <div className="divider" />
          <div className="form-actions">
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
            <button className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
