import { describe, expect, it } from "vitest";
import { planMerge } from "./merge.ts";

const vaultFile = (tables: Record<string, unknown[]>) => ({
  app: "cyber-fit" as const,
  schemaVersion: 7,
  exportedAt: "2026-07-09T11:19:48.829Z",
  tables,
});

describe("planMerge — union by id, local wins", () => {
  it("adds rows whose id is unknown locally, keeps local rows on conflict", () => {
    const local = {
      gigs: [{ id: "g1", text: "local edit", createdDay: "2026-07-08", ts: 1 }],
      waterLogs: [{ id: "w1", dayKey: "2026-07-08", ts: 5, ml: 350 }],
    };
    const incoming = vaultFile({
      gigs: [
        { id: "g1", text: "stale copy", createdDay: "2026-07-08", ts: 1 },
        { id: "g2", text: "get an appointment for my passport", createdDay: "2026-07-09", ts: 9 },
      ],
      waterLogs: [{ id: "w2", dayKey: "2026-07-09", ts: 9, ml: 350 }],
    });
    const plan = planMerge(local, incoming);
    expect(plan.adds.gigs).toEqual([incoming.tables.gigs[1]]);
    expect(plan.adds.waterLogs).toEqual([{ id: "w2", dayKey: "2026-07-09", ts: 9, ml: 350 }]);
  });

  it("gig completion/retire set in the vault fills a local row that lacks it", () => {
    const local = {
      gigs: [
        { id: "g1", text: "buy milk", createdDay: "2026-07-08", ts: 1 },
        { id: "g2", text: "call dentist", createdDay: "2026-07-08", ts: 2 },
      ],
    };
    const incoming = vaultFile({
      gigs: [
        { id: "g1", text: "buy milk", createdDay: "2026-07-08", ts: 1, doneTs: 99, doneDay: "2026-07-09" },
        { id: "g2", text: "call dentist", createdDay: "2026-07-08", ts: 2, retiredDay: "2026-07-09" },
      ],
    });
    const plan = planMerge(local, incoming);
    expect(plan.gigPatches).toEqual([
      { id: "g1", patch: { doneTs: 99, doneDay: "2026-07-09" } },
      { id: "g2", patch: { retiredDay: "2026-07-09" } },
    ]);
  });

  it("a locally-completed gig is never un-done by a stale open copy", () => {
    const local = {
      gigs: [{ id: "g1", text: "buy milk", createdDay: "2026-07-08", ts: 1, doneTs: 50, doneDay: "2026-07-08" }],
    };
    const incoming = vaultFile({
      gigs: [{ id: "g1", text: "buy milk", createdDay: "2026-07-08", ts: 1 }],
    });
    const plan = planMerge(local, incoming);
    expect(plan.gigPatches).toEqual([]);
    expect(plan.adds.gigs ?? []).toEqual([]);
  });

  it("never merges kv, ignores unknown tables, leaves absent tables alone", () => {
    const local = { goals: [{ id: "go1", name: "read 12 books" }] };
    const incoming = vaultFile({
      kv: [{ key: "lastBootDay", value: "2026-07-01" }],
      mystery: [{ id: "m1" }],
      // no goals table at all (schemaVersion 7 blob) — local goals must survive
    });
    const plan = planMerge(local, incoming);
    expect(plan.adds).toEqual({});
    expect(plan.gigPatches).toEqual([]);
  });

  it("a local tombstone blocks the vault from resurrecting the deleted row", () => {
    const local = {
      gigs: [],
      tombstones: [{ id: "g1", table: "gigs", ts: 100 }],
    };
    const incoming = vaultFile({
      gigs: [{ id: "g1", text: "deleted on the phone", createdDay: "2026-07-08", ts: 1 }],
    });
    const plan = planMerge(local, incoming);
    expect(plan.adds.gigs ?? []).toEqual([]);
    expect(plan.removes).toEqual([]);
  });

  it("an incoming tombstone deletes the matching local row and syncs the tombstone", () => {
    const local = {
      gigs: [{ id: "g1", text: "deleted elsewhere", createdDay: "2026-07-08", ts: 1 }],
      tombstones: [],
    };
    const incoming = vaultFile({
      gigs: [],
      tombstones: [{ id: "g1", table: "gigs", ts: 100 }],
    });
    const plan = planMerge(local, incoming);
    expect(plan.removes).toEqual([{ table: "gigs", id: "g1" }]);
    expect(plan.adds.tombstones).toEqual([{ id: "g1", table: "gigs", ts: 100 }]);
  });

  it("old vault without a tombstones table still merges (nothing removed)", () => {
    const local = { gigs: [{ id: "g1", text: "alive", createdDay: "2026-07-08", ts: 1 }] };
    const incoming = vaultFile({
      gigs: [{ id: "g2", text: "new from vault", createdDay: "2026-07-09", ts: 9 }],
    });
    const plan = planMerge(local, incoming);
    expect(plan.adds.gigs).toEqual([incoming.tables.gigs[0]]);
    expect(plan.removes).toEqual([]);
  });

  it("rejects files that aren't a cyber-fit backup or are from a newer schema", () => {
    expect(() => planMerge({}, { app: "other", schemaVersion: 7, tables: {} })).toThrow();
    expect(() => planMerge({}, vaultFile({}) && { ...vaultFile({}), schemaVersion: 999 })).toThrow();
  });
});
