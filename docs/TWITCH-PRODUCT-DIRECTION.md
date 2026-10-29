# Frenemies: Twitch-first product direction

Updated October 29, 2026. This is a product hypothesis informed by public primary sources, not evidence that top streamers want the product. No creator interviews have yet validated it. Board games, physical toys and Living Table are outside this delivery direction.

## The promise

Your chat becomes the cast of an ongoing Human-versus-Zombie outbreak. A viewer enters in one command, creates a visible moment, and has a reason to return next stream. The host can run it without interrupting their main show. C2G characters and community history provide the identity.

## What research changes

Stream Avatars already offers viewer avatars and customization: https://streamavatars.com/. Avatars alone are not differentiation.

Crowd Control offers free participation, paid effects, configurable cooldowns and overlays: https://crowdcontrol.live/blog/every-crowd-control-feature-as-of-june-2026 and https://crowdcontrol.live/setup. Paid attacks and event triggers alone are not differentiation. The opportunity is a persistent cast, understandable stakes, and a coherent channel story with almost no host workload.

Twitch supports chat, raids, Hype Trains and related events through documented interfaces: https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types. Event delivery order is not guaranteed; persist receipts and make effects replay-safe. Chat transmission has separate limits: https://dev.twitch.tv/docs/chat. Frenemies currently reads chat and does not send bot messages; preserve that low-noise default.

Bits features must respect channel eligibility and the isBitsEnabled flag: https://dev.twitch.tv/docs/extensions/monetization/. Do not require Extension onboarding to enjoy the free game. Bits-in-Extensions presentation must follow Twitch terminology restrictions; avoid calling Bits actions donations or using purchase/spend language in Extension UI: https://dev.twitch.tv/docs/extensions/guidelines-and-policies/. Extension transactions and ordinary chat Cheers are different systems; never promise a Bits-pack entitlement from an unrelated donation or Cheer.

## Shipped in 1.6.0

- Twitch homepage and controls are the primary experience; archived prototypes no longer appear in the main navigation.
- !join auto-placement for new players and faction continuity for known characters; explicit !human and !zombie remain.
- Compact OBS strip alongside the existing full arena; no new assets, dependencies or scopes.
- Battle participation recap with accepted votes, unique active participants, duration and contributor counts. Copy text for a host-managed recap; no automatic posting.
- Explicit return from an active archived prototype without completing it or awarding a campaign victory.

## Existing foundation to retain

Free play, two-second command windows, server-side first-vote enforcement, animated C2G battles, persistent Twitch identities, infection/recovery, shared supplies, chronicle, raid/Hype convoy objectives, host pause and kill switch. Follow-repeat protection and durable Barrage receipts remain. Active headcounts use the user-approved entire-current-battle definition, never silently decay.

## Next priorities and acceptance criteria

1. Make a viewer's first contribution legible. Add a bounded join spotlight and sampled action credit, with returning-character titles. Keep a stable personal identity without trying to render thousands of labels. Acceptance: a new viewer understands how to join and sees acknowledgment in a five-second test, while repeated commands cannot dominate the screen. The existing join effect is only the first step, not a per-viewer avatar system.

2. Build one signature encounter: a raid arrives as a rescue convoy, chat chooses protect or ambush, and the outcome changes the next chapter. Incoming raiders must opt in via chat; raid payloads do not provide an individual incoming-viewer roster. Both factions need rewarding objectives. Current Human-victory convoy is a foundation, not this complete encounter. Hype must visibly credit represented teams; do not invent a single triggering viewer.

3. Make the living chronicle a show feature: short factual start-of-stream recap, named rescues, a last-stand moment, and next-chapter stakes. Deterministic templates, not a mandatory paid AI service. Do not invent achievements. Add an opt-in highlight timestamp/export before considering clip creation and its extra permissions.

4. Tighten pacing for large chats. Pilot longer configurable decision windows, visible telegraphs and clear counters; preserve existing two-second mode until playtests justify changes. Process one vote per viewer, aggregate crowd effects, and cap visible animations. Avoid rewarding message spam or replacing normal conversation. No hidden comeback bonuses.

5. Make Barrage spectacular and bounded. Retain free counterplay and per-team cooldowns; clearly show remaining shots and queued effects. Prototype earned cosmetic variants and communal celebrations before selling permanent combat strength. No paid requirement to rescue a character. Disable unavailable Bits controls with an honest status. Approval, transaction delivery, channel eligibility and large-audience balance remain launch gates.

6. Give creators production controls: selectable scene footprint, intensity/reduced motion, moderator access with scoped authorization, sound/mute control if audio is introduced, and safe auto-pacing between rounds. Existing pause/clear and compact layout ship now; the rest is planned. Do not request extra Twitch scopes without the corresponding feature.

7. Pilot creator-specific faction names and C2G palette/banner choices. Keep only approved C2G art; do not promise arbitrary sponsored Extension branding without reviewing Twitch restrictions. Cross-channel rivalries require opt-in on both channels and audience-size normalization; defer until a single channel is reliably fun.

8. Operational readiness before a top-streamer pitch: burst/reconnect tests, deduplication under reordered events, bounded queues, persistence recovery and independent mobile/OBS checks. Target fast first paint and stable overlay frame time on an ordinary streaming PC. Test at 100, 1,000 and 10,000 simulated participants; do not claim these loads are supported until measured. Keep Node self-hosting and exportable data; no mandatory paid service. Free hosted infrastructure is a pilot environment, not an unmeasured large-show SLA.

## Validation and adoption

Start with three to five willing small/medium creators and their moderators, then approach larger channels with evidence. No outreach is authorized by this document.

Proposed success gates, not industry benchmarks: host reaches first battle in under five minutes without assistance; first-time viewers understand the loop in ten seconds; host can pause/clear in one action; creators voluntarily use it on a second stream. Measure join-to-first-vote conversion, participation in the next battle, repeat participants next stream, host interventions, overlay performance, and moderation complaints. Compare equivalent stream segments across multiple sessions; chat volume is not proof of retention or causation. Track Bits separately so revenue does not hide poor free-play adoption.

The pitch to test: "Your chat stars in a persistent zombie outbreak. Three-minute battles, one-command joining, and a new community story every stream."
