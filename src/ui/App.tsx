import { useEffect, useState } from "react";
import { useSettings } from "./hooks.ts";
import { applyTheme } from "./theme/themes.ts";
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
  const { activeTheme } = useSettings();
  useEffect(() => applyTheme(activeTheme), [activeTheme]);

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
