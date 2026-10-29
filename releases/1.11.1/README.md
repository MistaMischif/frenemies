# Frenemies 1.11.1 - A demo that starts playing

Try simulated chat now opens the shared battlefield and automatically enlists the community, dispatches a convoy and starts all four simulated roles. After scouting, the simulated commander chooses the detour so the convoy advances without further clicks. Existing simulated sessions have a prominent Start moving battlefield demo button. Live commander choices are unchanged. The demo completes a convoy; use Start moving battlefield demo again for another.

All 1.11.0 visual enhancements remain included: fortification layers and shield, scout flags and sweeps, escort groups, assault fire and impacts, action pulses, damage, commander decisions and outcome cues. Larger escort groups now reuse available fallback artwork rather than requesting an undefined asset.

Before packaging: 87 tests passed, with HTTP coverage verifying automatic route choice, movement, all four role counters and repeat-start idempotency. Browser verification from the homepage confirmed automatic startup, convoy movement and all four visual groups; no browser errors. Simulated results are not live engagement evidence.

Play: https://frenemies-u3n4.onrender.com/ (Try simulated chat)
Local: http://localhost:3005/
Self-host: Node 22+, npm ci, npm test, npm start; configure .env.example. No new services or dependencies.
