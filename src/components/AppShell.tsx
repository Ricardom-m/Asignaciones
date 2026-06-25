"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  House,
  NotePencil,
  ListBullets,
  UsersThree,
  CalendarBlank,
  CalendarCheck,
  ClipboardText,
  MagnifyingGlass,
  List as ListIcon,
} from "@phosphor-icons/react";
import { AccountMenu } from "@/components/AccountMenu";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";

interface Props {
  user: { name: string; email: string; image: string; isAdmin?: boolean };
  children: React.ReactNode;
}

const NAV = [
  { href: "/inicio", label: "Inicio", icon: House },
  { href: "/planificar", label: "Planificar", icon: CalendarCheck },
  { href: "/nuevo", label: "Nuevo", icon: NotePencil },
  { href: "/registros", label: "Registros", icon: ListBullets },
  { href: "/personas", label: "Personas", icon: UsersThree },
  { href: "/reuniones", label: "Reuniones", icon: CalendarBlank },
];

const openCmd = () => window.dispatchEvent(new Event("open-command-palette"));

function BrandIcon() {
  return (
    <div className="header-icon">
      <ClipboardText size={17} weight="bold" color="#fff" />
    </div>
  );
}

export function AppShell({ user, children }: Props) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);

  // Cerrar el drawer al navegar o con Esc.
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <div className="app-shell">
      <CommandPalette />

      {/* Overlay del drawer (móvil/tablet) */}
      <div className={`drawer-overlay${drawer ? " open" : ""}`} onClick={() => setDrawer(false)} />

      {/* Menú lateral: drawer en móvil/tablet, fijo en escritorio */}
      <aside className={`sidebar${drawer ? " open" : ""}`}>
        <div className="sidebar-brand">
          <BrandIcon />
          <div>
            <div className="header-title">Asignaciones</div>
            <div className="header-sub">Registro de actividades</div>
          </div>
        </div>
        <button
          className="sidebar-search"
          onClick={() => {
            setDrawer(false);
            openCmd();
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <MagnifyingGlass size={14} weight="bold" /> Buscar…
          </span>
          <kbd>⌘K</kbd>
        </button>
        <nav className="sidebar-nav">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`sidebar-link${pathname === href ? " active" : ""}`} onClick={() => setDrawer(false)}>
              <Icon weight={pathname === href ? "fill" : "regular"} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <AccountMenu user={user} showName />
          <ThemeToggleButton />
        </div>
      </aside>

      {/* Columna principal */}
      <div className="app-main">
        <header className="topbar">
          <button className="hbtn drawer-btn" onClick={() => setDrawer(true)} aria-label="Menú" title="Menú">
            <ListIcon size={18} weight="bold" />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0, minWidth: 0 }}>
            <BrandIcon />
            <div style={{ minWidth: 0 }}>
              <div className="header-title">Asignaciones</div>
            </div>
          </div>
          <div className="header-right">
            <button className="hbtn" onClick={openCmd} title="Buscar (⌘K)" aria-label="Buscar">
              <MagnifyingGlass size={17} weight="bold" />
            </button>
            <AccountMenu user={user} />
          </div>
        </header>

        <div className="scroll-area">{children}</div>
      </div>
    </div>
  );
}
