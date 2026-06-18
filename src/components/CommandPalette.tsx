"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { usePersons } from "@/lib/hooks";

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  run: () => void;
}

export function CommandPalette() {
  const router = useRouter();
  const { persons } = usePersons();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
  };

  // Abrir con ⌘/Ctrl+K o evento global (botón del header).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const goPerson = (id: string) => {
    sessionStorage.setItem("asgn_spotlight", id);
    router.push("/registros");
  };

  const toggleTheme = () => {
    const isLight = document.documentElement.classList.toggle("light");
    localStorage.setItem("asgn_theme", isLight ? "light" : "dark");
  };

  const items = useMemo<Item[]>(() => {
    const actions: Item[] = [
      { id: "a-nuevo", label: "Nuevo registro", icon: "✏️", run: () => router.push("/nuevo") },
      { id: "a-inicio", label: "Ir a Inicio", icon: "🏠", run: () => router.push("/inicio") },
      { id: "a-registros", label: "Ir a Registros", icon: "📋", run: () => router.push("/registros") },
      { id: "a-personas", label: "Ir a Personas", icon: "👥", run: () => router.push("/personas") },
      { id: "a-tema", label: "Cambiar tema", icon: "🌗", run: toggleTheme },
      { id: "a-logout", label: "Cerrar sesión", icon: "⏻", run: () => signOut({ callbackUrl: "/login" }) },
    ];
    const personItems: Item[] = persons.map((p) => ({
      id: "p-" + p.id,
      label: `${p.nombre} ${p.apellido}`,
      hint: "Ver análisis",
      icon: "🔎",
      run: () => goPerson(p.id),
    }));
    const q = query.toLowerCase().trim();
    const all = [...actions, ...personItems];
    if (!q) return actions; // sin búsqueda: solo acciones
    return all.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, persons]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  const onKeyNav = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return close();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[active];
      if (it) {
        it.run();
        close();
      }
    }
  };

  return (
    <div className="cmd-overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="cmd-panel" onKeyDown={onKeyNav}>
        <div className="cmd-input-wrap">
          <span className="cmd-input-ico">⌕</span>
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Buscar persona o acción…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="cmd-kbd">Esc</kbd>
        </div>
        <div className="cmd-list">
          {items.length === 0 ? (
            <div className="cmd-empty">Sin resultados</div>
          ) : (
            items.map((it, i) => (
              <button
                key={it.id}
                className={`cmd-item${i === active ? " active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  it.run();
                  close();
                }}
              >
                <span className="cmd-item-ico">{it.icon}</span>
                <span className="cmd-item-label">{it.label}</span>
                {it.hint && <span className="cmd-item-hint">{it.hint}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
