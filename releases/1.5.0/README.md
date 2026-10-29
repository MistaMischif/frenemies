# Frenemies 1.5.0 - C2G Territories

Physical prototype 0.2 replaces the earlier board-game direction with actual movement, conquest, scavenging, crafting and fighting. The legacy shared-strength prototype remains available separately.

## Play

Local: http://localhost:3005 (on the project computer). Hosted: https://frenemies-u3n4.onrender.com/territory after deployment. From the home page choose Play C2G Territory Campaign. Start an expedition, select H1, select A2, then Move. Scavenge there to gain a Bipod. Each faction has two actions, then the other faction acts. Control eight territories at turn end, or most territories after eight rounds.

Self-host: extract the ZIP, install Node.js 22+, run npm ci then npm start, and open http://localhost:3000. Local loopback campaigns persist in DATA_DIR. Real Twitch hosts use the established sign-in and their existing persistent campaign. Hosted anonymous demo campaigns are temporary. In-progress territory positions, units, control, stock, inventory, equipment, infection and revision persist; chat votes do not.

## Physical game

The 14-page kit includes five rules pages, four full-size Letter landscape board tiles, six figure cards, 40 mm figure counters, six event cards, resource/control markers and an expedition record. The separate A3 board has 75 mm territory-center spacing. Print Actual size, auto-rotate. Use five ordinary d6 dice. All illustrations are supplied C2G art; no generated or stock artwork. No application, purchase or internet is required for paper play.

## Twitch and Living Table

Twitch viewers vote concrete orders such as !move H1 A2 and !attack H1 A1. The host resolves the majority, while physical-table orders use the same rules engine. Raids/Hype convoy objectives and subscription supplies affect the shared campaign; Hype can prepare a faction's next attack. Follows and paid Barrage have no territorial effect.

The optional integrations/living-table adapter targets the inspected MRBoardMVP piece/board APIs. It consumes stable toy IDs and a 4 x 3 coordinate export, renders assigned original C2G sprites, and proposes observed physical moves for host confirmation. A scoped rotatable key authorizes observations only; it cannot execute combat. It does not modify existing Living Table scenes. Unity compilation and headset behavior are unverified; no camera/NFC recognition or production toy electronics is claimed. There is no separate C2G Unity save importer.

## Validation

Automated rules, HTTP and DOM tests cover territory legality, dice combat, finite stock, crafting, infection, emergency recovery, Twitch votes, idempotency, persistence, read-only bridge export, scoped pairing/key rotation, observed-move confirmation and interface selection. Existing classic game tests also pass. All PDF pages rendered and inspected. Browser UI/OBS visual verification remains blocked by the Windows browser tool launch error (HRESULT 0x80070020). Live-viewer balance testing and optional Unity-adapter testing remain pending. Hosted verification will be recorded separately after deployment.

Print generation uses optional free Python reportlab/pypdf; gameplay adds no runtime dependency or paid API. Credentials, local campaign data, private screenshots and the surrounding Unity project are excluded from the ZIP.
