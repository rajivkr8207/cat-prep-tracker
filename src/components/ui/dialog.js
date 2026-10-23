"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import IconButton from "@/components/ui/icon-button";

export default function Dialog({
  title,
  eyebrow = "YOUR STUDY PLAN",
  onClose,
  children,
  wide = false,
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        aria-labelledby="dialog-title"
        aria-modal="true"
        className={`dialog-card${wide ? " dialog-wide" : ""}`}
        role="dialog"
      >
        <div className="dialog-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2 id="dialog-title">{title}</h2>
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={19} />
          </IconButton>
        </div>
        {children}
      </section>
    </div>
  );
}
