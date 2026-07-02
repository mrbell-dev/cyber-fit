export type Tab = "today" | "log" | "stats" | "system";

const TABS: { id: Tab; label: string; glyph: string }[] = [
  { id: "today", label: "Today", glyph: "◉" },
  { id: "log", label: "Log", glyph: "▤" },
  { id: "stats", label: "Stats", glyph: "∿" },
  { id: "system", label: "System", glyph: "⚙" },
];

export function Nav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          aria-current={tab === t.id ? "page" : undefined}
        >
          <span className="glyph" aria-hidden="true">
            {t.glyph}
          </span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
