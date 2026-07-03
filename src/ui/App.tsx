import { useEffect, useState } from "react";
import { useSettings } from "./hooks.ts";
import { applyFx, applyTheme } from "./theme/themes.ts";
import { syncPush } from "./notify.ts";
import { writeLinkedBackup } from "./backupFile.ts";
import { Nav, type Tab } from "./Nav.tsx";
import { InstallPrompt } from "./Install.tsx";
import { RewardToast } from "./components/RewardToast.tsx";
import { Today } from "./screens/Today.tsx";
import { Log } from "./screens/Log.tsx";
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
  const [tab, setTab] = useState<Tab>("today");
  const { activeTheme, activeFx } = useSettings();
  useEffect(() => applyTheme(activeTheme), [activeTheme]);
  useEffect(() => applyFx(activeFx ?? []), [activeFx]);
  // Re-upload reminder slots on every open (handles DST drift; harmless no-op
  // when push was never enabled).
  useEffect(() => {
    syncPush();
    writeLinkedBackup();
    // Notification deep link: ?go=workout|bio|water|… → land on the right screen.
    const go = new URLSearchParams(location.search).get("go");
    if (go) {
      setTab(go === "workout" || go === "bio" ? "log" : "today");
      history.replaceState(null, "", location.pathname);
    }
  }, []);

  return (
    <>
      <header className="app-header">
        <h1 className="app-title">
          CYBER<span className="slash">//</span>FIT
        </h1>
        <OffGridChip />
      </header>

      <main className="screen">
        <InstallPrompt />
        {tab === "today" && <Today />}
        {tab === "log" && <Log />}
        {tab === "stats" && <Stats />}
        {tab === "system" && <System />}
      </main>

      <RewardToast />
      <Nav tab={tab} onChange={setTab} />
    </>
  );
}
