import { describe, expect, it, vi } from "vitest";
import liveTennisPlugin, { liveTennisPlugin as named } from "../src/index.js";
import { createMatchContextProvider } from "../src/providers/match-context.js";
import { emptyState, fakeMessage, fakeRuntime, match } from "./helpers.js";

describe("liveTennisPlugin", () => {
  it("exports the plugin as both default and named", () => {
    expect(liveTennisPlugin).toBe(named);
    expect(liveTennisPlugin.name).toBe("livetennis");
  });

  it("registers the three FREE-tier actions and the match-context provider", () => {
    expect(liveTennisPlugin.actions?.map((action) => action.name)).toEqual([
      "GET_LIVE_TENNIS_MATCHES",
      "GET_TENNIS_FIXTURES",
      "SEARCH_TENNIS_PLAYERS",
    ]);
    expect(
      liveTennisPlugin.providers?.map((provider) => provider.name),
    ).toEqual(["LIVE_TENNIS_MATCH_CONTEXT"]);
  });
});

describe("LIVE_TENNIS_MATCH_CONTEXT provider", () => {
  it("summarises live matches into state text", async () => {
    const listMatches = vi.fn().mockResolvedValue({ data: [match()] });
    const provider = createMatchContextProvider(() => ({ listMatches }));
    const result = await provider.get(fakeRuntime(), fakeMessage(), emptyState);
    expect(result.text).toContain("Live tennis right now (1 match)");
    expect(result.text).toContain("Carlos Alcaraz vs Jannik Sinner");
    expect(result.values?.liveTennisMatchCount).toBe(1);
  });

  it("renders nothing when no key is configured, without calling the API", async () => {
    const listMatches = vi.fn();
    const provider = createMatchContextProvider(() => ({ listMatches }));
    const result = await provider.get(
      fakeRuntime({}),
      fakeMessage(),
      emptyState,
    );
    expect(result.text).toBe("");
    expect(listMatches).not.toHaveBeenCalled();
  });

  it("renders nothing when nothing is live", async () => {
    const listMatches = vi.fn().mockResolvedValue({ data: [] });
    const provider = createMatchContextProvider(() => ({ listMatches }));
    const result = await provider.get(fakeRuntime(), fakeMessage(), emptyState);
    expect(result.text).toBe("");
    expect(result.values?.liveTennisMatchCount).toBe(0);
  });

  it("never breaks state composition on API failure", async () => {
    const listMatches = vi.fn().mockRejectedValue(new Error("boom"));
    const provider = createMatchContextProvider(() => ({ listMatches }));
    const result = await provider.get(fakeRuntime(), fakeMessage(), emptyState);
    expect(result.text).toBe("");
  });
  it("makes ZERO API requests on a non-tennis turn", async () => {
    const listMatches = vi.fn();
    const provider = createMatchContextProvider(() => ({ listMatches }));
    const result = await provider.get(
      fakeRuntime(),
      fakeMessage("what's the weather in Paris tomorrow?"),
      emptyState,
    );
    expect(result.text).toBe("");
    expect(listMatches).not.toHaveBeenCalled();
  });

  it("short-circuits (no request) when the execution signal is already aborted", async () => {
    const listMatches = vi.fn();
    const provider = createMatchContextProvider(() => ({ listMatches }));
    const result = await (provider.get as unknown as (
      r: unknown, m: unknown, s: unknown, ctx: { signal: AbortSignal },
    ) => Promise<{ text?: string }>)(
      fakeRuntime(), fakeMessage(), emptyState, { signal: AbortSignal.abort() },
    );
    expect(result.text).toBe("");
    expect(listMatches).not.toHaveBeenCalled();
  });

  it("reports a typed diagnostic instead of silently swallowing a failure", async () => {
    const listMatches = vi.fn().mockRejectedValue(new Error("boom"));
    const provider = createMatchContextProvider(() => ({ listMatches }));
    const result = await provider.get(fakeRuntime(), fakeMessage(), emptyState);
    expect(result.text).toBe("");
    expect(result.values?.liveTennisError).toBe("network_error");
  });
});
