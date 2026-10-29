# Frenemies 1.7.0 - Creator content and earned economy

Creators can set experience and currency names, faction labels, upload and publish full-character skins, price catalog items, and publish missions with authored completion stories. C2G is an example catalog. Missions use supported play/win/action objectives; branching story engines and viewer submission queues are not included.

Players earn channel-specific currency through eligible battles and first daily play, permanently unlock items and equip them via Twitch chat. The overlay renders equipped named players, rotating three per side. Earned currency has no cash value, transfer or payout, and is separate from Bits.

## Test

Local http://localhost:3005 -> Try simulated chat -> controls -> Creator studio, shop and analytics. In the simulated chat form send !human as your test username. Start a battle from controls. Return to the studio and send !wallet, then !redeem human-purple, then !equip human-purple (allow two seconds between commands). The full demo test verified 19 participants, daily/victory rewards, a mission award, redemption, equipped asset in the rotating roster, and analytics. Demos are explicitly temporary; real channel campaigns use existing persistent storage.

54 automated tests pass, including creator/CSRF authorization, draft image privacy, catalog persistence, reward eligibility, daily rollover/caps, duplicate rewards/redemption, inventory reload, one-time missions and retention calculations. Browser automation still cannot launch; actual OBS/browser layout verification and real Twitch creator testing remain pending.

Established public URL: https://frenemies-u3n4.onrender.com. The latest observed hosted version was 1.4.0; v1.7.0 requires Manual Deploy -> Deploy latest commit on the existing Render service. There is no configured Render API credential and browser automation is unavailable. Do not assume the public URL has this release until /health reports 1.7.0.

## Rules and boundaries

10 currency per eligible completed battle; +5 win; +20 first eligible battle each UTC day. At least two accepted action votes, ten seconds elapsed, and both sides participating. First ten eligible battles each day award currency and mission progress. Missions pay once, at most 50 each; up to twelve missions. Items cost 0-500; at most forty skins. Existing owners keep retired items. Stable IDs protect ownership. Cosmetics confer no combat advantage.

D1/D7 track eligible game-player return on exact UTC calendar days, not all viewers or watch-time retention. Aggregate analytics export includes daily eligible players, completed battles, issued/redeemed currency, supported campaign event counts and connected-chat observation hours. No causal growth claim. Last 90 days retained, recent matured cohorts only. Ledger history is bounded; see docs/CREATOR-ECONOMY.md for details.

## Self-host

Node.js 22+, npm ci, npm start; open http://localhost:3000. No new runtime dependencies or paid APIs. Configure .env only for Twitch connections; never commit secrets. Existing free Render/Neon configuration is retained. ZIP excludes runtime data, credentials, private submission evidence and prior releases. Single server instance per database is the supported deployment model.
