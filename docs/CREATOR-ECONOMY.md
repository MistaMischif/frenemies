# Creator economy v1 (1.7.0)

Creator studio: /creator after Twitch sign-in or a simulated demo. Creator catalog and player balances are scoped to the channel. Data is stored with the existing campaign in PostgreSQL or self-hosted JSON. No additional service or paid API is required.

## Creator workflow

Set experience title, faction display labels and currency name. Stable !human and !zombie commands remain. Upload a PNG full-character skin (client resizes to 512 x 512 bounding box; server limits to 256 KB and 512 pixels per dimension). Set its faction and price (0-500). It starts as a draft; publish it to list in the channel shop. Draft art requires the owner's session. Published art is publicly accessible. Retire removes an item from the shop but preserves existing ownership and equipment. IDs, prices and artwork are immutable after creation in this first authoring version. Maximum 40 skins including seven example C2G skins.

The C2G catalog is sample content; creators may retire it and publish their own licensed art. Skins are full figures, not a modular clothing rig or arbitrary executable content. Prepare Human-side art facing right and Zombie-side art facing left. Assets keep their original proportions. Faction display labels do not yet replace all legacy Human/Zombie narrative text.

Missions support completing, winning, or casting a specific action in 1-50 eligible battles. Each mission can award 0-50 currency and an authored completion-story sentence in the chronicle. A particular action counts at most once per eligible battle. Up to twelve missions; each pays once per player. Retiring/republishing does not reset progress. Stories do not execute code or change combat parameters. Branching episodes, arbitrary mission scripting and viewer-submission moderation queues are not included in this release.

## Player workflow

Join via !join / !human / !zombie. Open the public shop link supplied by the streamer to preview art, prices and missions. Chat commands are identity-bound by the Twitch chat connection:

- !wallet: balance and daily reward reminder.
- !inventory: owned item IDs.
- !shop: first four paid catalog entries; the public shop displays the full catalog.
- !redeem item-id: deduct earned currency and unlock permanently; repeats never deduct again.
- !equip item-id: equip an owned skin for its faction. Retired owned items still equip.
- !missions: progress through published missions.

Commands are throttled per player to two seconds. Responses appear on the stream/control event line; no bot posts to Twitch chat. The public shop is a preview, not an unauthenticated inventory editor. Public state contains only a bounded display roster, not balances, raw Twitch IDs or ledger entries.

The battlefield shows three named characters per side, rotating through joined players every eight seconds. Equipped art is used; no combat bonus is attached. Long labels abbreviate on the battlefield. The on-stream visual layout still needs manual OBS verification.

## Earning rules

An eligible battle has at least ten seconds elapsed, participants on both teams, and at least two accepted action votes by the recipient. Joining, purchases, passive presence and paid events alone do not qualify. The first ten eligible battles per player per UTC day pay 10 currency plus 5 for a win; the first eligible battle adds 20. Missions progress only on those ten reward-eligible battles. There is no streak reset or missed-day penalty. Currency has no cash value, cash-out, transfer, Bits conversion, or real-money payout path.

Rewards use server-created battle IDs to reject repeats. Currency, ownership, equipped items, daily dates and mission completion persist with the channel campaign. Each ledger entry records delta, resulting balance, reference and timestamp; recent history is bounded to 10,000 channel entries, and battle receipts to 2,000. This is a game ledger, not financial bookkeeping. The durable campaign snapshot is written through existing storage; the controls' storage status must report saved. It is not a multi-process transactional economy: run one game server instance per database, as with the established deployment.

Simulated demos use the same rules but their economy is temporary and isolated. The creator studio exposes a simulated chat form only for a demo session. Real channels cannot call the simulation endpoint.

## Analytics definitions

Daily eligible players, completed battles (including non-rewarding battles), issued currency, redeemed currency, supported Twitch campaign event counts and connected-chat observation hours. Events currently include deduplicated raid, Hype begin, subscription and gift campaign events, not every possible Twitch interaction. Connected-chat time is not proof the broadcaster was live; time since the last save can be lost on a crash.

D1/D7: fraction of matured first-eligible-play cohorts that played an eligible battle on the exact UTC calendar day 1 or 7 after their first. First-play dates persist; 90 days of visits are retained. Cohorts older than 80 days are omitted to avoid incomplete retention windows. Null rates display insufficient mature data, not zero retention. Daily data is capped to 90 days. Export contains channel aggregates, not player IDs.

These are game participation measurements, not unique stream viewers, per-person watch time, raid-arrival attribution or causal growth evidence. An account that only opens a wallet is not counted as an eligible player. The denominator is first-time eligible game players; synthetic demos remain labelled. No paid analytics service or third-party tracker.

## Verification

Automated coverage includes reward eligibility and caps, daily rollover, duplicate completion/redemption, ownership across serialized reload and rename, one-time mission rewards, draft publication, PNG bounds, owner/CSRF restrictions, non-demo simulation rejection, private data exclusion and file-backed catalog persistence. Local simulated full-flow verification is recorded in release notes. Browser automation could not launch; live creator/OBS and real Twitch tests remain necessary.
