import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIVETENNIS_API_URL,
  isBreakPoint,
  LiveTennisApiError,
  LiveTennisClient,
  LiveTennisTierError,
  TIER_MESSAGES,
} from "../src/client.js";
import { fetchStub, match, score } from "./helpers.js";

describe("LiveTennisClient", () => {
  it("refuses to construct without an API key, pointing at the free signup", () => {
    expect(() => new LiveTennisClient({ apiKey: "" })).toThrow(
      /LIVETENNIS_API_KEY/,
    );
  });

  it("calls /matches with status=live and the X-API-Key header", async () => {
    const { impl, calls } = fetchStub(200, { data: [match()], meta: {} });
    const client = new LiveTennisClient({ apiKey: "k123", fetchImpl: impl });
    const page = await client.listMatches({ tour: "atp", limit: 5 });
    expect(page.data).toHaveLength(1);
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(calls[0].url.startsWith(DEFAULT_LIVETENNIS_API_URL)).toBe(true);
    expect(url.pathname.endsWith("/matches")).toBe(true);
    expect(url.searchParams.get("status")).toBe("live");
    expect(url.searchParams.get("tour")).toBe("atp");
    expect(url.searchParams.get("limit")).toBe("5");
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers["X-API-Key"]).toBe("k123");
  });

  it("calls /fixtures and /players with their documented query params", async () => {
    const { impl, calls } = fetchStub(200, { data: [], meta: {} });
    const client = new LiveTennisClient({ apiKey: "k", fetchImpl: impl });
    await client.listFixtures({ tour: "wta" });
    await client.searchPlayers({ search: "alcaraz", limit: 3 });
    const fixturesUrl = new URL(calls[0].url);
    expect(fixturesUrl.pathname.endsWith("/fixtures")).toBe(true);
    expect(fixturesUrl.searchParams.get("tour")).toBe("wta");
    const playersUrl = new URL(calls[1].url);
    expect(playersUrl.pathname.endsWith("/players")).toBe(true);
    expect(playersUrl.searchParams.get("search")).toBe("alcaraz");
    expect(playersUrl.searchParams.get("limit")).toBe("3");
  });

  it("maps 403 upgrade_required to a tier error", async () => {
    const { impl } = fetchStub(403, { error: "upgrade_required" });
    const client = new LiveTennisClient({ apiKey: "k", fetchImpl: impl });
    await expect(client.listMatches()).rejects.toBeInstanceOf(
      LiveTennisTierError,
    );
  });

  it("names the exact tier in the per-endpoint messages", () => {
    expect(TIER_MESSAGES.history).toMatch(/BASIC tier/);
    expect(TIER_MESSAGES.h2h).toMatch(/BASIC tier/);
    expect(TIER_MESSAGES.winProbability).toMatch(/ULTRA tier/);
    expect(TIER_MESSAGES.winProbability).toMatch(/win_probability_p1/);
  });

  it("maps 401 and 429 to actionable errors", async () => {
    const unauthorized = new LiveTennisClient({
      apiKey: "bad",
      fetchImpl: fetchStub(401, { error: "unauthorized" }).impl,
    });
    await expect(unauthorized.listMatches()).rejects.toThrow(/401/);

    const limited = new LiveTennisClient({
      apiKey: "k",
      fetchImpl: fetchStub(429, { error: "rate_limited" }).impl,
    });
    const rejection = limited.listMatches();
    await expect(rejection).rejects.toBeInstanceOf(LiveTennisApiError);
    await rejection.catch((error: LiveTennisApiError) => {
      expect(error.status).toBe(429);
      expect(error.message).toMatch(/30 requests\/minute/);
    });
  });
});

describe("isBreakPoint", () => {
  it("is a break point when the receiver holds AD", () => {
    expect(isBreakPoint(score({ server: 1, points: ["40", "AD"] }))).toBe(true);
    expect(isBreakPoint(score({ server: 2, points: ["AD", "40"] }))).toBe(true);
  });

  it("is a break point when the receiver is on 40 and the server below 40", () => {
    for (const serverPoint of ["0", "15", "30"]) {
      expect(
        isBreakPoint(score({ server: 1, points: [serverPoint, "40"] })),
      ).toBe(true);
      expect(
        isBreakPoint(score({ server: 2, points: ["40", serverPoint] })),
      ).toBe(true);
    }
  });

  it("is not a break point at deuce or with the server ahead", () => {
    expect(isBreakPoint(score({ server: 1, points: ["40", "40"] }))).toBe(
      false,
    );
    expect(isBreakPoint(score({ server: 1, points: ["AD", "40"] }))).toBe(
      false,
    );
    expect(isBreakPoint(score({ server: 1, points: ["40", "30"] }))).toBe(
      false,
    );
  });

  it("is never a break point during a tiebreak", () => {
    expect(
      isBreakPoint(score({ is_tiebreak: true, server: 1, points: ["0", "40"] })),
    ).toBe(false);
  });

  it("never guesses when server or points are null", () => {
    expect(isBreakPoint(score({ server: null }))).toBe(false);
    expect(isBreakPoint(score({ server: 1, points: [null, "40"] }))).toBe(
      false,
    );
    expect(isBreakPoint(score({ server: 1, points: [] }))).toBe(false);
  });
});
