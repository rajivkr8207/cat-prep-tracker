"use client";

import { useEffect } from "react";
import { Provider, useDispatch, useSelector } from "react-redux";
import { store } from "@/app/store";
import { setTheme } from "@/features/theme/theme.slice";

function ThemeSync() {
  const dispatch = useDispatch();
  const mode = useSelector((state) => state.theme.mode);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("cat-prep-theme");
    const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";

    dispatch(setTheme(savedTheme === "dark" ? "dark" : savedTheme === "light" ? "light" : preferredTheme));
  }, [dispatch]);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    window.localStorage.setItem("cat-prep-theme", mode);
  }, [mode]);

  return null;
}

export default function Providers({ children }) {
  return (
    <Provider store={store}>
      <ThemeSync />
      {children}
    </Provider>
  );
}
