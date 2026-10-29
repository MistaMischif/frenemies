# Frenemies 1.11.0 - Actions become visible

Every accepted shared-war role order increments durable convoy visual counters. The audience sees fortification construction and shielding, scouting flags and sweeps, escort reinforcement and advance cues, and assault firing positions and tracers. More active participants increase visible detail sublinearly, with exact role counts. Crossing structures reflect persistent crossing strength. Expired orders stop contributing active visual groups.

Commander route commitments, reserve support, rescue, handoff, evacuation, damage and outcomes trigger distinct cues. Encounter stages move from departure through conflict and recovery to arrival or aftermath. The same persistent war continues afterward; no new episode reset or economy changes.

## Test

Local: http://localhost:3005/war
Hosted: https://frenemies-u3n4.onrender.com/war

For solo testing, choose Try simulated chat from the homepage, open Shared war, join, dispatch and run the simulated squad. Scout orders unlock the commander route choice. Use the audience overlay link for OBS. Simulation is labelled and separate from live results.

## Validation and limits

87 automated tests passed, including durable action counts, rejected-order exclusion, 250-action burst accounting, role expiry, no initial history replay, commander/outcome reactions, and bounded rendering with 10,000 participants per role. Local browser inspection checked the audience presentation and corrected overlapping HUD elements.

Snapshots refresh every two seconds. Actions arriving together are combined into labelled group reactions, not a separate full animation for every viewer. Rendered details are capped while counters preserve all accepted orders. Reduced-motion preferences are supported. First connection establishes a baseline rather than replaying old effects. Tracers are visual representations of aggregate assault activity, not additional damage. This release improves presentation; audience retention improvements have not yet been measured.

Self-host with Node 22+, npm ci, npm test and npm start using .env.example. No new dependencies or paid services. Creator environments and equipped character art continue to be used. Existing one-authority persistence constraints apply.
