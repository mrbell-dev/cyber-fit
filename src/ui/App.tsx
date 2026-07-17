import { useEffect, useMemo, useState } from "react";
import { useSettings } from "./hooks.ts";
import { applyFx, applyTheme } from "./theme/themes.ts";
import { syncPush } from "./notify.ts";
import { autoVaultSync, registerLiveSync, writeLinkedBackup } from "./backupFile.ts";
import { Nav } from "./Nav.tsx";
import { InstallPrompt } from "./Install.tsx";
import { RewardToast } from "./components/RewardToast.tsx";
import { CrashKit } from "./components/CrashKit.tsx";
import { Dashboard } from "./components/Dashboard.tsx";
import { useLayoutQuery } from "./useLayout.ts";
import { defaultLayout, type LayoutConfig } from "./layout.ts";
import { Today } from "./screens/Today.tsx";
import { Training } from "./screens/Training.tsx";
import { Bio } from "./screens/Bio.tsx";
import { Feed } from "./screens/Feed.tsx";
import { Goals } from "./screens/Goals.tsx";
import { Stats } from "./screens/Stats.tsx";
import { System } from "./screens/System.tsx";

/** Offline is the default state here, not an error — wear it as a badge. */
function OffGridChip() {
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
  return (
    <span className={online ? "status-chip" : "status-chip offgrid"}>
      {online ? "ON-GRID" : "OFF-GRID"}
    </span>
  );
}

// URL ↔ tab mapping: "/" is the default screen ("directives"); every other tab
// lives at /<tab> (e.g. cyberfit.dev/training) so screens are linkable and
// survive hard reloads. Custom dashboard pages get /<page-id> the same way.
const tabFromPath = () =>
  decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, "")) || "directives";

const BUILTIN_TABS = new Set([
  "directives",
  "training",
  "bio",
  "feed",
  "goals",
  "telemetry",
  "system",
]);

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Custom pages get human URLs from their nav label ("Protein Tracker" →
// /protein-tracker). We fall back to the raw page id (a UUID) when the label
// slugs to nothing, shadows a built-in screen, or collides with another page.
const pathForTab = (tab: string, layout: LayoutConfig): string => {
  if (tab === "directives") return "/";
  if (BUILTIN_TABS.has(tab)) return `/${tab}`;
  const entry = layout.nav.find((n) => n.id === tab);
  const slug = slugify(entry?.label ?? "");
  const usable = slug !== "" && !BUILTIN_TABS.has(slug) &&
    layout.nav.filter((n) => slugify(n.label ?? "") === slug).length === 1;
  return `/${encodeURIComponent(usable ? slug : tab)}`;
};

// Reverse mapping: a path segment may be a built-in tab, a page id, or a page
// label slug — resolve it back to the canonical tab id.
const resolveTab = (layout: LayoutConfig): string => {
  const raw = tabFromPath();
  if (raw === "directives" || BUILTIN_TABS.has(raw)) return raw;
  const entry = layout.nav.find(
    (n) => n.id === raw || slugify(n.label ?? "") === raw,
  );
  return entry ? entry.id : raw;
};

export function App() {
  const [tab, setTabState] = useState<string>(tabFromPath);
  // Every tab change is a history entry, so back/forward walk between screens
  // and a hard reload lands right back on the same one.
  const [menuOpen, setMenuOpen] = useState(false);
  const [crashKit, setCrashKit] = useState(false);
  // `layoutQ` is undefined until the saved layout loads from Dexie; `layout`
  // substitutes the defaults so rendering never blocks on the query.
  const layoutQ = useLayoutQuery();
  const layout = useMemo(() => layoutQ ?? defaultLayout(), [layoutQ]);
  const setTab = (next: string) => {
    setTabState(next);
    const path = pathForTab(next, layout);
    if (location.pathname !== path) history.pushState(null, "", path);
  };
  // Slug URLs (/protein-tracker) can only be resolved against the saved
  // layout — re-map the current path once it arrives (and again on renames,
  // which change slugs). Paths that match nothing are stale links (deleted or
  // renamed pages, typos): redirect them to "/" so the bar never holds a dead
  // URL. Runs only after the real layout is in, so a valid custom-page slug is
  // never misjudged as stale during load.
  useEffect(() => {
    if (!layoutQ) return;
    const next = resolveTab(layoutQ);
    const known = next === "directives" || BUILTIN_TABS.has(next) ||
      layoutQ.nav.some((n) => n.id === next);
    if (known) {
      setTabState(next);
    } else {
      history.replaceState(null, "", "/");
      setTabState("directives");
    }
  }, [layoutQ]);
  const { activeTheme, activeFx } = useSettings();
  useEffect(() => applyTheme(activeTheme), [activeTheme]);
  useEffect(() => applyFx(activeFx ?? []), [activeFx]);
  // Anywhere in the tree can open the crash kit (e.g. screener results) —
  // crisis access must never depend on prop drilling.
  useEffect(() => {
    const open = () => setCrashKit(true);
    window.addEventListener("cf-open-crashkit", open);
    return () => window.removeEventListener("cf-open-crashkit", open);
  }, []);
  // Browser back/forward → swap screens without touching the history stack.
  useEffect(() => {
    const onPop = () => setTabState(resolveTab(layout));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [layout]);
  // Re-upload reminder slots on every open (handles DST drift; harmless no-op
  // when push was never enabled).
  useEffect(() => {
    syncPush();
    writeLinkedBackup();
    registerLiveSync();
    autoVaultSync();
    // Notification deep link: ?go=workout|bio|water|… → land on the right screen.
    const go = new URLSearchParams(location.search).get("go");
    if (go) {
      setTab(
        go === "workout"
          ? "training"
          : go === "bio"
            ? "bio"
            : go === "goal"
              ? "goals"
              : go === "gig"
                ? "home" // gigs block lives on the home board by default
                : "directives",
      );
      history.replaceState(null, "", location.pathname);
    }
  }, []);

  return (
    <>
      <header className="app-header">
        <span className="header-left">
          <button
            className="menu-btn"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            ☰
          </button>
          <h1 className="app-title">
            CYBER<span className="slash">//</span>FIT
          </h1>
        </span>
        <span className="header-right">
          <button className="crash-btn" aria-label="Open crash kit" onClick={() => setCrashKit(true)}>
            ✚
          </button>
          <OffGridChip />
        </span>
      </header>
      {crashKit && <CrashKit onClose={() => setCrashKit(false)} />}

      <main className="screen">
        <InstallPrompt />
        {tab === "directives" && <Today />}
        {tab === "training" && <Training />}
        {tab === "bio" && <Bio />}
        {tab === "feed" && <Feed />}
        {tab === "goals" && <Goals />}
        {tab === "telemetry" && <Stats />}
        {tab === "system" && <System />}
        {layout.pages.some((p) => p.id === tab) && <Dashboard pageId={tab} />}
        {/* Unknown URL (stale bookmark, deleted custom page) → home screen. */}
        {!BUILTIN_TABS.has(tab) && !layout.pages.some((p) => p.id === tab) && <Today />}
      </main>

      <RewardToast />
      <Nav open={menuOpen} tab={tab} onChange={setTab} onClose={() => setMenuOpen(false)}
        onCrashKit={() => { setMenuOpen(false); setCrashKit(true); }} />
    </>
  );
}
