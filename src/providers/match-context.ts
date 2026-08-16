/**
 * Match-context provider: a compact live-scoreboard summary composed into the
 * agent's state on tennis-relevant turns. Renders nothing (cheaply) when no
 * key is configured or no matches are live.
 */

import type {
  IAgentRuntime,
  Memory,
  Provider,
  ProviderResult,
  State,
} from "@elizaos/core";
import { LiveTennisClient } from "../client.js";
import { describeLiveMatch } from "../actions/get-live-matches.js";
import { resolveApiKey } from "../settings.js";

const CONTEXT_MATCH_LIMIT = 10;

type ClientFactory = (runtime: IAgentRuntime) => Pick<
  LiveTennisClient,
  "listMatches"
>;

const defaultClientFactory: ClientFactory = (runtime) =>
  new LiveTennisClient({ apiKey: resolveApiKey(runtime) });

export function createMatchContextProvider(
  createClient: ClientFactory = defaultClientFactory,
): Provider {
  return {
    name: "LIVE_TENNIS_MATCH_CONTEXT",
    description:
      "Current live tennis matches (score, server, break points) from the Live Tennis API, so the agent can ground tennis talk in what is actually happening on court.",
    dynamic: true,
    relevanceKeywords: ["tennis", "match", "score", "atp", "wta"],
    get: async (
      runtime: IAgentRuntime,
      _message: Memory,
      _state: State,
    ): Promise<ProviderResult> => {
      if (!resolveApiKey(runtime)) {
        return { text: "", values: {}, data: {} };
      }
      try {
        const page = await createClient(runtime).listMatches({
          status: "live",
          limit: CONTEXT_MATCH_LIMIT,
        });
        const matches = page.data ?? [];
        if (!matches.length) {
          return {
            text: "",
            values: { liveTennisMatchCount: 0 },
            data: { matches: [] },
          };
        }
        const text = `Live tennis right now (${matches.length} match${matches.length === 1 ? "" : "es"}):\n${matches
          .map(describeLiveMatch)
          .join("\n")}`;
        return {
          text,
          values: { liveTennisMatchCount: matches.length },
          data: { matches },
        };
      } catch {
        // A context provider must never break state composition; the actions
        // surface errors with their honest tier/rate-limit messages instead.
        return { text: "", values: {}, data: {} };
      }
    },
  };
}

export const matchContextProvider = createMatchContextProvider();
