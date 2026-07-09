import { useEffect, useState } from "react";

export type Tab = "directives" | "training" | "bio" | "feed" | "goals" | "telemetry" | "system";

type Item = { id: Tab; label: string; glyph: string };

const GRIND_ITEMS: Item[] = [
  { id: "training", label: "Training", glyph: "⚔" },
  { id: "bio", label: "Bio", glyph: "⌬" },
  { id: "feed", label: "Feed", glyph: "▤" },
  { id: "goals", label: "Goals", glyph: "◎" },
];

const GRIND_OPEN_KEY = "nav-grind-open";
const VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

/** Slide-in drawer opened by the header hamburger. Sections: Directives up
 *  top, the Grind group (Training / Bio / Feed / Goals) collapsible in the middle,
 *  Telemetry + System below, version footer at the bottom. */
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
  const online = useOnline();
  const [grindOpen, setGrindOpen] = useState(
    () => localStorage.getItem(GRIND_OPEN_KEY) !== "0",
  );
  const toggleGrind = () => {
    setGrindOpen((v) => {
      localStorage.setItem(GRIND_OPEN_KEY, v ? "0" : "1");
      return !v;
    });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const navBtn = (t: Item, sub = false) => (
    <button
      key={t.id}
      className={sub ? "nav-sub" : undefined}
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
  );

  return (
    <div className="nav-overlay" onClick={onClose}>
      <nav className="nav-drawer" aria-label="Main" onClick={(e) => e.stopPropagation()}>
        <div className="nav-drawer-title">
          CYBER<span className="slash">//</span>FIT
        </div>

        {navBtn({ id: "directives", label: "Directives", glyph: "◉" })}

        <div className="nav-divider" role="separator" />

        <button className="nav-group" onClick={toggleGrind} aria-expanded={grindOpen}>
          <span className="glyph" aria-hidden="true">◢</span>
          Grind
          <span className="nav-caret" aria-hidden="true">{grindOpen ? "▾" : "▸"}</span>
        </button>
        {grindOpen && GRIND_ITEMS.map((t) => navBtn(t, true))}

        <div className="nav-divider" role="separator" />

        {navBtn({ id: "telemetry", label: "Telemetry", glyph: "∿" })}
        {navBtn({ id: "system", label: "System", glyph: "⚙" })}

        <div className="nav-footer">
          <span>v{VERSION}</span>
          <span className={online ? "status-chip" : "status-chip offgrid"}>
            {online ? "LINKED" : "OFF-GRID"}
          </span>
        </div>
      </nav>
    </div>
  );
}
