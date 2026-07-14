import { useEffect, useState } from "react";
import { useLayout } from "./useLayout";
import { visibleNav, hiddenNav, navLabel, navGlyph, type NavEntry } from "./layout";

export type Tab = string;

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

const tabFor = (e: NavEntry) => (e.id === "home" ? "directives" : e.id);

function useDrawerOpen(name: string) {
  const key = `nav-drawer-open:${name}`;
  const [open, setOpen] = useState(() => localStorage.getItem(key) !== "0");
  return [open, () => { localStorage.setItem(key, open ? "0" : "1"); setOpen(!open); }] as const;
}

function DrawerSection({ name, entries, navBtn }: {
  name: string; entries: NavEntry[]; navBtn: (e: NavEntry, sub?: boolean) => JSX.Element;
}) {
  const [open, toggle] = useDrawerOpen(name);
  return (
    <>
      <button className="nav-group" onClick={toggle} aria-expanded={open}>
        <span className="glyph" aria-hidden="true">◢</span>
        {name}
        <span className="nav-caret" aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open && entries.map((e) => navBtn(e, true))}
    </>
  );
}

/** Slide-in drawer opened by the header hamburger. Renders `visibleNav(cfg)`
 *  in order (grouped entries collapse into a DrawerSection at the first
 *  member's position), then a collapsed CLASSIFIED drawer for hidden
 *  entries, then the hardcoded System row and version footer. */
export function Nav({ open, tab, onChange, onClose }: {
  open: boolean; tab: string; onChange: (t: string) => void; onClose: () => void;
}) {
  const online = useOnline();
  const cfg = useLayout();
  const [classifiedOpen, setClassifiedOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const navBtn = (e: NavEntry, sub = false) => (
    <button key={e.id} className={sub ? "nav-sub" : undefined}
      onClick={() => { onChange(tabFor(e)); onClose(); }}
      aria-current={tab === tabFor(e) ? "page" : undefined}>
      <span className="glyph" aria-hidden="true">{navGlyph(e)}</span>
      {navLabel(e)}
    </button>
  );

  // Entries in order; a drawer renders at its first member's position.
  const vis = visibleNav(cfg);
  const rendered = new Set<string>();
  const rows: JSX.Element[] = [];
  for (const e of vis) {
    if (!e.group) { rows.push(navBtn(e)); continue; }
    if (rendered.has(e.group)) continue;
    rendered.add(e.group);
    const members = vis.filter((m) => m.group === e.group);
    rows.push(<DrawerSection key={`g:${e.group}`} name={e.group} entries={members} navBtn={navBtn} />);
  }

  const hidden = hiddenNav(cfg);

  return (
    <div className="nav-overlay" onClick={onClose}>
      <nav className="nav-drawer" aria-label="Main" onClick={(ev) => ev.stopPropagation()}>
        <div className="nav-drawer-title">CYBER<span className="slash">//</span>FIT</div>
        {rows}
        {hidden.length > 0 && (
          <>
            <button className="nav-group classified" onClick={() => setClassifiedOpen(!classifiedOpen)}
              aria-expanded={classifiedOpen}>
              <span className="glyph" aria-hidden="true">▚</span>
              CLASSIFIED
              <span className="nav-caret" aria-hidden="true">{classifiedOpen ? "▾" : "▸"}</span>
            </button>
            {classifiedOpen && hidden.map((e) => navBtn(e, true))}
          </>
        )}
        <div className="nav-divider" role="separator" />
        <button onClick={() => { onChange("system"); onClose(); }}
          aria-current={tab === "system" ? "page" : undefined}>
          <span className="glyph" aria-hidden="true">⚙</span>
          System
        </button>
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
