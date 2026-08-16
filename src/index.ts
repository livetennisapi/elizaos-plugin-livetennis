/**
 * elizaos-plugin-livetennis — live tennis scores, fixtures, and player search
 * for elizaOS agents, backed by the Live Tennis API (livetennisapi.com).
 *
 * FREE-tier endpoints only. Endpoints above the key's tier answer
 * `403 upgrade_required`, which the actions surface as honest per-tier
 * messages (history/H2H → BASIC, model win probability → ULTRA) rather than
 * silent empty results.
 *
 * Vendor disclosure: this plugin is maintained by the Live Tennis API team.
 */

import type { Plugin } from "@elizaos/core";
import { getLiveMatchesAction } from "./actions/get-live-matches.js";
import { getFixturesAction } from "./actions/get-fixtures.js";
import { searchPlayersAction } from "./actions/search-players.js";
import { matchContextProvider } from "./providers/match-context.js";

export const liveTennisPlugin: Plugin = {
  name: "livetennis",
  description:
    "Live tennis scores, upcoming fixtures, and player search across ATP, WTA, Challenger, ITF and juniors via the Live Tennis API (FREE tier; honest tier errors for paid surfaces).",
  actions: [getLiveMatchesAction, getFixturesAction, searchPlayersAction],
  providers: [matchContextProvider],
};

export {
  createGetLiveMatchesAction,
  getLiveMatchesAction,
  describeLiveMatch,
} from "./actions/get-live-matches.js";
export {
  createGetFixturesAction,
  getFixturesAction,
  describeFixture,
} from "./actions/get-fixtures.js";
export {
  createSearchPlayersAction,
  searchPlayersAction,
  describePlayer,
} from "./actions/search-players.js";
export {
  createMatchContextProvider,
  matchContextProvider,
} from "./providers/match-context.js";
export * from "./client.js";
export { API_KEY_SETTING, resolveApiKey } from "./settings.js";

export default liveTennisPlugin;
