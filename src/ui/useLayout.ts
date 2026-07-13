import { useLiveQuery } from "dexie-react-hooks";
import { getLayout } from "../db/repo";
import { defaultLayout, type LayoutConfig } from "./layout";

export function useLayout(): LayoutConfig {
  return useLiveQuery(getLayout, [], defaultLayout());
}
