/** Shared fixtures and fakes for the plugin tests. Field names mirror openapi.yaml. */

import type { IAgentRuntime, Memory, State } from "@elizaos/core";
import type {
  LiveTennisFixture,
  LiveTennisMatch,
  LiveTennisPlayer,
  LiveTennisScore,
} from "../src/client.js";

export function fakeRuntime(
  settings: Record<string, string> = { LIVETENNIS_API_KEY: "test-key" },
): IAgentRuntime {
  return {
    getSetting: (key: string) => settings[key],
  } as unknown as IAgentRuntime;
}

export function fakeMessage(text = "what's the live tennis score right now?"): Memory {
  return { content: { text, source: "test" } } as unknown as Memory;
}

export const emptyState = {} as State;

export function player(
  overrides: Partial<LiveTennisPlayer> = {},
): LiveTennisPlayer {
  return {
    id: 101,
    name: "Carlos Alcaraz",
    tour: "atp",
    country: "ES",
    ranking: 1,
    ranking_points: 9000,
    ranking_movement: "same",
    hand: "R",
    backhand: 2,
    birthday: "2003-05-05",
    is_doubles_team: false,
    ...overrides,
  };
}

export function score(
  overrides: Partial<LiveTennisScore> = {},
): LiveTennisScore {
  return {
    sets: [1, 0],
    // [games_p1, games_p2]; each a per-set list — p1 leads 6-3, 4-3.
    games: [
      [6, 4],
      [3, 3],
    ],
    points: ["30", "40"],
    server: 1,
    is_tiebreak: false,
    win_probability_p1: null,
    danger: null,
    timestamp: "2026-08-16T12:00:00Z",
    ...overrides,
  };
}

export function match(
  overrides: Partial<LiveTennisMatch> = {},
): LiveTennisMatch {
  return {
    id: 555,
    tournament: "Cincinnati Open",
    tour: "atp",
    tournament_id: "atp-cincinnati",
    surface: "hard",
    indoor: false,
    format: "BO3",
    round: "QF",
    round_code: "QF",
    status: "live",
    event_status: null,
    is_doubles: false,
    scheduled_time: "2026-08-16T11:00:00Z",
    players: {
      p1: player(),
      p2: player({ id: 102, name: "Jannik Sinner", ranking: 2 }),
    },
    score: score(),
    winner: null,
    ...overrides,
  };
}

export function fixture(
  overrides: Partial<LiveTennisFixture> = {},
): LiveTennisFixture {
  return {
    id: 900,
    event_date: "2026-08-17",
    start_time: "2026-08-17T15:00:00Z",
    player1_id: 101,
    player2_id: 102,
    tour: "atp",
    tournament: "Cincinnati Open",
    round: "SF",
    round_code: "SF",
    surface: "hard",
    player1_name: "Carlos Alcaraz",
    player2_name: "Jannik Sinner",
    status: "upcoming",
    ...overrides,
  };
}

/** A fetch stub returning a canned status/body, recording the requests it saw. */
export function fetchStub(
  status: number,
  body: unknown,
): { impl: typeof fetch; calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { impl, calls };
}
