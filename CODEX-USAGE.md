# Codex usage and evidence

Main build session: `01a177d0-c6fd-7e90-9a57-dfd241130600`.

Codex verified the logged-in Devpost rules, generated the independent Express/WebSocket game, deterministic battle engine, OAuth/Helix/IRC/EventSub integration, owner controls, CSRF/HMAC validation, original CSS arena, JSON score persistence, Render blueprint, tests and submission drafts.

Verified by automated tests: vote limits, team locking, active counts, damage/heal caps, simultaneous knockout, defense, surge cooldown, pause/kill, freeze/fog, timeout/tie resolution, EventSub bonus logic, blocklists, simulated score isolation.

Verified through browser automation on October 26: home, labelled simulated session creation, battle start, 12 Red versus 6 Blue active counts, votes and line movement, completed simulated battle and scoreboard, next battle, kill-switch blanking; inspected 1920×1080 and corrected/inspected 1280×720 layout.

Verified by human in a real live Twitch test: **none yet**. Do not confuse automated simulated testing with a live Twitch test. Public deployment is verified at https://frenemies-u3n4.onrender.com on Render Free with Neon Free. A complete simulated battle ran through public WebSockets and reached the scoreboard. Actual Twitch OAuth/EventSub and real viewer verification remain pending.
