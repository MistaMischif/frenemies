# Frenemies 1.9.0 - One shared front

This release adds a shared convoy battlefield for communities connected to the same Frenemies service. It is a first playable cooperative front within one persistent war, not a million-player service certification or a distributed-server federation.

## Play now

Local: http://localhost:3005/war
Established public deployment: https://frenemies-u3n4.onrender.com/war

Sign in with Twitch from the home page, or choose Try simulated chat. Open Shared war from controls. Choose Join shared war, then Dispatch convoy. Viewers type !scout, !escort, !fortify, or !assault. After scouting reaches 3 intel the dispatching streamer chooses the direct route (fast/exposed) or detour (slower/safer).

For local solo testing, click Run simulated squad after joining and dispatching. It supplies six explicitly simulated viewers with complementary roles; you still make commander choices. Stop simulated squad stops new orders; outstanding orders expire after 20 seconds. Separate demo sessions on the same server join the same simulated world, completely separate from the live world. Never present simulated metrics as customer evidence.

Use the /war/<channel-overlay-key> URL shown in the war control view as the OBS browser source. This is a new shared-war view; the earlier /overlay/<key> still displays channel battles. Hide/Show my overlay affects only your view, not other communities' front. Joining pauses channel battles and disables automatic scheduling. Leaving permits returning to earlier channel battles.

## Actual mechanics

One action per Twitch account every six seconds across channels. Orders resolve each six-second tick and expire after 20 seconds. Per-role strength is 3 * sqrt(active role participants), capped at 12. This reduces crowd-size dominance but is not a tested competitive fairness guarantee. Orders retain their role until changed or expired. No unattended damage or offline catch-up.

Scouting unlocks route choice and reduces pressure. Assault suppresses pressure. Fortify holds crossing control and reduces hull damage. Escort moves the convoy. Crossing control above 60 accelerates movement. Streamers may spend 15 shared reserves once per community per convoy to repair up to 25 hull and reduce pressure by 20. Only the dispatching commander chooses the route or evacuates. Command may transfer after two minutes without a commander decision, or after that commander explicitly leaves. Routes cannot be rewritten.

Delivery adds 30 reserves and 10 settlement integrity. Loss removes 10 integrity and 10 crossing control. Evacuation costs 5 integrity. Supplies cap at 300; integrity/crossing at 100. Next convoy starting hull is min(100, 60 + integrity/2); crossing and reserves persist. A fresh convoy never resets the war. No arbitrary world-reset button is exposed.

Creator title, selected environment artwork and equipped/starter character skins feed each channel's view. The shared scene's convoy, bridge and destination are programmatic scenery. Creator shops remain channel-owned; this release does not migrate inventories into a global wallet or allow creators to change shared balance rules. Existing Bits Barrage remains in channel battles; it does not purchase shared-war victory or consume banked shots here.

## Results and evidence

Records distinct participating account hashes across channels, accepted actions, returns on another UTC date, cross-community participants, decisions, resolution before/after state, outcomes and per-community resolved contributions. Contributions count active orders per resolution, not unique people. An owner-only JSON export includes metrics and the latest 2,000 sequenced events. Public views omit account hashes. Account hashes are pseudonyms, not proof of unique people. Export before older evidence rolls off. Lifetime counters are broader than the retained evidence window.

The historical 1,165,140-participant TPP result is an ambition benchmark, not a Guinness record claim. Its category was most participants in a single-player online videogame. Frenemies' cross-channel shared world requires separate eligibility/rules and independently auditable evidence before any official attempt.
Source: https://blog.twitch.tv/en/2014/06/18/tpp-broke-a-guinness-world-record-so-we-made-a-tpp-shirt-d15871a09bf6/

## Verification and limits

Browser QA verified dispatch, scouting unlock, route commitment, moving convoy, live gauges and six-account simulated cooperation.

75 automated tests passed, including mixed-role delivery versus all-assault failure, cross-channel deduplication, commander authority/handoff, reserves, evacuation, saved-state restoration, CSRF, two simulated communities sharing state, public data isolation and live/demo separation. These are simulation and integration results, not measured retention or revenue uplift.

The live war uses the existing PostgreSQL/local-JSON storage with queued writes and retries. Status distinguishes pending/failed saves; abrupt process failure can lose unflushed actions. One authoritative server process per database is required. Snapshots and account aggregates have not been load-tested for mass participation. This release has no new paid dependency; use Node 22+, npm ci, npm test, npm start for self-hosting. Do not run multiple independent authorities against the same database.

Next client validation: coordinate two real creators on the same deployment, record commander reactions and before/after world state, measure voluntary reuse and account return, and compare coordinated pilot time blocks with the earlier battle. Revenue and watch-time effects remain unknown. Do not treat account counts or observed returns alone as causal ROI.
