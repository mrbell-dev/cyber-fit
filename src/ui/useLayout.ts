import { useLiveQuery } from "dexie-react-hooks";
import { getLayout } from "../db/repo";
import { defaultLayout, type LayoutConfig } from "./layout";

export function useLayout(): LayoutConfig {
  return useLiveQuery(getLayout, [], defaultLayout());
}

/**
 * Like useLayout, but `undefined` while the saved layout is still loading.
 * getLayout always resolves to a full config, so `undefined` unambiguously
 * means "not loaded yet" — used by routing, which must not treat a valid
 * custom-page slug as stale before the real layout is in.
 */
export function useLayoutQuery(): LayoutConfig | undefined {
  return useLiveQuery(getLayout, []);
}
