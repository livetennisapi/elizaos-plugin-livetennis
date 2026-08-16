/**
 * Minimal typed client for the Live Tennis API's FREE-tier endpoints.
 *
 * Field names mirror docs.livetennisapi.com/openapi.yaml verbatim. List
 * endpoints return `{data, meta}`; single resources return the object
 * directly. All timestamps are UTC ISO 8601 with a `Z` suffix.
 *
 * A call above the key's tier returns `403 {"error":"upgrade_required"}` —
 * never a silent empty result. This client translates that into a
 * {@link LiveTennisTierError} carrying the honest per-endpoint tier message.
 */

export const DEFAULT_LIVETENNIS_API_URL =
  "https://api.livetennisapi.com/api/public/v1";

const REQUEST_TIMEOUT_MS = 10_000;

/** Tour filter vocabulary shared by `/matches` and `/fixtures`. */
export type LiveTennisTour = "atp" | "wta" | "challenger" | "itf" | "juniors";

/** `Player` schema (list shape — no `stats` object on list endpoints). */
export interface LiveTennisPlayer {
  id: number;
  name: string;
  tour: string | null;
  country: string | null;
  ranking: number | null;
  ranking_points: number | null;
  ranking_movement: "up" | "down" | "same" | null;
  hand: "R" | "L" | null;
  backhand: 1 | 2 | null;
  birthday: string | null;
  is_doubles_team: boolean;
}

/** `Score` schema. `win_probability_p1`/`danger` are ULTRA fields (null below ULTRA). */
export interface LiveTennisScore {
  sets: number[];
  games: number[][];
  points: (string | null)[];
  server: 1 | 2 | null;
  is_tiebreak: boolean;
  win_probability_p1?: number | null;
  danger?: number | null;
  timestamp: string | null;
}

/** `Match` schema. */
export interface LiveTennisMatch {
  id: number;
  tournament: string;
  tour: LiveTennisTour | null;
  tournament_id: string | null;
  surface: "hard" | "clay" | "grass" | null;
  indoor: boolean;
  format: "BO3" | "BO5" | null;
  round: string | null;
  round_code: string | null;
  status: "upcoming" | "live" | "completed" | "cancelled";
  event_status: string | null;
  is_doubles: boolean;
  scheduled_time: string | null;
  players: { p1: LiveTennisPlayer; p2: LiveTennisPlayer };
  score: LiveTennisScore | null;
  winner: number | null;
}

/** `Fixture` schema. */
export interface LiveTennisFixture {
  id: number;
  event_date: string | null;
  start_time: string | null;
  player1_id: number | null;
  player2_id: number | null;
  tour: string | null;
  tournament: string | null;
  round: string | null;
  round_code: string | null;
  surface: string | null;
  player1_name: string | null;
  player2_name: string | null;
  status: string | null;
}

export interface LiveTennisListMeta {
  total?: number;
  limit?: number;
  offset?: number;
}

export interface LiveTennisPage<T> {
  data: T[];
  meta?: LiveTennisListMeta;
}

/**
 * Honest per-endpoint tier requirements, straight from the API docs. The
 * FREE tier covers everything this plugin calls; these messages exist so a
 * 403 `upgrade_required` (or a request for out-of-scope data) names the
 * exact tier instead of failing vaguely.
 */
export const TIER_MESSAGES = {
  history:
    "Historical results (/history/matches, status=completed) require the BASIC tier of the Live Tennis API. Upgrade at https://livetennisapi.com/pricing — this plugin's actions use FREE-tier endpoints only.",
  h2h: "Head-to-head records (/h2h) and the 1968-2022 results archive require the BASIC tier of the Live Tennis API. Upgrade at https://livetennisapi.com/pricing — this plugin's actions use FREE-tier endpoints only.",
  winProbability:
    "Model win probability (win_probability_p1) and match analysis require the ULTRA tier of the Live Tennis API. Upgrade at https://livetennisapi.com/pricing — this plugin reports live scores without model fields.",
} as const;

/** Raised when the API answers `403 {"error":"upgrade_required"}`. */
export class LiveTennisTierError extends Error {
  readonly code = "upgrade_required";
  constructor(message: string) {
    super(message);
    this.name = "LiveTennisTierError";
  }
}

export class LiveTennisApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "LiveTennisApiError";
  }
}

function tierMessageForPath(path: string): string {
  if (path.startsWith("/h2h")) return TIER_MESSAGES.h2h;
  if (path.startsWith("/history")) return TIER_MESSAGES.history;
  if (path.includes("/analysis") || path.includes("/statistics")) {
    return TIER_MESSAGES.winProbability;
  }
  return `This endpoint is above your Live Tennis API tier (403 upgrade_required). Tiers and pricing: https://livetennisapi.com/pricing`;
}

export interface LiveTennisClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface ListMatchesOptions {
  status?: "live" | "upcoming";
  tour?: LiveTennisTour;
  limit?: number;
}

export interface ListFixturesOptions {
  tour?: LiveTennisTour;
  limit?: number;
}

export interface SearchPlayersOptions {
  search: string;
  limit?: number;
}

export class LiveTennisClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: LiveTennisClientOptions) {
    if (!options.apiKey) {
      throw new Error(
        "LIVETENNIS_API_KEY is not set. Get a FREE key (no card, 100 requests/day) at https://livetennisapi.com/subscribe/free and set it in the agent's settings or environment.",
      );
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_LIVETENNIS_API_URL).replace(
      /\/$/,
      "",
    );
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async get<T>(
    path: string,
    query: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        headers: { "X-API-Key": this.apiKey, accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new LiveTennisApiError(
        `Live Tennis API request failed: ${detail}`,
        0,
      );
    }
    if (response.status === 403) {
      throw new LiveTennisTierError(tierMessageForPath(path));
    }
    if (response.status === 401) {
      throw new LiveTennisApiError(
        "Live Tennis API rejected the key (401). Check LIVETENNIS_API_KEY.",
        401,
      );
    }
    if (response.status === 429) {
      throw new LiveTennisApiError(
        "Live Tennis API rate limit hit (429). FREE keys allow 30 requests/minute and 100/day; try again shortly.",
        429,
      );
    }
    if (!response.ok) {
      throw new LiveTennisApiError(
        `Live Tennis API returned status ${response.status}`,
        response.status,
      );
    }
    return (await response.json()) as T;
  }

  /** `GET /matches?status=live|upcoming` — FREE. */
  listMatches(
    options: ListMatchesOptions = {},
  ): Promise<LiveTennisPage<LiveTennisMatch>> {
    return this.get("/matches", {
      status: options.status ?? "live",
      tour: options.tour,
      limit: options.limit,
    });
  }

  /** `GET /fixtures` — upcoming scheduled fixtures, earliest first. FREE. */
  listFixtures(
    options: ListFixturesOptions = {},
  ): Promise<LiveTennisPage<LiveTennisFixture>> {
    return this.get("/fixtures", {
      tour: options.tour,
      limit: options.limit,
    });
  }

  /** `GET /players?search=` — search players by name, ranked first. FREE. */
  searchPlayers(
    options: SearchPlayersOptions,
  ): Promise<LiveTennisPage<LiveTennisPlayer>> {
    return this.get("/players", {
      search: options.search,
      limit: options.limit,
    });
  }
}

/**
 * Derive whether the current point is a break point, from the score snapshot
 * alone. Honest rules only:
 *
 * - never during a tiebreak (`is_tiebreak`);
 * - requires a known `server` (1 or 2) and both in-game point strings;
 * - break point when the RECEIVER has `AD`, or the receiver is on `40`
 *   while the server is below 40 (`0`, `15`, `30`).
 *
 * Deuce (40-40) and server-advantage states are NOT break points. Returns
 * false whenever the inputs do not prove one — never a guess.
 */
export function isBreakPoint(score: LiveTennisScore): boolean {
  if (score.is_tiebreak) return false;
  const server = score.server;
  if (server !== 1 && server !== 2) return false;
  const points = score.points;
  if (!Array.isArray(points) || points.length < 2) return false;
  const serverPoint = points[server - 1];
  const receiverPoint = points[2 - server];
  if (typeof serverPoint !== "string" || typeof receiverPoint !== "string") {
    return false;
  }
  if (receiverPoint === "AD") return true;
  return (
    receiverPoint === "40" && ["0", "15", "30"].includes(serverPoint)
  );
}
