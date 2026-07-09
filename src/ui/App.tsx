import { useEffect, useState } from "react";
import { useSettings } from "./hooks.ts";
import { applyFx, applyTheme } from "./theme/themes.ts";
import { syncPush } from "./notify.ts";
import { autoVaultSync, registerLiveSync, writeLinkedBackup } from "./backupFile.ts";
import { Nav, type Tab } from "./Nav.tsx";
import { InstallPrompt } from "./Install.tsx";
import { RewardToast } from "./components/RewardToast.tsx";
import { CrashKit } from "./components/CrashKit.tsx";
import { Today } from "./screens/Today.tsx";
import { Training } from "./screens/Training.tsx";
import { Bio } from "./screens/Bio.tsx";
import { Feed } from "./screens/Feed.tsx";
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
      {online ? "LINKED" : "OFF-GRID"}
    </span>
  );
}

export function App() {
  const [tab, setTab] = useState<Tab>("directives");
  const [menuOpen, setMenuOpen] = useState(false);
  const [crashKit, setCrashKit] = useState(false);
  const { activeTheme, activeFx } = useSettings();
  useEffect(() => applyTheme(activeTheme), [activeTheme]);
  useEffect(() => applyFx(activeFx ?? []), [activeFx]);
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
      setTab(go === "workout" ? "training" : go === "bio" ? "bio" : "directives");
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
        {tab === "telemetry" && <Stats />}
        {tab === "system" && <System />}
      </main>

      <RewardToast />
      <Nav open={menuOpen} tab={tab} onChange={setTab} onClose={() => setMenuOpen(false)} />
    </>
  );
}
