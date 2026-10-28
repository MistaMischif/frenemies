# Frenemies 1.2.0 — Battle environments test build

Choose Neon battlefield, Abandoned city, Quarantine forest, or upload your own artwork in streamer controls. Click Assign to next battle before starting a round. Changing the selection during a running or paused battle affects only the next battle.

PNG/JPEG/WebP uploads are resized to at most 1600 x 900 and converted to JPEG. Input limit 10 MB; stored limit 512 KB per image; eight custom environments per channel. Wide artwork (about 5:1) works best. Images are center-cropped to fill the battlefield; transparency is flattened onto dark blue. Failed image loading retains the default gradient. No delete/replace interface yet.

Real-channel assets and next selection persist in the existing PostgreSQL or local JSON room storage. Anyone with the overlay link can see the artwork. Demo uploads are temporary. No external image host or paid API is needed. In-progress battles remain memory-only.

## Run on your own hardware

Extract frenemies-1.2.0.zip. Install Node.js 22+, run npm ci then npm start. Open http://localhost:3000 and choose Try simulated chat. Select a scene, assign it and start a battle. Choose a different next environment while paused to verify that the current scene remains unchanged.

For real Twitch, configure .env using .env.example and README.md. Use your own PostgreSQL, or set ALLOW_LOCAL_STORAGE=true with a durable DATA_DIR for single-process production hosting. Public HTTPS is required for Twitch callbacks. The archive contains no credentials or user-uploaded artwork.

## Validation

28 tests cover game rules, campaign persistence, event replay, environment selection, CSRF protection, upload format/size checks, and current/next-battle isolation. Starter forest preview checked in browser. Twitch Bits remains separately gated.
