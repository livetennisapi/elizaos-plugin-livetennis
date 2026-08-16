/** Player search with current official ranking. FREE tier. */

import type {
  Action,
  ActionResult,
  HandlerCallback,
  HandlerOptions,
  IAgentRuntime,
  Memory,
  State,
} from "@elizaos/core";
import { LiveTennisClient, type LiveTennisPlayer } from "../client.js";
import { resolveApiKey } from "../settings.js";

interface SearchPlayersActionOptions extends HandlerOptions {
  search?: string;
  limit?: number;
}

type ClientFactory = (runtime: IAgentRuntime) => Pick<
  LiveTennisClient,
  "searchPlayers"
>;

const defaultClientFactory: ClientFactory = (runtime) =>
  new LiveTennisClient({ apiKey: resolveApiKey(runtime) });

function readOptions(options?: HandlerOptions): SearchPlayersActionOptions {
  const direct = (options ?? {}) as Record<string, unknown>;
  const parameters =
    direct.parameters && typeof direct.parameters === "object"
      ? (direct.parameters as Record<string, unknown>)
      : {};
  return { ...direct, ...parameters } as SearchPlayersActionOptions;
}

export function describePlayer(player: LiveTennisPlayer): string {
  const rank =
    typeof player.ranking === "number"
      ? `rank ${player.ranking}${typeof player.ranking_points === "number" ? ` (${player.ranking_points} pts)` : ""}`
      : "unranked";
  const bits = [player.country, player.tour, rank].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );
  return `- ${player.name} | ${bits.join(" | ")} | id ${player.id}`;
}

export function createSearchPlayersAction(
  createClient: ClientFactory = defaultClientFactory,
): Action {
  return {
    name: "SEARCH_TENNIS_PLAYERS",
    description:
      "Search tennis players by name and report their current official ranking and ranking points (ranked players first). Uses the Live Tennis API FREE tier. Ranking history and as-of ranking records are paid tiers and are not fetched here.",
    similes: ["FIND_TENNIS_PLAYER", "TENNIS_PLAYER_RANKING", "PLAYER_LOOKUP"],
    parameters: [
      {
        name: "search",
        description: "Player name (or part of it) to search for.",
        required: true,
        schema: { type: "string", minLength: 1 },
      },
      {
        name: "limit",
        description: "Number of players, 1 to 50.",
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
        const search = (filters.search ?? "").trim();
        if (!search) {
          const text =
            "SEARCH_TENNIS_PLAYERS needs a player name to search for.";
          await callback?.({
            text,
            source: message.content.source,
            actions: ["SEARCH_TENNIS_PLAYERS"],
          });
          return { success: false, text, data: { error: "missing_search" } };
        }
        const page = await createClient(runtime).searchPlayers({
          search,
          limit: filters.limit,
        });
        const players = page.data ?? [];
        const text = players.length
          ? `Players matching "${search}" (${players.length}):\n${players.map(describePlayer).join("\n")}`
          : `No players matched "${search}".`;
        await callback?.({
          text,
          source: message.content.source,
          actions: ["SEARCH_TENNIS_PLAYERS"],
        });
        return { success: true, text, data: { players } };
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "Unknown Live Tennis error";
        const text = `Unable to search tennis players: ${detail}`;
        await callback?.({
          text,
          source: message.content.source,
          actions: ["SEARCH_TENNIS_PLAYERS"],
        });
        return { success: false, text, data: { error: detail } };
      }
    },
    examples: [
      [
        {
          name: "{{user1}}",
          content: { text: "What's Alcaraz ranked right now?" },
        },
        {
          name: "{{agentName}}",
          content: {
            text: "Let me look up his current ranking.",
            actions: ["SEARCH_TENNIS_PLAYERS"],
          },
        },
      ],
    ],
  };
}

export const searchPlayersAction = createSearchPlayersAction();
