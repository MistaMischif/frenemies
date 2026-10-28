# Frenemies 1.1.0 — Outbreak campaign test build

Persistent opt-in characters use Twitch user IDs, retaining progress across username changes. Join with !human or !zombie. !status displays character progress on the overlay; no additional chat-write permission is requested. Recruit becomes Survivor after one played chapter, Veteran after five.

Played battles move settlement integrity by +10 (Human victory) or -10 (Zombie victory). Draws leave integrity unchanged. All played chapters earn 3 shared supplies. Zero-participant rounds earn nothing. At zero integrity, the community evacuates to a new refuge at 50. No absentee penalties.

Humans who actively participate in a lost chapter become infected. Next battle they fight as Zombies. Between battles, !rescue spends 3 shared supplies to remove infection; then !human rejoins the Humans. No permanent death or purchased resurrection.

Raids and Hype Train begin events create one convoy objective resolved by the next completed played battle. Human victory yields 3 extra supplies; Zombie victory overruns the convoy. Additional events do not stack the reward. Subscription and gift-sender events add 1 supply; gifted recipient subscription notifications are ignored. Existing battle effects remain. Campaign EventSub receipts persist for 24 hours; signed webhook timestamp acceptance remains 10 minutes. Follow bonuses retain their existing durable one-time protection.

The overlay shows campaign status and latest chronicle entry. Streamer controls show the latest ten entries; thirty are retained. Characters and campaign data live alongside existing season data. Storage errors appear in control status; do not stop the server while a save is pending/failed. Single-process operation only. In-progress battles are not recovered after restart; completed character progress is.

## Run on your own hardware

Install Node.js 22 or newer. Extract frenemies-1.1.0.zip, run `npm ci`, then `npm start`. Open http://localhost:3000 and choose Try simulated chat. No paid API, Twitch account, or database service is needed for the demo. Demo campaign state is disposable and never updates real scores.

For a real channel, configure .env from .env.example and the Twitch credentials described in README.md. Use your own PostgreSQL via DATABASE_URL, or set ALLOW_LOCAL_STORAGE=true and DATA_DIR to a persistent local directory. Public production hosting needs HTTPS and a matching PUBLIC_URL for OAuth and EventSub. Use one process, back up the data directory/database, and keep credentials out of source and release archives. Twitch itself remains required for Twitch chat/events; campaign computation needs no AI service.

## Verify

Run `npm test`. In simulated controls, click Simulate raid convoy, Start battle, then watch the next chapter resolve and earn supplies. Automated tests cover identity rename, infection, recovery, absent-player protection, empty-round behavior, event replay, and local storage restart. Genuine raid/Hype/subscription campaign effects still need a live-channel test; simulation is not live Twitch evidence. Bits remains separately gated pending Twitch setup.
