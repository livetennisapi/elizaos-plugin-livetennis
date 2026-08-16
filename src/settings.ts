/** Resolves the Live Tennis API key from runtime settings, then the environment. */

import type { IAgentRuntime } from "@elizaos/core";

export const API_KEY_SETTING = "LIVETENNIS_API_KEY";

export function resolveApiKey(runtime: IAgentRuntime): string {
  const fromSettings = runtime.getSetting?.(API_KEY_SETTING);
  if (typeof fromSettings === "string" && fromSettings.length > 0) {
    return fromSettings;
  }
  return process.env[API_KEY_SETTING] ?? "";
}
