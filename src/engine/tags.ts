// #tag system: tags are parsed from free text anywhere the user types —
// workout names/notes, reading notes, highlights, mood notes. "#lift #workout"
// tags an entry with both; the Tag Explorer intersects selected tags.

const TAG_RE = /#([\p{L}\p{N}_-]+)/gu;

export function parseTags(text: string): string[] {
  const tags = new Set<string>();
  for (const m of text.matchAll(TAG_RE)) tags.add(m[1].toLowerCase());
  return [...tags];
}

/** Strip tags for clean display (collapses leftover double spaces). */
export function stripTags(text: string): string {
  return text.replace(TAG_RE, "").replace(/\s{2,}/g, " ").trim();
}

export interface TaggedEntry {
  kind: "workout" | "reading" | "highlight" | "mood";
  ts: number;
  dayKey: string;
  text: string;
  tags: string[];
}

/** All entries carrying every one of `selected` (empty selection = all tagged). */
export function filterByTags(entries: TaggedEntry[], selected: string[]): TaggedEntry[] {
  return entries
    .filter((e) => e.tags.length > 0 && selected.every((t) => e.tags.includes(t)))
    .sort((a, b) => b.ts - a.ts);
}

export function tagCounts(entries: TaggedEntry[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of entries) for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
