# Frenemies 1.3.0 - C2G layered environments

Two curated scenes reuse original C2G map artwork: Woodland clearing and Settlement outskirts. Depth-scaled trees, textured ground, a worn lane, foreground rocks and distant houses fit the existing camera. Character contact shadows follow the foot plane. The control preview shares the game renderer. Existing forest/ruins saved IDs are compatible; selections still apply to the next battle.

## Play locally

Node.js 22+: extract frenemies-1.3.0.zip, run npm ci then npm start. Open http://localhost:3000, choose Try simulated chat, then select a C2G scene, Assign to next battle, and Start battle. Refresh an already-running local server's control and overlay pages to load the new renderer. No Twitch account, payment or external image service is needed for simulated play. Real Twitch setup is described in the root README.

## Validation

28 existing regression tests passed. Offscreen renders of the actual battlefield canvas inspected at 1200x260, 1760x440 and 640x210 with six characters per side. Included PNGs are simulated renderer captures, not live Twitch evidence. Browser inspection unavailable because the Windows browser tool failed to launch; full browser/OBS confirmation remains pending. No game rules or persistent data schema changes.

Source artwork attribution and hashes: public/environments/c2g/ASSETS.md. Art is supplied by the project owner and is not separately licensed for reuse. Archive excludes credentials, local data and private screenshots.
