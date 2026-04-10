"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("app-theme");
    const initialTheme: ThemeMode = saved === "dark" ? "dark" : "light";

    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(initialTheme);

    setTheme(initialTheme);
    setMounted(true);
  }, []);

  function setAppTheme(nextTheme: ThemeMode) {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(nextTheme);
    window.localStorage.setItem("app-theme", nextTheme);
    setTheme(nextTheme);
  }

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={() => setAppTheme(theme === "dark" ? "light" : "dark")}
      className="app-button-secondary px-3 py-2 text-sm"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? "Light Mode" : "Dark Mode"}
    </button>
  );
}
