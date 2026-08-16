/** Upcoming scheduled fixtures, earliest first. FREE tier. */

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
  LiveTennisClient,
  type LiveTennisFixture,
  type LiveTennisTour,
} from "../client.js";
import { resolveApiKey } from "../settings.js";

const TOURS: LiveTennisTour[] = ["atp", "wta", "challenger", "itf", "juniors"];

interface GetFixturesOptions extends HandlerOptions {
  tour?: LiveTennisTour;
  limit?: number;
}

type ClientFactory = (runtime: IAgentRuntime) => Pick<
  LiveTennisClient,
  "listFixtures"
>;

const defaultClientFactory: ClientFactory = (runtime) =>
  new LiveTennisClient({ apiKey: resolveApiKey(runtime) });

function readOptions(options?: HandlerOptions): GetFixturesOptions {
  const direct = (options ?? {}) as Record<string, unknown>;
  const parameters =
    direct.parameters && typeof direct.parameters === "object"
      ? (direct.parameters as Record<string, unknown>)
      : {};
  return { ...direct, ...parameters } as GetFixturesOptions;
}

export function describeFixture(fixture: LiveTennisFixture): string {
  const when =
    fixture.start_time ?? fixture.event_date ?? "time not yet scheduled";
  const where = [fixture.tournament, fixture.round]
    .filter((part): part is string => typeof part === "string")
    .join(" ");
  return `- ${fixture.player1_name ?? "?"} vs ${fixture.player2_name ?? "?"} | ${where || "tournament TBC"} | ${when}`;
}

export function createGetFixturesAction(
  createClient: ClientFactory = defaultClientFactory,
): Action {
  return {
    name: "GET_TENNIS_FIXTURES",
    description:
      "List upcoming scheduled tennis fixtures, earliest first, across ATP, WTA, Challenger, ITF and juniors. Start times are null until the order of play assigns one — that is a real state, not missing data. Uses the Live Tennis API FREE tier.",
    similes: [
      "UPCOMING_TENNIS_MATCHES",
      "TENNIS_SCHEDULE",
      "NEXT_TENNIS_MATCHES",
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
        description: "Number of fixtures, 1 to 50.",
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
        const page = await createClient(runtime).listFixtures({
          tour: filters.tour,
          limit: filters.limit,
        });
        const fixtures = page.data ?? [];
        const text = fixtures.length
          ? `Upcoming tennis fixtures (${fixtures.length}):\n${fixtures.map(describeFixture).join("\n")}`
          : "No upcoming tennis fixtures found.";
        await callback?.({
          text,
          source: message.content.source,
          actions: ["GET_TENNIS_FIXTURES"],
        });
        return { success: true, text, data: { fixtures } };
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "Unknown Live Tennis error";
        const text = `Unable to fetch tennis fixtures: ${detail}`;
        await callback?.({
          text,
          source: message.content.source,
          actions: ["GET_TENNIS_FIXTURES"],
        });
        return { success: false, text, data: { error: detail } };
      }
    },
    examples: [
      [
        {
          name: "{{user1}}",
          content: { text: "Who plays tomorrow on the ATP tour?" },
        },
        {
          name: "{{agentName}}",
          content: {
            text: "I'll pull the upcoming fixtures.",
            actions: ["GET_TENNIS_FIXTURES"],
          },
        },
      ],
    ],
  };
}

export const getFixturesAction = createGetFixturesAction();
