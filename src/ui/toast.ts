// Tiny pub/sub so repo (the write path) can announce fresh XP grants and the
// RewardToast can render them, without coupling db code to React.
import type { Grant } from "../engine/index.ts";

type Listener = (grants: Grant[]) => void;
const listeners = new Set<Listener>();

export function onGrants(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function emitGrants(grants: Grant[]): void {
  if (grants.length === 0) return;
  for (const cb of listeners) cb(grants);
}
