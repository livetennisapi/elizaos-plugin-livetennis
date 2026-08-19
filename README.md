# elizaos-plugin-livetennis

Live tennis for [elizaOS](https://github.com/elizaOS/eliza) agents, backed by
the [Live Tennis API](https://livetennisapi.com) — real-time scores, upcoming
fixtures, and player search across **ATP, WTA, Challenger, ITF and juniors**.

Vendor disclosure: this plugin is built and maintained by the Live Tennis API
team (the data vendor).

## What it adds

| Surface | Name | What it does |
| --- | --- | --- |
| Action | `GET_LIVE_TENNIS_MATCHES` | Matches in play now: sets/games/points, who is serving, tiebreak flag, and a derived **break point** flag (receiver holds `AD`, or receiver on `40` with the server below 40 — never during a tiebreak, never guessed). |
| Action | `GET_TENNIS_FIXTURES` | Upcoming scheduled fixtures, earliest first. A null start time is a real "order of play not out yet" state, and is reported as such. |
| Action | `SEARCH_TENNIS_PLAYERS` | Player search by name with the current official ranking and ranking points (ranked players first). |
| Provider | `LIVE_TENNIS_MATCH_CONTEXT` | Composes a compact live-scoreboard summary into agent state on tennis-relevant turns. Renders nothing when no key is set or nothing is live, and never breaks state composition on API failure. |

All response field names follow the public OpenAPI spec at
[docs.livetennisapi.com/openapi.yaml](https://docs.livetennisapi.com/openapi.yaml).

## Tier honesty

This plugin calls **FREE-tier endpoints only** (`/matches?status=live|upcoming`,
`/fixtures`, `/players`). The Live Tennis API answers calls above the key's
tier with `403 {"error":"upgrade_required"}` — never a silent empty result —
and this plugin passes that honesty through as per-action errors:

- Historical results, head-to-head and the 1968–2022 archive → named as
  **BASIC**-tier surfaces.
- Model win probability (`win_probability_p1`), match analysis and in-play
  statistics → named as **ULTRA**-tier surfaces. Live scores are reported
  without model fields.

## Install

```bash
npm install elizaos-plugin-livetennis
# or
bun add elizaos-plugin-livetennis
```

Published on npm as [`elizaos-plugin-livetennis`](https://www.npmjs.com/package/elizaos-plugin-livetennis).

## Configure

Set `LIVETENNIS_API_KEY` in the agent's settings (secrets) or environment.
A FREE key is self-serve at
[livetennisapi.com/subscribe/free](https://livetennisapi.com/subscribe/free) —
30 requests/minute, 100/day, no card.

```ts
import { liveTennisPlugin } from "elizaos-plugin-livetennis";

const character = {
  name: "CourtsideAgent",
  plugins: [liveTennisPlugin],
  settings: {
    secrets: {
      LIVETENNIS_API_KEY: process.env.LIVETENNIS_API_KEY,
    },
  },
};
```

## Develop

```bash
npm ci
npm run typecheck
npm test        # vitest, HTTP fully mocked — no key, no network
npm run build   # tsup → dist/
```

## License

[MIT](./LICENSE)
