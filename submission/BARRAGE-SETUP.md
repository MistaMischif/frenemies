# Barrage Extension — setup and review package

Status: implemented locally; NOT registered, reviewed, or enabled for real Bits. Local simulation is labelled and never processes Bits. The game/animated OBS overlay remains usable without the Extension.

## Fixed product and behavior

- Product SKU: `barrage_v1`; display name: `Barrage`; draft cost: 100 Bits.
- Three shots of 3 damage each, two seconds apart. Shield halves one shot. Does not consume or multiply surge. Free team voting still executes independently.
- One Barrage volley per team per 30 battle seconds. Pause/freeze stop shots. Unused shots remain bound to the Twitch user ID and channel, including between battles and server restarts. Partial balances can be fired later.
- `!barrage` or the panel's Fire saved shots button activates a balance. The panel calls Twitch's native confirmation to activate a new pack, then attempts the volley; if the team is busy or the battle ends, the balance stays saved.
- This is a deterministic consumable; no random rewards, wagering, prizes, cash-out, transfers, or external checkout.

## Twitch setup

1. Create a separate Twitch Extension in the Developer Console. The existing broadcaster OAuth application is NOT an Extension. Use a panel and mobile view, with identity linking enabled. All client code is in `extension/`.
2. Upload `submission/frenemies-extension.zip` in Hosted Test. Set panel/mobile path to `panel.html` and configuration path to `config.html`. Add `https://frenemies-u3n4.onrender.com` to allowed fetch/connect domains. Panel height: 600px.
3. Complete any required monetization onboarding personally (identity, tax/payout information and agreements). Register the fixed Bits product above. Confirm final pricing before making it live.
4. Put the Extension client ID, OAuth client secret, and base64 shared signing secret in Render's `EXTENSION_CLIENT_ID`, `EXTENSION_CLIENT_SECRET`, `EXTENSION_SHARED_SECRET`. These are distinct credentials; never commit them or include them in the zip. Keep `EXTENSION_ENABLED=false` until configuration is ready.
5. Only when ready for controlled verification, enable the Extension backend. The current verifier accepts **live** Helix transactions only and rejects `inDevelopment:true`; loopback is not evidence of payment. Test-product support is not enabled. Do not activate real Bits until an authorized tester agrees to the exact cost. Real Bits confirmation stays with the tester.
6. Verify: correct user's channel-scoped balance; duplicate transaction no extra credit; wrong account/channel cannot claim; cancel confirmation no change; identity revoked cannot activate; offline browser delivery recovered; pause, freeze and kill retain balance; interrupted server recovers reserved shot. Verify also on Twitch mobile.
7. Supply original icon, screenshots, privacy/contact information, live review channel and test instructions, then submit to Twitch review. Package preparation is not approval. Do not advertise real Bits availability until review and live activation are complete.

## Verification and storage

The browser sends only a transaction ID. The server obtains its own Extension app token and asks Twitch Helix for the authoritative transaction, matching user, broadcaster, Extension domain, SKU, Bits amount and non-development status. Viewer calls require a signed, unexpired HS256 Extension JWT and shared Twitch user ID. CORS allows only the Extension's Twitch-hosted origin. API calls are limited per viewer. The frontend never holds a secret.

Every five minutes, and on startup, the backend reconciles Helix history with pagination to recover missed browser callbacks. Up to 10,000 records are processed per pass; reaching that limit raises an operator status and requires expanding the reconciler before wider launch. This implementation uses reconciliation rather than an Extension EventSub subscription.

PostgreSQL table `frenemies_barrage` stores transaction ID (prefixed with Extension ID), channel/user IDs, remaining shots and a pending reservation. Atomic insert prevents repeat grants; reserve and settle ensure each shot is accounted for. Local JSON fallback is `barrage.json`. Failed storage stops paid effects. Pending reservations are returned at startup because the old in-memory battle is gone. Deploy only one active process and drain/stop the old process before restarting paid gameplay; multi-instance rollout is unsupported. Full battle state remains memory-only.

Do not delete consumed receipt rows: that would permit replay grants. Back up the table. Account data retention/deletion handling and a public privacy/contact page must be completed before Extension submission. No financial, tax, card or OAuth data is stored in the inventory.

## Visuals

Original code-drawn squads and forts, projectiles, impact rings, shields, heal/surge labels, Barrage nameplate and victory banner. Server-generated sequence IDs prevent reanimation on every state update; joining an overlay skips historical effects. Exact headcounts stay numeric; squad symbols are capped at eight per side. Reduced-motion preference limits projectile motion. No external art, tracking or audio.

## Official references checked October 27, 2026

- https://dev.twitch.tv/docs/extensions/reference/
- https://dev.twitch.tv/docs/extensions/monetization/
- https://dev.twitch.tv/docs/extensions/guidelines-and-policies/
- https://dev.twitch.tv/docs/api/reference/#get-extension-transactions
