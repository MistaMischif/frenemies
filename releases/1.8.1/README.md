# Frenemies 1.8.1 — Creator shows

## What changed

- Fair six-second persistent tactics; crowd size does not amplify damage or break ties. Removed the short-battle reward exclusion.
- Automatic battles with 30-second intermissions, pause/kill safeguards and empty-round stop.
- Creator identity, custom free starter skins and optional C2G outbreak rules.
- Editable mission editions, shared episodes with success/setback stories and optional cosmetic unlocks.
- Private Twitch-identity player hub, persistent inventory, one-click redemption/equipment and cosmetic showcase ranks.
- Non-blocking, coalesced persistence; shop reads never save or freeze combat. Failed writes remain pending for retry.
- Broadcast samples, next-broadcast/next-three retention, observed subscription segments and optional matched contribution/hour comparisons. Missing money inputs remain unknown.

## Test build

Unzip `frenemies-1.8.1.zip`, install Node.js 22+, run `npm ci`, `npm test`, then `npm start`. Open http://localhost:3000 and select Try simulated chat. No Twitch credentials or paid service is needed for local simulation. For persistent self-hosting see `.env.example` and the README. Use one server instance per database.

On the maintained local machine the preview is http://localhost:3005. Established public deployment target: https://frenemies-u3n4.onrender.com. Confirm `/health` reports 1.8.1 before testing the public build.

## Verification

66 automated tests passed. Includes 40/2,000-player engine simulation, 100-to-1 team fairness, rewards beyond daily cap, idempotency, ownership, creator/CSRF permissions, episode revisions/unlocks, automatic-mode safety, storage coalescing/failure and retention arithmetic. This is not a concurrent-network load certification.

Browser QA completed with simulated data: start a broadcast sample, author/launch an episode, customize identity, sign in as a demo player, finish a 19-player battle, receive 30 currency and a shared skin, equip it, redeem another skin for 30, equip it, end the sample, and view aggregate results. Blank financial inputs remained unknown. A FormData lifetime bug found during this run was fixed and retested.

## Remaining external validation

Real Twitch viewer OAuth and EventSub need post-deploy creator testing; no live Bits payment was made. Twitch Extension onboarding/approval remains external. No new paid dependency, real-money payout or claim of measured revenue/retention uplift. Moderated viewer submissions, cross-channel synchronized battles, marketplace distribution and automatic earnings imports are not in this release. Creator ROI requires matched real broadcasts.

Read `docs/CREATOR-ECONOMY.md` for exact rules, storage limits and metric definitions. Prototype board files remain only for backward compatibility; this release focuses on Twitch.

## Production session hardening

Replaces the development session store with expiring PostgreSQL sessions on established hosting. Local self-hosting uses a bounded expiring memory store. Cleanup does not poll an idle database. No new paid dependency. Added session expiry, capacity, persistence-adapter and failure tests.
