import { useState } from "react";
import { useLayout } from "../useLayout";
import { setLayout } from "../../db/repo";
import { addBlock, removeBlock, moveBlock } from "../layout";
import { BLOCKS } from "../blocks";

export function Dashboard({ pageId }: { pageId: string }) {
  const cfg = useLayout();
  const [editing, setEditing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const page = cfg.pages.find((p) => p.id === pageId);
  if (!page) return <p>Page offline. Head to System to reset your layout.</p>;

  const installed = new Set(page.blocks);

  return (
    <section aria-label="Dashboard">
      <div className="dash-header">
        <button
          aria-label={editing ? "Done reconfiguring" : "Reconfig dashboard"}
          style={{ minHeight: 48, minWidth: 48 }}
          onClick={() => { setEditing(!editing); setSheetOpen(false); }}
        >
          {editing ? "Done" : "⧉ Reconfig"}
        </button>
      </div>

      {page.blocks.map((id, i) => {
        const def = BLOCKS[id];
        if (!def) return null; // unknown id (future version) — skip, never crash
        return (
          <div key={id} className="dash-block">
            {editing && (
              <div className="block-toolbar" role="group" aria-label={`${def.name} controls`}>
                <button aria-label={`Move ${def.name} up`} disabled={i === 0}
                  style={{ minHeight: 48, minWidth: 48 }}
                  onClick={() => setLayout(moveBlock(cfg, pageId, id, -1))}>▲</button>
                <button aria-label={`Move ${def.name} down`} disabled={i === page.blocks.length - 1}
                  style={{ minHeight: 48, minWidth: 48 }}
                  onClick={() => setLayout(moveBlock(cfg, pageId, id, 1))}>▼</button>
                <button aria-label={`Remove ${def.name}`}
                  style={{ minHeight: 48, minWidth: 48 }}
                  onClick={() => setLayout(removeBlock(cfg, pageId, id))}>✕</button>
              </div>
            )}
            <div style={editing ? { pointerEvents: "none", opacity: 0.6 } : undefined}>
              <def.Component />
            </div>
          </div>
        );
      })}

      {editing && (
        <>
          <button style={{ minHeight: 48, width: "100%" }} onClick={() => setSheetOpen(true)}>
            + Add block
          </button>
          <p className="dim">Removed blocks are unplugged, not wiped — your logs are untouched.</p>
        </>
      )}

      {sheetOpen && (
        <div className="overlay">
          <div className="modal" role="dialog" aria-label="Add block">
            {Object.values(BLOCKS).map((def) => (
              <button key={def.id} disabled={installed.has(def.id)}
                style={{ minHeight: 48, width: "100%", textAlign: "left" }}
                onClick={() => { setLayout(addBlock(cfg, pageId, def.id)); setSheetOpen(false); }}>
                <strong>{def.name}</strong>
                {installed.has(def.id) ? " — installed" : ""}
                <div className="dim">{def.desc}</div>
              </button>
            ))}
            <button style={{ minHeight: 48, width: "100%" }} onClick={() => setSheetOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </section>
  );
}
