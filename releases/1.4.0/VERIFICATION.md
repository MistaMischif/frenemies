# Hosted verification - 2026-10-28

Service: https://frenemies-u3n4.onrender.com
Direct test: https://frenemies-u3n4.onrender.com/tabletop
Local test: http://localhost:3005/tabletop

Health reports version 1.4.0. Companion page, 18-page print-and-play kit and A3 board all returned HTTP 200; PDF lengths matched the inspected local files. An isolated simulated hosted room accepted two physical players, switched to tabletop pace, resolved 12 rounds, finished the battle, awarded 3 shared supplies and one component per faction, and advanced the campaign. No real Twitch channel was modified.

36 automated tests pass, including WebSocket overlay synchronization, authorization/CSRF, duplicate reveal guards, local persistence, combined physical/chat majority votes, encounters, crafting and emergency recovery. All 18 PDF pages and the separate A3 board were rendered and inspected. Binary PDF bytes in Git match the inspected originals.

Browser UI and OBS visual verification remain pending: Windows browser automation failed to launch with HRESULT 0x80070020. Real viewers have not yet playtested tabletop mode. This release is a playable prototype requiring balance playtests. The ZIP's README records the pre-deployment packaging state; this report and the release-page notes supersede that deployment-status sentence. No code or artifact changed during hosted verification.
