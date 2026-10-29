# Frenemies 1.10.0 - Adaptive host, spectator-first presentation

The host now runs automatically on shared convoy fronts. It observes combat damage and threat pressure, schedules buildup/peak/fade/recovery, and supplies short factual captions. It never infers boredom from quiet chat or changes prices based on spending. No new paid API or model service. This is a deterministic game-AI director, not generative language-model narration.

Original implementation informed by Michael Booth, Valve, The AI Systems of Left 4 Dead (2009), presentation slides 77-91:
https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf

The source describes estimated combat intensity, peaks and recovery, and modulation of encounter frequency. Frenemies adapts those concepts to a shared convoy and six-second tick. Our thresholds/timings are prototype choices, not Valve's balance values or evidence of measured viewer engagement. We do not distribute Valve's PDF, code or assets.

## Play

Local: http://localhost:3005/war
Hosted: https://frenemies-u3n4.onrender.com/war

Join the shared front, dispatch a convoy, start the simulated squad if testing alone, then choose a route once scouting unlocks it. The host runs without configuration. OBS uses the /war/<overlay-key> address provided in controls. The audience view hides controls, analytics and command lists, leaving the battlefield, stakes and captions. Creator title, art and equipped skins remain in use. Optional host adjustments are collapsed in the commander view; only the current commander can change shared pacing.

## Consequences and guardrails

Build/peak schedule the existing threat influx. Fade/recovery stop fresh attacks and allow existing pressure to subside. Base attack strength on an engaged tick is unchanged. An unattended front and all host clocks hold until active orders resume. A restored convoy keeps director state; old saves gain the director without resetting progress or resources.

During recovery, between 25% and 80% progress with at least 35 hull, the host may offer one rescue. The commander can spend 10 shared reserves to stop for two active ticks (12 seconds) and restore 5 settlement integrity on completion. The alternative continues the mission. No answer after five active ticks defaults to continuing without payment. Duplicate decisions are rejected. Existing reserve commitments and route choices remain binding.

Captions announce the situation; smoke shows critical hull, incoming fire ceases when pressure clears, and settlement lighting celebrates successful delivery. A verified crossing-control threshold produces a chronicle entry crediting the communities fortifying it. These are bounded narrative cues driven by actual gameplay, not fabricated viewer reactions. The previous result/evidence export includes director events and commander decisions.

## Validation and scope

81 tests passed before release packaging, including director transitions, recovery, commander authorization, cost/payment idempotency, default no-answer behavior, save migration, quiet-front hold and mixed-role delivery. Browser and hosted verification are performed separately before handoff.

Self-host with Node 22+, npm ci, npm test, npm start. Existing one-authority PostgreSQL/local storage constraints and evidence-retention limits remain; see docs/SHARED-WAR.md. Generative UGC missions, a COLTRAN-domain world page, audio narration and official record-attempt infrastructure are not included in this release. The host supports the spectator-first direction; equivalence to established entertainment and retention lift have not been established.
