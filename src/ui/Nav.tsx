import { useEffect, useState } from "react";
import { useLayout } from "./useLayout";
import {
  visibleNav, hiddenNav, navLabel, navGlyph, renameNavEntry, setNavHidden, setNavGroup,
  moveNavEntry, type NavEntry,
} from "./layout";
import { setLayout } from "../db/repo";

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
  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);   // entry id
  const [grouping, setGrouping] = useState<string | null>(null);   // entry id
  const [newDrawer, setNewDrawer] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) { setEditing(false); setRenaming(null); setGrouping(null); setNewDrawer(""); }
  }, [open]);

  if (!open) return null;

  const navBtn = (e: NavEntry, sub = false) => (
    <button key={e.id} className={sub ? "nav-sub" : undefined}
      onClick={() => { onChange(tabFor(e)); onClose(); }}
      aria-current={tab === tabFor(e) ? "page" : undefined}>
      <span className="glyph" aria-hidden="true">{navGlyph(e)}</span>
      {navLabel(e)}
    </button>
  );

  const vis = visibleNav(cfg);
  const hidden = hiddenNav(cfg);

  const editRow = (e: NavEntry, inClassified = false) => {
    const sibs = (inClassified ? hidden : vis).filter(
      (m) => (m.group ?? "") === (e.group ?? ""));
    const pos = sibs.findIndex((m) => m.id === e.id);
    const drawers = [...new Set(vis.map((m) => m.group).filter((g): g is string => !!g))];
    return (
      <div key={e.id} className="nav-edit-row">
        <span className="glyph" aria-hidden="true">{navGlyph(e)}</span>
        {renaming === e.id ? (
          <input autoFocus defaultValue={e.label ?? ""} placeholder={navLabel({ ...e, label: undefined })}
            aria-label={`Rename ${navLabel(e)}`}
            onBlur={(ev) => { setLayout(renameNavEntry(cfg, e.id, ev.target.value)); setRenaming(null); }}
            onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }} />
        ) : (
          <button style={{ minHeight: 48, flex: 1, textAlign: "left" }}
            aria-label={`Rename ${navLabel(e)}`} onClick={() => setRenaming(e.id)}>
            {navLabel(e)}
          </button>
        )}
        <button aria-label={`Move ${navLabel(e)} up`} disabled={pos <= 0}
          style={{ minHeight: 48, minWidth: 48 }}
          onClick={() => setLayout(moveNavEntry(cfg, e.id, -1))}>▲</button>
        <button aria-label={`Move ${navLabel(e)} down`} disabled={pos === sibs.length - 1}
          style={{ minHeight: 48, minWidth: 48 }}
          onClick={() => setLayout(moveNavEntry(cfg, e.id, 1))}>▼</button>
        {inClassified ? (
          <button aria-label={`Restore ${navLabel(e)}`} style={{ minHeight: 48 }}
            onClick={() => setLayout(setNavHidden(cfg, e.id, false))}>Restore</button>
        ) : (
          <>
            <button aria-label={`Stash ${navLabel(e)} in CLASSIFIED`} style={{ minHeight: 48 }}
              onClick={() => setLayout(setNavHidden(cfg, e.id, true))}>Stash</button>
            <button aria-label={`Choose drawer for ${navLabel(e)}`} style={{ minHeight: 48 }}
              onClick={() => setGrouping(grouping === e.id ? null : e.id)}>Drawer…</button>
          </>
        )}
        {grouping === e.id && (
          <div role="group" aria-label={`Drawer options for ${navLabel(e)}`} className="nav-group-pick">
            {drawers.map((g) => (
              <button key={g} style={{ minHeight: 48 }}
                onClick={() => { setLayout(setNavGroup(cfg, e.id, g)); setGrouping(null); }}>{g}</button>
            ))}
            <input placeholder="New drawer…" aria-label="New drawer name" value={newDrawer}
              onChange={(ev) => setNewDrawer(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" && newDrawer.trim()) {
                  setLayout(setNavGroup(cfg, e.id, newDrawer)); setNewDrawer(""); setGrouping(null);
                }
              }} />
            <button style={{ minHeight: 48 }}
              onClick={() => { setLayout(setNavGroup(cfg, e.id, undefined)); setGrouping(null); }}>No drawer</button>
          </div>
        )}
      </div>
    );
  };

  // Entries in order; a drawer renders at its first member's position.
  const rendered = new Set<string>();
  const rows: JSX.Element[] = [];
  for (const e of vis) {
    if (!e.group) { rows.push(editing ? editRow(e) : navBtn(e)); continue; }
    if (rendered.has(e.group)) continue;
    rendered.add(e.group);
    const members = vis.filter((m) => m.group === e.group);
    rows.push(
      editing ? (
        <div key={`g:${e.group}`}>
          <div className="nav-group" aria-hidden="true">
            <span className="glyph" aria-hidden="true">◢</span>
            {e.group}
          </div>
          {members.map((m) => editRow(m))}
        </div>
      ) : (
        <DrawerSection key={`g:${e.group}`} name={e.group} entries={members} navBtn={navBtn} />
      ),
    );
  }

  return (
    <div className="nav-overlay" onClick={onClose}>
      <nav className="nav-drawer" aria-label="Main" onClick={(ev) => ev.stopPropagation()}>
        <div className="nav-drawer-title">CYBER<span className="slash">//</span>FIT</div>
        {rows}
        {hidden.length > 0 && (
          <>
            <button className="nav-group classified" onClick={() => setClassifiedOpen(!classifiedOpen)}
              aria-expanded={editing || classifiedOpen}>
              <span className="glyph" aria-hidden="true">▚</span>
              CLASSIFIED
              <span className="nav-caret" aria-hidden="true">{editing || classifiedOpen ? "▾" : "▸"}</span>
            </button>
            {(editing || classifiedOpen) && hidden.map((e) => (editing ? editRow(e, true) : navBtn(e, true)))}
          </>
        )}
        <div className="nav-divider" role="separator" />
        <button onClick={() => { onChange("system"); onClose(); }}
          aria-current={tab === "system" ? "page" : undefined}>
          <span className="glyph" aria-hidden="true">⚙</span>
          System
        </button>
        <button style={{ minHeight: 48, width: "100%" }}
          aria-label={editing ? "Done reconfiguring nav" : "Reconfig nav"}
          onClick={() => { setEditing(!editing); setRenaming(null); setGrouping(null); setNewDrawer(""); }}>
          {editing ? "Done" : "⧉ Reconfig"}
        </button>
        {editing && <p className="dim">Stashed pages wait in CLASSIFIED — nothing is deleted.</p>}
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
