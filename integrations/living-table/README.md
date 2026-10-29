# Living Table / C2G territory bridge v1

This optional adapter targets the inspected MRBoardMVP APIs (GameDefinition, BoardRuntime.Build, PieceView, MoveValidator and MRBoardPlatform) in Project 26. It is delivered in the Frenemies repository; the existing Unity project, scenes and Quest builds are not modified. Unity compilation and on-headset behavior remain unverified.

1. Import this C# file into a separate Living Table integration scene with MRBoardMVP available. Assign its MRBoardPlatform.
2. Import the six original PNGs from Frenemies public/characters as Unity Sprites: char01V01, char02V01, char03V01, zmb01V01, zmb01V02, zmb01V03. Assign art names and sprites in c2gArtwork. No generated replacement art is used; missing sprites block board application.
3. In the Frenemies territory page, use the read-only Living Table URL. Assign it to readOnlyStateUrl. The bridge uses a four-column, three-row GameDefinition with 0.075 m square centers. Human edge is Unity row 0; browser/printed row 3. Anchor pose remains owned by Living Table's SetBoardPose flow.
4. For observations, create a device key in the host's bridge controls. Set pairingKey at runtime via your trusted local configuration; it is NonSerialized. Assign observationUrl. The server stores only a SHA-256 hash. Rotating the key revokes the previous key. Do not store keys in source, scene files, logs or GitHub.
5. A manual confirmation, future camera/NFC reader or other local provider calls Observe(stableToyIdOrTag, column, row). It proposes a move; it does not mutate board state. The host confirms a legal adjacent move in the browser. Invalid, occupied/enemy or stale moves are rejected. Attacks, healing and crafting use explicit rule commands, never inferred from a camera observation.
6. On confirmed state updates the adapter rebuilds the board with supplied C2G sprites and emits StateApplied, including infection, equipment and units for future presentation. Existing primitive piece renderers are disabled. This adapter currently refreshes pieces rather than playing bespoke attack/walk animations.

No automatic camera recognition, NFC hardware driver, production toy provisioning, shared C2G Unity save import, or Quest deployment is claimed. Stable IDs H1-H3/Z1-Z3 map to c2g-figure-h1 ... z3. User-assigned tags are unique per campaign. A physical figure is a persistent game identity; appearance and electronics can change without changing its saved identity. Viewer accounts represent faction decision makers, not ownership of a toy.

GET /api/living-table/:overlay returns protocol, revision, definition, figures[] and public state. POST /api/living-table/observe requires Authorization: Bearer <device key> and {pieceId,target,revision}; returns 202 awaiting-host-confirmation or 200 already-synchronized. Neither endpoint can execute combat. The authenticated host API /api/territory executes orders with revision and requestId, enforcing legal transitions and persistence.

This is an integration seam for the ecosystem, not a claim that Living Table or C2G already runs these rules. Keep the existing games intact while testing this scene independently.
