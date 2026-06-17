"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  const toggle = () => {
    const isLight = document.documentElement.classList.toggle("light");
    localStorage.setItem("asgn_theme", isLight ? "light" : "dark");
    setLight(isLight);
  };

  return (
    <button className="hbtn" onClick={toggle} title="Cambiar tema" suppressHydrationWarning>
      {light ? "☀️ Claro" : "🌙 Oscuro"}
    </button>
  );
}
