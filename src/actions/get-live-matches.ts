/** Live matches with current score, server, and a derived break-point flag. FREE tier. */

import type {
  Action,
  ActionResult,
  HandlerCallback,
  HandlerOptions,
  IAgentRuntime,
  Memory,
  State,
} from "@elizaos/core";
import {
  isBreakPoint,
  LiveTennisClient,
  type LiveTennisMatch,
  type LiveTennisTour,
} from "../client.js";
import { resolveApiKey } from "../settings.js";

const TOURS: LiveTennisTour[] = ["atp", "wta", "challenger", "itf", "juniors"];

interface GetLiveMatchesOptions extends HandlerOptions {
  tour?: LiveTennisTour;
  limit?: number;
}

type ClientFactory = (runtime: IAgentRuntime) => Pick<
  LiveTennisClient,
  "listMatches"
>;

const defaultClientFactory: ClientFactory = (runtime) =>
  new LiveTennisClient({ apiKey: resolveApiKey(runtime) });

function readOptions(options?: HandlerOptions): GetLiveMatchesOptions {
  const direct = (options ?? {}) as Record<string, unknown>;
  const parameters =
    direct.parameters && typeof direct.parameters === "object"
      ? (direct.parameters as Record<string, unknown>)
      : {};
  return { ...direct, ...parameters } as GetLiveMatchesOptions;
}

function formatScoreLine(match: LiveTennisMatch): string {
  const score = match.score;
  if (!score) return "no score yet";
  const games = Array.isArray(score.games) ? score.games : [];
  const gamesP1 = Array.isArray(games[0]) ? games[0] : [];
  const gamesP2 = Array.isArray(games[1]) ? games[1] : [];
  const setScores = gamesP1
    .map((g1, i) => `${g1}-${gamesP2[i] ?? 0}`)
    .join(" ");
  const points = Array.isArray(score.points) ? score.points : [];
  const pointPart =
    typeof points[0] === "string" && typeof points[1] === "string"
      ? ` (${points[0]}-${points[1]})`
      : "";
  return `${setScores || "0-0"}${pointPart}`;
}

export function describeLiveMatch(match: LiveTennisMatch): string {
  const p1 = match.players?.p1?.name ?? "?";
  const p2 = match.players?.p2?.name ?? "?";
  const score = match.score;
  const parts = [
    `- ${p1} vs ${p2} | ${match.tournament}${match.round ? ` ${match.round}` : ""} | ${formatScoreLine(match)}`,
  ];
  if (score?.server === 1 || score?.server === 2) {
    parts.push(`serving: ${score.server === 1 ? p1 : p2}`);
  }
  if (score?.is_tiebreak) {
    parts.push("tiebreak");
  } else if (score && isBreakPoint(score)) {
    parts.push("BREAK POINT");
  }
  if (match.event_status === "Interrupted") {
    parts.push("suspended");
  }
  return parts.join(" | ");
}

export function createGetLiveMatchesAction(
  createClient: ClientFactory = defaultClientFactory,
): Action {
  return {
    name: "GET_LIVE_TENNIS_MATCHES",
    description:
      "List tennis matches in play right now (ATP, WTA, Challenger, ITF, juniors) with the current score, who is serving, and whether the returner holds a break point. Uses the Live Tennis API FREE tier; no model win probability (that is an ULTRA-tier field).",
    similes: [
      "LIVE_TENNIS_SCORES",
      "CURRENT_TENNIS_MATCHES",
      "TENNIS_SCOREBOARD",
    ],
    parameters: [
      {
        name: "tour",
        description: "Optional tour filter.",
        required: false,
        schema: { type: "string", enum: TOURS },
      },
      {
        name: "limit",
        description: "Number of matches, 1 to 50.",
        required: false,
        schema: { type: "number", minimum: 1, maximum: 50 },
      },
    ],
    validate: async (runtime: IAgentRuntime) =>
      resolveApiKey(runtime).length > 0,
    handler: async (
      runtime: IAgentRuntime,
      message: Memory,
      _state: State | undefined,
      options?: HandlerOptions,
      callback?: HandlerCallback,
    ): Promise<ActionResult> => {
      try {
        const filters = readOptions(options);
        const page = await createClient(runtime).listMatches({
          status: "live",
          tour: filters.tour,
          limit: filters.limit,
        });
        const matches = page.data ?? [];
        const text = matches.length
          ? `Live tennis matches (${matches.length}):\n${matches.map(describeLiveMatch).join("\n")}`
          : "No tennis matches are live right now.";
        await callback?.({
          text,
          source: message.content.source,
          actions: ["GET_LIVE_TENNIS_MATCHES"],
        });
        return { success: true, text, data: { matches } };
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "Unknown Live Tennis error";
        const text = `Unable to fetch live tennis matches: ${detail}`;
        await callback?.({
          text,
          source: message.content.source,
          actions: ["GET_LIVE_TENNIS_MATCHES"],
        });
        return { success: false, text, data: { error: detail } };
      }
    },
    examples: [
      [
        {
          name: "{{user1}}",
          content: { text: "What tennis matches are on right now?" },
        },
        {
          name: "{{agentName}}",
          content: {
            text: "I'll check the live tennis scoreboard.",
            actions: ["GET_LIVE_TENNIS_MATCHES"],
          },
        },
      ],
    ],
  };
}

export const getLiveMatchesAction = createGetLiveMatchesAction();
