import { useEffect, useState } from "react";
import { saveSettings } from "../../db/repo.ts";
import { syncPush } from "../notify.ts";
import { useSettings } from "../hooks.ts";

/** Shared-relay access code (closed beta). Saved on blur; re-syncs push so a
 *  newly-entered code takes effect immediately. Self-hosters leave it blank. */
export function AccessCodeField() {
  const settings = useSettings();
  const [value, setValue] = useState("");
  useEffect(() => setValue(settings.relayCode ?? ""), [settings.relayCode]);
  const save = async () => {
    const code = value.trim();
    if (code === (settings.relayCode ?? "")) return;
    await saveSettings({ relayCode: code });
    await syncPush();
  };
  return (
    <div className="form-row">
      <input
        className="input"
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="access code (closed beta)"
        aria-label="Relay access code"
        autoComplete="off"
      />
    </div>
  );
}
