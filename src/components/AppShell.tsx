"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/AccountMenu";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";

interface Props {
  user: { name: string; email: string; image: string };
  children: React.ReactNode;
}

const NAV = [
  { href: "/inicio", label: "Inicio", icon: IconHome },
  { href: "/nuevo", label: "Nuevo", icon: IconEdit },
  { href: "/registros", label: "Registros", icon: IconList },
  { href: "/personas", label: "Personas", icon: IconPeople },
  { href: "/reuniones", label: "Reuniones", icon: IconCalendar },
];

const openCmd = () => window.dispatchEvent(new Event("open-command-palette"));

export function AppShell({ user, children }: Props) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <CommandPalette />

      {/* Sidebar (escritorio) */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="header-icon">📋</div>
          <div>
            <div className="header-title">Asignaciones</div>
            <div className="header-sub">Registro de actividades</div>
          </div>
        </div>
        <button className="sidebar-search" onClick={openCmd}>
          <span>⌕ Buscar…</span>
          <kbd>⌘K</kbd>
        </button>
        <nav className="sidebar-nav">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`sidebar-link${pathname === href ? " active" : ""}`}>
              <Icon />
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
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div className="header-icon">📋</div>
            <div>
              <div className="header-title">Asignaciones</div>
              <div className="header-sub">Registro de actividades</div>
            </div>
          </div>
          <div className="header-right">
            <button className="hbtn" onClick={openCmd} title="Buscar (⌘K)" aria-label="Buscar">🔍</button>
            <ThemeToggleButton />
            <AccountMenu user={user} />
          </div>
        </header>

        <div className="scroll-area">{children}</div>

        <nav className="bottom">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`nav-btn${pathname === href ? " active" : ""}`}>
              <Icon />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M3 9.5L12 3l9 6.5" />
      <path d="M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function IconList() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
