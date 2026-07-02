// Theme registry. Themes are pure CSS class swaps on <html> — adding a new one
// (cyberpunk, medieval, whatever) is: a CSS block in tokens.css overriding the
// custom properties + one entry here. `augment` gates it behind an unlock;
// null = always available.

export interface ThemeDef {
  id: string;
  name: string;
  /** augment id required to use it (null = free) */
  augment: string | null;
}

export const THEMES: ThemeDef[] = [
  { id: "electric-city", name: "Electric City", augment: null },
  { id: "acid", name: "Acid Rain", augment: "theme-acid" },
  { id: "ember", name: "Ember District", augment: "theme-ember" },
  { id: "ice", name: "Cryo Sector", augment: "theme-ice" },
];

export function applyTheme(id: string): void {
  const html = document.documentElement;
  for (const t of THEMES) html.classList.remove(`theme-${t.id}`);
  html.classList.add(`theme-${id}`);
}
