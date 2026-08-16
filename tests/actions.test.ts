import { describe, expect, it, vi } from "vitest";
import { createGetLiveMatchesAction } from "../src/actions/get-live-matches.js";
import { createGetFixturesAction } from "../src/actions/get-fixtures.js";
import { createSearchPlayersAction } from "../src/actions/search-players.js";
import { LiveTennisTierError, TIER_MESSAGES } from "../src/client.js";
import {
  emptyState,
  fakeMessage,
  fakeRuntime,
  fixture,
  match,
  player,
  score,
} from "./helpers.js";

describe("GET_LIVE_TENNIS_MATCHES", () => {
  it("validates only when a key is configured", async () => {
    const action = createGetLiveMatchesAction();
    expect(await action.validate?.(fakeRuntime(), fakeMessage(), undefined)).toBe(
      true,
    );
    expect(
      await action.validate?.(fakeRuntime({}), fakeMessage(), undefined),
    ).toBe(false);
  });

  it("reports score, server, and derived break point", async () => {
    const listMatches = vi.fn().mockResolvedValue({
      data: [match({ score: score({ server: 1, points: ["30", "40"] }) })],
    });
    const action = createGetLiveMatchesAction(() => ({ listMatches }));
    const callback = vi.fn();
    const result = await action.handler(
      fakeRuntime(),
      fakeMessage(),
      emptyState,
      { tour: "atp" },
      callback,
    );
    expect(result?.success).toBe(true);
    expect(result?.text).toContain("Carlos Alcaraz vs Jannik Sinner");
    expect(result?.text).toContain("6-3 4-3 (30-40)");
    expect(result?.text).toContain("serving: Carlos Alcaraz");
    expect(result?.text).toContain("BREAK POINT");
    expect(listMatches).toHaveBeenCalledWith({
      status: "live",
      tour: "atp",
      limit: undefined,
    });
    expect(callback).toHaveBeenCalledOnce();
  });

  it("labels tiebreaks instead of claiming a break point", async () => {
    const listMatches = vi.fn().mockResolvedValue({
      data: [
        match({
          score: score({
            is_tiebreak: true,
            server: 2,
            points: ["6", "5"],
          }),
        }),
      ],
    });
    const action = createGetLiveMatchesAction(() => ({ listMatches }));
    const result = await action.handler(
      fakeRuntime(),
      fakeMessage(),
      emptyState,
      {},
    );
    expect(result?.text).toContain("tiebreak");
    expect(result?.text).not.toContain("BREAK POINT");
  });

  it("says so plainly when nothing is live", async () => {
    const listMatches = vi.fn().mockResolvedValue({ data: [] });
    const action = createGetLiveMatchesAction(() => ({ listMatches }));
    const result = await action.handler(
      fakeRuntime(),
      fakeMessage(),
      emptyState,
      {},
    );
    expect(result?.success).toBe(true);
    expect(result?.text).toBe("No tennis matches are live right now.");
  });

  it("surfaces the honest ULTRA tier message on upgrade_required", async () => {
    const listMatches = vi
      .fn()
      .mockRejectedValue(new LiveTennisTierError(TIER_MESSAGES.winProbability));
    const action = createGetLiveMatchesAction(() => ({ listMatches }));
    const callback = vi.fn();
    const result = await action.handler(
      fakeRuntime(),
      fakeMessage(),
      emptyState,
      {},
      callback,
    );
    expect(result?.success).toBe(false);
    expect(result?.text).toContain("ULTRA tier");
    expect(callback.mock.calls[0][0].text).toContain("ULTRA tier");
  });
});

describe("GET_TENNIS_FIXTURES", () => {
  it("lists upcoming fixtures with their scheduled time", async () => {
    const listFixtures = vi.fn().mockResolvedValue({ data: [fixture()] });
    const action = createGetFixturesAction(() => ({ listFixtures }));
    const result = await action.handler(
      fakeRuntime(),
      fakeMessage(),
      emptyState,
      { tour: "atp", limit: 10 },
    );
    expect(result?.success).toBe(true);
    expect(result?.text).toContain("Carlos Alcaraz vs Jannik Sinner");
    expect(result?.text).toContain("2026-08-17T15:00:00Z");
    expect(listFixtures).toHaveBeenCalledWith({ tour: "atp", limit: 10 });
  });

  it("treats a null start_time as a real not-yet-scheduled state", async () => {
    const listFixtures = vi.fn().mockResolvedValue({
      data: [fixture({ start_time: null, event_date: null })],
    });
    const action = createGetFixturesAction(() => ({ listFixtures }));
    const result = await action.handler(
      fakeRuntime(),
      fakeMessage(),
      emptyState,
      {},
    );
    expect(result?.text).toContain("time not yet scheduled");
  });

  it("surfaces the honest BASIC tier message on upgrade_required", async () => {
    const listFixtures = vi
      .fn()
      .mockRejectedValue(new LiveTennisTierError(TIER_MESSAGES.history));
    const action = createGetFixturesAction(() => ({ listFixtures }));
    const result = await action.handler(
      fakeRuntime(),
      fakeMessage(),
      emptyState,
      {},
    );
    expect(result?.success).toBe(false);
    expect(result?.text).toContain("BASIC tier");
  });
});

describe("SEARCH_TENNIS_PLAYERS", () => {
  it("reports the current ranking and points", async () => {
    const searchPlayers = vi.fn().mockResolvedValue({
      data: [player({ ranking: 1, ranking_points: 9000 })],
    });
    const action = createSearchPlayersAction(() => ({ searchPlayers }));
    const result = await action.handler(
      fakeRuntime(),
      fakeMessage(),
      emptyState,
      { search: "alcaraz" },
    );
    expect(result?.success).toBe(true);
    expect(result?.text).toContain("Carlos Alcaraz");
    expect(result?.text).toContain("rank 1 (9000 pts)");
    expect(searchPlayers).toHaveBeenCalledWith({
      search: "alcaraz",
      limit: undefined,
    });
  });

  it("shows unranked players honestly", async () => {
    const searchPlayers = vi.fn().mockResolvedValue({
      data: [player({ ranking: null, ranking_points: null })],
    });
    const action = createSearchPlayersAction(() => ({ searchPlayers }));
    const result = await action.handler(
      fakeRuntime(),
      fakeMessage(),
      emptyState,
      { search: "alcaraz" },
    );
    expect(result?.text).toContain("unranked");
  });

  it("fails fast without a search term", async () => {
    const searchPlayers = vi.fn();
    const action = createSearchPlayersAction(() => ({ searchPlayers }));
    const result = await action.handler(
      fakeRuntime(),
      fakeMessage(),
      emptyState,
      {},
    );
    expect(result?.success).toBe(false);
    expect(searchPlayers).not.toHaveBeenCalled();
  });

  it("reads parameters from the planner envelope", async () => {
    const searchPlayers = vi.fn().mockResolvedValue({ data: [player()] });
    const action = createSearchPlayersAction(() => ({ searchPlayers }));
    const result = await action.handler(
      fakeRuntime(),
      fakeMessage(),
      emptyState,
      { parameters: { search: "sinner", limit: 2 } },
    );
    expect(result?.success).toBe(true);
    expect(searchPlayers).toHaveBeenCalledWith({ search: "sinner", limit: 2 });
  });
});
