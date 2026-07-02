import { useEffect, useState } from "react";
import { AUGMENTS, type Grant } from "../../engine/index.ts";
import { onGrants } from "../toast.ts";

interface Notice {
  id: number;
  text: string;
  crit: boolean;
  drop: boolean;
}

let nextId = 1;

function noticeFor(g: Grant): Notice {
  if (g.drop) {
    const aug = AUGMENTS.find((a) => a.id === g.drop);
    return { id: nextId++, text: `DATA SHARD → ${aug?.name ?? g.drop} unlocked`, crit: false, drop: true };
  }
  const label =
    g.source === "daily" ? "first sync of the day" :
    g.source === "combo" ? "ALL SYSTEMS SYNCED" : g.source;
  return {
    id: nextId++,
    text: g.crit ? `CRITICAL SYNC — +${g.xp} XP (${label})` : `+${g.xp} XP — ${label}`,
    crit: g.crit,
    drop: false,
  };
}

export function RewardToast() {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(
    () =>
      onGrants((grants) => {
        const fresh = grants.flatMap((g) => {
          const n = [noticeFor(g)];
          if (g.drop) n.unshift(noticeFor({ ...g, drop: undefined }));
          return n;
        });
        setNotices((cur) => [...cur, ...fresh].slice(-4));
        for (const n of fresh) {
          setTimeout(() => setNotices((cur) => cur.filter((x) => x.id !== n.id)), 3500);
        }
      }),
    [],
  );

  if (notices.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {notices.map((n) => (
        <div key={n.id} className={`toast${n.crit ? " crit" : ""}${n.drop ? " drop" : ""}`}>
          {n.text}
        </div>
      ))}
    </div>
  );
}
