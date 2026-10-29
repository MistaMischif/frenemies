# Frenemies 1.12.0-rc.1 - Hold the Crossing (local playtest)

This candidate is intentionally NOT deployed to Render. The requested entertainment acceptance has not been established by human playtesting. Production stays on 1.11.1. Automated correctness, balance probes and local browser inspection are not evidence that an encounter is entertaining.

## Play locally

Open http://localhost:3005/ and choose Try simulated chat, then Preview bridge encounter. This simulated shortcut starts the encounter without the normal approach. During normal play the convoy reaches the crossing at 30% progress. Choose hold, emergency repairs or rush within 24 active seconds; silence defaults to holding. Start a new convoy after the result and 15-second result pause.

## What changed

Eight visible raiders arrive in four waves. Their authoritative positions and health drive attacks, hit effects and barricade impacts. Assault targets the nearest living raider; scouts slow the approach and reveal incoming waves; fortifiers repair the barricade. The convoy waits behind the line, then escorts resume advancing it. Generic pressure damage pauses during the bridge fight so damage comes from the visible attackers. Named contribution credit rotates among eligible actors. Representative squads and exact active counts keep the scene bounded.

The commander can hold for free, spend 10 shared reserves on up to 24 extra repair health over two active ticks, or rush for 18 progress at the cost of 8 hull and 25 crossing health. Repair requests are authorized and cannot double spend. A breach damages the convoy and the crossing. The crossing condition and a community attribution persist into subsequent convoys. No offline catch-up attacks; a vacant front holds. Existing creator title, equipped roster, environment and published faction artwork feed the scene; C2G remains a fallback skin. Rules remain shared across communities.

## Verification before packaging

92 tests pass. New coverage verifies visible attackers as the encounter damage source, repair/hit state, coordinated free success, failed unopposed defense, commander-only choices, idempotent payment, default holding, save/restore and next-convoy consequences. Existing director/rescue and global war regressions pass.

Deterministic balance probe with two escorts, two fortifiers, one scout and one assault: hold breaches the line, emergency repair saves it, and rush leaves it abandoned. Adding a second assault saves the line without paid repairs. These are synthetic balancing results, not observed audience behavior or ROI.

Local browser checked automatic entry, the direct preview, raider approach, published art, hit effects and emergency repair deduction from 60 to 50 reserves. Remaining presentation limitations: sprite movement is interpolated, characters are not fully rigged, there is no audio mix, and the shared encounter uses a fixed four-wave pattern. Human watchability approval remains pending; do not market this candidate as validated entertainment.

Self-host with Node 22+, npm ci, npm test and npm start using .env.example. No paid APIs or new dependencies.
