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
});
