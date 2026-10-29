# Creator platform 1.8.0

Use `/creator` after broadcaster sign-in, or start a simulated demo. Tabs separate Broadcast, Identity, Episodes, Rewards and Results. One game-server process per database is supported. PostgreSQL and local JSON both work; no paid service dependency was added.

## Identity and content

Creators set title, faction display labels, currency name and free published starter skins for new accounts. Existing inventory is preserved. The seven C2G figures are examples, not mandatory product identity. C2G infection/clinic/settlement mechanics are opt-in. Commands `!join`, `!human` and `!zombie` remain stable; display labels can be anything within the validated text bounds.

Skin uploads are PNG, resized by the client to a 512-pixel bounding box; server checks PNG signature/header, dimensions and 256 KB limit. Drafts are private until published. Name/price can change; owning a retired skin still permits equipping it and viewing it in the authenticated inventory. Artwork is immutable after creation; upload a new skin to change art. At most 200 skins. Set free uploaded skins as starters to replace C2G for new players. Images are full-character figures, not modular clothing rigs; faction one faces right and faction two faces left.

Missions use play/win/attack/defend/heal/surge objectives over 1–50 eligible battles, with 0–50 earned currency. Up to 12 are published at once; up to 200 editions total. Draft rules are editable; published names/story can be edited but reward rules are frozen. Duplicate creates a new draft ID with separate completion. Republish never resets old completion. Only the broadcaster can author; viewer-upload submission/moderation is not implemented.

## Community episodes

Create an opening, objective, contribution target (1–10,000), deadline (1–20 battles), success story, setback story and optional published skin unlock. Launch snapshots the template revision; edits do not rewrite an active episode. Both factions contribute at most once per qualifying player per battle. At the target, the success story enters the chronicle and all qualifying participants from that episode receive its skin; at the deadline, the setback story enters instead. Cancel gives no completion reward. Replaying can repeat the story but ownership never duplicates. No episode currency minting or arbitrary scripts. The active outcome is shown on the overlay; a subsequent episode is chosen explicitly by the creator.

Verified supported Twitch events appear in the episode/chronicle and existing combat hooks continue. A raid supplies both teams during a running battle; joined subscriber/raider bonuses and the approved Hype contributor-team policy remain. Event receipts are deduplicated. There is no claim that individual raid arrivals can be identified.

## Play, rewards and spending

A player chooses an action once per battle; it repeats every six seconds until changed. First accepted choice/change per window counts. New battles clear choices. Damage is 8, power 16, heal 5, defense halves damage; population cannot win a damage arms race or break a timeout tie. Current-battle active headcounts retain the user-approved non-decaying definition.

Eligibility requires both teams participating and two resolved tactic windows or two accepted votes. Removed the ten-second exclusion that denied rewards to legitimate quick battles. Earn 10 per eligible battle, +5 for victory, +20 for the first UTC daily play. First ten eligible battles/day earn base currency. Missions, episode contributions and lifetime victory/battle counters continue beyond the cap. No missed-day penalty. Joining, wallet reads and paid-only effects do not earn currency.

The player hub `/shop/<channel-key>` offers public browsing and private inventory. Optional Twitch sign-in requests no scopes and reuses the registered callback; it does not connect the viewer as a broadcaster. Balance/inventory writes require that identity plus CSRF and prior chat join. `!redeem item-id`, `!equip item-id` and `!upgrade` also work in chat. New uploaded skins have short `lookN` aliases. Read commands direct the player to the hub rather than announcing private balances. Shop feedback uses a separate rate-limited overlay notice, not the combat recap. Commands have a 10-second per-player chat cooldown; hub writes are 500 ms apart.

Cosmetic showcase ranks cost 50 × next rank, through rank 10 (2,750 total). They add a visible ring/rank label to featured characters, with zero combat benefit. Victories persist. The stream features up to three characters per faction, rotates every four seconds and prioritizes recent join/equip activity briefly; not every member of a giant crowd is guaranteed immediate screen time. Everyone can view their own loadout in the hub.

Currency remains channel-specific, earned, nontransferable and noncash. No conversion to Bits, wagering, cash-out or real-money payout. Existing Bits Barrage infrastructure is separate and still requires Twitch onboarding/approval; this version does not enable it or establish monetization compliance for arbitrary UGC.

## Running the show and storage

Automatic mode waits 30 seconds between battles and stops after two empty battles. Pause/kill disable it. Restart never silently resumes it. Manual controls and compact/full OBS layouts remain. Creator-marked control samples reject starting/resuming battles or enabling auto.

Shop reads do not create accounts or write storage. Writes mutate synchronously, coalesce pending channel snapshots and save asynchronously; combat and chat no longer pause during database I/O. A failed save retains the in-memory mutation, marks the channel dirty and retries every 10 seconds. No rollback can erase concurrently earned rewards. This is not a distributed or crash-proof financial ledger: unsaved changes can be lost if the process dies before retry. Do not run multiple game-server processes against one database. Local JSON writes serialize and atomically rename a separate disk snapshot.

## Measuring value honestly

Mark game and control broadcast samples with a label and optional comparison key. Track accepted joins, eligible game players, unique redeemers, completed battles, control action requests and supported event counts. These are not Twitch unique viewers or individual watch-time. Subscription supporter segments reflect only observed subscribe/gift events within that sample; “without observed subscription” does not mean nonpayer. Bits/resubs and spend amounts are not inferred.

Next-broadcast and within-next-three retention use completed, non-interrupted game samples. Denominators are player-session opportunities with enough later samples, not unique people across the report. Controls are excluded. Last 100 samples retained. Ending a sample disables automatic scheduling; finish the current battle before ending for complete attribution. Restart marks an unfinished sample interrupted, excluding it from comparisons.

Record optional creator receipts after platform fees, direct costs, operator minutes and hourly cost in one consistent currency. Unknown stays null. Contribution = receipts − costs − minutes/60 × hourly cost. Matching completed game/control samples with the same comparison key yields the difference in aggregate contribution/hour. This is observational, not causal ROI: match category, time, duration, guests and seasonal context. No automatic earnings import or promised return.

Daily D1/D7 cohorts remain supplementary, using exact UTC days, 90 days of visits and matured first-play cohorts from the last 80 days. Export contains aggregate daily and broadcast results, never player IDs. Simulations are explicitly labelled and isolated.

## Verification and limits

64 automated tests include 40/2,000-player engine simulations, 100-to-1 fairness, reward/idempotency/cap behavior, immutable published rules, shared unlocks, save coalescing/failure, identity/CSRF checks, control-sample safety and retention math. This is not a 2,000-connection network load certification. Browser QA covers demo entry, broadcast sample creation, episode authoring/launch, identity editing and player-hub flow. Live OAuth and EventSub still require a creator pilot after deployment. No market adoption, retention lift or financial return is established by these tests.
