"use client";

import { Moon, Sun } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { toggleTheme } from "@/features/theme/theme.slice";

export default function ThemeToggle() {
  const dispatch = useDispatch();
  const mode = useSelector((state) => state.theme.mode);

  return (
    <button
      aria-label={`Switch to ${mode === "light" ? "dark" : "light"} mode`}
      className="theme-toggle"
      onClick={() => dispatch(toggleTheme())}
      type="button"
    >
      {mode === "light" ? <Moon size={17} /> : <Sun size={17} />}
      <span>{mode === "light" ? "Dark mode" : "Light mode"}</span>
    </button>
  );
}
