// Theme registry. Themes are pure CSS class swaps on <html> — adding a new one
// (cyberpunk, medieval, whatever) is: a CSS block in tokens.css overriding the
// custom properties + one entry here. `augment` gates it behind an unlock;
// null = always available.

export interface ThemeDef {
  id: string;
  name: string;
  /** augment id required to use it (null = free) */
  augment: string | null;
  /** [bg, magenta, green, purple, yellow] — for the preview swatch strip.
   *  Kept in sync with the html.theme-* palettes in tokens.css. */
  swatch: [string, string, string, string, string];
}

export const THEMES: ThemeDef[] = [
  { id: "electric-city", name: "Electric City", augment: null,
    swatch: ["#1b1b2a", "#ff007a", "#00ffb3", "#a700ff", "#ffea00"] },
  { id: "acid", name: "Acid Rain", augment: "theme-acid",
    swatch: ["#141a12", "#aaff00", "#d8ff4a", "#4dff88", "#f4ff5e"] },
  { id: "ember", name: "Ember District", augment: "theme-ember",
    swatch: ["#201014", "#ff3d00", "#ffb347", "#ff0055", "#ffd166"] },
  { id: "ice", name: "Cryo Sector", augment: "theme-ice",
    swatch: ["#101722", "#4dc3ff", "#9bf0ff", "#7a8cff", "#d6faff"] },
];

export function applyTheme(id: string): void {
  const html = document.documentElement;
  for (const t of THEMES) html.classList.remove(`theme-${t.id}`);
  html.classList.add(`theme-${id}`);
}

export const FX_IDS = ["fx-scanlines", "fx-glitch-title", "fx-crt-flicker"];

export function applyFx(active: string[]): void {
  const html = document.documentElement;
  for (const id of FX_IDS) html.classList.toggle(id, active.includes(id));
}
