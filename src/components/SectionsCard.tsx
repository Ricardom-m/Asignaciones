"use client";

import { useState } from "react";
import { useSections } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/Confirm";
import { createSection, updateSection, deleteSection } from "@/lib/client";
import type { Section } from "@/lib/types";

// Apartado "Secciones" para la página de Reuniones: alta/edición/baja.
export function SectionsCard() {
  const { sections, mutate } = useSections();
  const toast = useToast();
  const [nombre, setNombre] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!nombre.trim()) return toast("⚠️ Escribe el nombre de la sección", "error");
    setBusy(true);
    try {
      await createSection({ nombre: nombre.trim() });
      await mutate();
      setNombre("");
      toast("✅ Sección creada", "success");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="content-card">
      <div className="section-label">Secciones</div>
      <div className="field-hint" style={{ marginTop: 0, marginBottom: 12 }}>
        Aparecen al crear o editar un registro (asignación o nombrado). Solo se elige una por registro.
      </div>

      <div className="role-manage-row">
        <input
          className="role-name-input"
          type="text"
          placeholder="Nueva sección (ej. Tesoros de la Biblia)"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          autoComplete="off"
        />
        <button className="btn btn-primary btn-sm" onClick={add} disabled={busy}>
          Agregar
        </button>
      </div>

      <div className="divider" />
      {sections.length === 0 ? (
        <div style={{ fontSize: ".75rem", color: "var(--text3)" }}>Aún no hay secciones.</div>
      ) : (
        <div className="form-grid" style={{ gap: 8 }}>
          {sections.map((s) => (
            <SectionRow key={s.id} section={s} onChanged={mutate} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionRow({ section, onChanged }: { section: Section; onChanged: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [nombre, setNombre] = useState(section.nombre);
  const dirty = nombre !== section.nombre;

  const save = async () => {
    try {
      await updateSection(section.id, { nombre: nombre.trim() });
      await onChanged();
      toast("✏️ Sección actualizada", "success");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  const toggleActive = async () => {
    try {
      await updateSection(section.id, { active: !section.active });
      await onChanged();
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  const toggleSinAyudante = async () => {
    try {
      await updateSection(section.id, { sinAyudante: !section.sinAyudante });
      await onChanged();
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: "Borrar sección",
      message: `¿Borrar la sección "${section.nombre}"? Los registros que la usaban quedarán sin sección.`,
      confirmText: "Borrar",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteSection(section.id);
      await onChanged();
      toast("🗑️ Sección eliminada");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  return (
    <div style={{ opacity: section.active ? 1 : 0.55 }}>
      <div className="role-manage-row">
        <input
          className="role-name-input"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoComplete="off"
        />
        {dirty ? (
          <button className="btn btn-primary btn-sm" onClick={save}>
            Guardar
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={toggleActive} title="Activar/desactivar">
            {section.active ? "Activa" : "Inactiva"}
          </button>
        )}
        <button className="btn btn-danger btn-sm" onClick={remove}>
          Borrar
        </button>
      </div>
      <label className="switch" style={{ fontSize: ".72rem", marginTop: 6, marginLeft: 2 }}>
        <input type="checkbox" checked={section.sinAyudante} onChange={toggleSinAyudante} />
        <span className="track" />
        Sin ayudante (una sola persona)
      </label>
    </div>
  );
}
