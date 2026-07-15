import { useState } from "react";
import { useLayout } from "../useLayout";
import {
  visibleNav, hiddenNav, navLabel, navGlyph, renameNavEntry, setNavHidden, setNavGroup,
  moveNavEntry, addPage, deletePage, type NavEntry,
} from "../layout";
import { setLayout } from "../../db/repo";
import { IconPicker } from "./IconPicker";

/** Menu-layout editor — lives in System (not the 260px drawer, where the
 *  per-row controls overflowed). Rename, reorder, group into drawers, stash to
 *  CLASSIFIED, and add/delete custom pages. The nav drawer itself is now
 *  navigation-only. */
export function NavLayoutEditor() {
  const cfg = useLayout();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [grouping, setGrouping] = useState<string | null>(null);
  const [newDrawer, setNewDrawer] = useState("");
  const [newPage, setNewPage] = useState<{ name: string; glyph: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const vis = visibleNav(cfg);
  const hidden = hiddenNav(cfg);
  const drawers = [...new Set(vis.map((m) => m.group).filter((g): g is string => !!g))];

  const editRow = (e: NavEntry, inClassified = false) => {
    const sibs = (inClassified ? hidden : vis).filter((m) => (m.group ?? "") === (e.group ?? ""));
    const pos = sibs.findIndex((m) => m.id === e.id);
    return (
      <div key={e.id} className="nav-edit-row">
        <span className="glyph" aria-hidden="true">{navGlyph(e)}</span>
        {renaming === e.id ? (
          <input autoFocus defaultValue={e.label ?? ""} placeholder={navLabel({ ...e, label: undefined })}
            aria-label={`Rename ${navLabel(e)}`}
            onBlur={(ev) => { setLayout(renameNavEntry(cfg, e.id, ev.target.value)); setRenaming(null); }}
            onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }} />
        ) : (
          <button className="nav-edit-name" aria-label={`Rename ${navLabel(e)}`} onClick={() => setRenaming(e.id)}>
            {navLabel(e)}
          </button>
        )}
        <button className="nav-edit-btn" aria-label={`Move ${navLabel(e)} up`} disabled={pos <= 0}
          onClick={() => setLayout(moveNavEntry(cfg, e.id, -1))}>▲</button>
        <button className="nav-edit-btn" aria-label={`Move ${navLabel(e)} down`} disabled={pos === sibs.length - 1}
          onClick={() => setLayout(moveNavEntry(cfg, e.id, 1))}>▼</button>
        {inClassified ? (
          <button className="nav-edit-btn wide" aria-label={`Restore ${navLabel(e)}`}
            onClick={() => setLayout(setNavHidden(cfg, e.id, false))}>Restore</button>
        ) : (
          <>
            <button className="nav-edit-btn wide" aria-label={`Stash ${navLabel(e)} in CLASSIFIED`}
              onClick={() => setLayout(setNavHidden(cfg, e.id, true))}>Stash</button>
            <button className="nav-edit-btn wide" aria-label={`Choose drawer for ${navLabel(e)}`}
              onClick={() => setGrouping(grouping === e.id ? null : e.id)}>Drawer…</button>
          </>
        )}
        {e.kind === "page" && e.id !== "home" && (
          <button className="nav-edit-btn wide" aria-label={`Delete ${navLabel(e)}`}
            onClick={() => {
              if (confirmDelete !== e.id) { setConfirmDelete(e.id); return; }
              setLayout(deletePage(cfg, e.id));
              setConfirmDelete(null);
            }}>
            {confirmDelete === e.id ? "Confirm" : "Delete"}
          </button>
        )}
        {confirmDelete === e.id && (
          <p className="dim nav-edit-full">Deletes the page layout only — every log you recorded survives.</p>
        )}
        {grouping === e.id && (
          <div role="group" aria-label={`Drawer options for ${navLabel(e)}`} className="nav-group-pick nav-edit-full">
            {drawers.map((g) => (
              <button key={g} className="nav-edit-btn wide"
                onClick={() => { setLayout(setNavGroup(cfg, e.id, g)); setGrouping(null); }}>{g}</button>
            ))}
            <input placeholder="New drawer…" aria-label="New drawer name" value={newDrawer}
              onChange={(ev) => setNewDrawer(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" && newDrawer.trim()) {
                  setLayout(setNavGroup(cfg, e.id, newDrawer)); setNewDrawer(""); setGrouping(null);
                }
              }} />
            <button className="nav-edit-btn wide"
              onClick={() => { setLayout(setNavGroup(cfg, e.id, undefined)); setGrouping(null); }}>No drawer</button>
          </div>
        )}
      </div>
    );
  };

  // Visible entries in order; grouped entries render under their drawer heading.
  const rendered = new Set<string>();
  const rows: JSX.Element[] = [];
  for (const e of vis) {
    if (!e.group) { rows.push(editRow(e)); continue; }
    if (rendered.has(e.group)) continue;
    rendered.add(e.group);
    const members = vis.filter((m) => m.group === e.group);
    rows.push(
      <div key={`g:${e.group}`} className="nav-edit-group">
        <div className="nav-edit-group-title">
          <span className="glyph" aria-hidden="true">◢</span> {e.group}
        </div>
        {members.map((m) => editRow(m))}
      </div>,
    );
  }

  return (
    <div className="card">
      <h2 className="card-title">Menu Layout</h2>
      <p className="placeholder">
        // rename, reorder, group into drawers, or stash pages you don't use.
        stashed pages wait in CLASSIFIED — nothing is deleted
      </p>
      {rows}

      {hidden.length > 0 && (
        <>
          <div className="nav-edit-group-title classified">
            <span className="glyph" aria-hidden="true">▚</span> CLASSIFIED
          </div>
          {hidden.map((e) => editRow(e, true))}
        </>
      )}

      {newPage ? (
        <div className="nav-new-page">
          <input autoFocus aria-label="Page name" placeholder="Page name" value={newPage.name}
            onChange={(ev) => setNewPage({ ...newPage, name: ev.target.value })} />
          <IconPicker icon={newPage.glyph} onPick={(g) => setNewPage({ ...newPage, glyph: g })} />
          <button className="btn" onClick={async () => {
            const { cfg: next } = addPage(cfg, newPage.name, newPage.glyph);
            await setLayout(next);
            setNewPage(null);
          }}>Create</button>
          <button className="btn ghost" onClick={() => setNewPage(null)}>Cancel</button>
        </div>
      ) : (
        <button className="btn ghost nav-add-page" onClick={() => setNewPage({ name: "", glyph: "⚡" })}>
          + New page
        </button>
      )}
    </div>
  );
}
