import { useEffect } from "react";

export type Tab = "today" | "log" | "stats" | "system";

const TABS: { id: Tab; label: string; glyph: string }[] = [
  { id: "today", label: "Today", glyph: "◉" },
  { id: "log", label: "Log", glyph: "▤" },
  { id: "stats", label: "Stats", glyph: "∿" },
  { id: "system", label: "System", glyph: "⚙" },
];

/** Slide-in drawer opened by the header hamburger. Replaces the old fixed
 *  bottom nav — same four tabs, more vertical room for content. */
export function Nav({
  open,
  tab,
  onChange,
  onClose,
}: {
  open: boolean;
  tab: Tab;
  onChange: (t: Tab) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="nav-overlay" onClick={onClose}>
      <nav className="nav-drawer" aria-label="Main" onClick={(e) => e.stopPropagation()}>
        <div className="nav-drawer-title">
          CYBER<span className="slash">//</span>FIT
        </div>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              onChange(t.id);
              onClose();
            }}
            aria-current={tab === t.id ? "page" : undefined}
          >
            <span className="glyph" aria-hidden="true">
              {t.glyph}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
