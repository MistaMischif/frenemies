# Frenemies 1.4.0 - Cradle to the Grave physical edition

Physical prototype 0.1 plus a companion that shares the existing Twitch game and outbreak campaign. All illustrations are supplied C2G artwork, with provenance in public/tabletop-assets/ASSETS.md.

## Test immediately

Extract frenemies-1.4.0.zip. With Node.js 22+, run npm ci and npm start. Open http://localhost:3000, then Start physical tabletop companion. On the project computer the running test URL is http://localhost:3005. Seat at least one Human and one Zombie, start, select their revealed cards, and Resolve simultaneous round. Local tabletop campaigns persist in DATA_DIR; use stable names and re-seat them on a later visit.

For a real channel, connect Twitch through the existing sign-in and open /tabletop in that room. Select tabletop pace between battles. Physical and chat votes resolve together; the existing overlay and campaign share the result. No new Twitch permissions are needed. Switch back to real-time pace between battles. Purchased Barrage is not used or consumed in tabletop mode.

## Print the physical game

frenemies-print-and-play.pdf is the complete 18-page kit: five rules pages, four full-size landscape Letter board tiles, action/character/event/encounter/equipment cards, counters and campaign journals. Print Actual size, auto-rotate, single-sided. Print the action sheet once per player. Tile borders show where to trim. The separate frenemies-board-a3.pdf is the A3 master for larger printers. Cards are 2.5 x 3.5 inches. Both the A3 board and assembled tiles have matching card slots.

The paper game requires no app, Twitch account or purchase. The 100-chapter tracker is a campaign framework, not 100 authored scenarios. Woodland, Moles, Shields and Mega Mech are four tabletop prototype encounters. C2G progression references support component identities and enemy concepts; the tabletop balance and unlock cadence are new design choices.

## Implemented rules

12 manual rounds; shared 100 strength; simultaneous majority decisions; three-round Surge recharge; persistent infection, recovery, clinic supplies and settlement. Frenzy gives one +3 attack. Earned Barrage gives +3 on three attacks. Bonuses obey the 25-damage cap. One component per faction per played tabletop battle cycles launcher/bipod/sensor; crafting consumes all three for permanent +2 Attack. Encounters unlock after 0/1/2/4 tabletop battles. Approved emergency recovery requires every registered character infected and supplies below 3, costs 10 integrity, and recovers one volunteer. Evacuation at zero resets integrity to 50.

## Validation and current limits

36 tests pass, including shared physical/chat decisions, HTTP authentication and CSRF, stale reveal rejection, WebSocket delivery to the overlay, local persistence, encounters, crafting, freeze progression, emergency recovery and existing game rules. All PDF pages rendered and inspected; full-size board tiles and card dimensions checked. Browser UI/OBS inspection is unverified because the Windows browser tool cannot launch (HRESULT 0x80070020). Live Twitch playtest of the new mode remains pending. Render deployment verified on 2026-10-28: /health reports 1.4.0; companion and both PDFs return HTTP 200; an isolated hosted simulated room completed all 12 rounds and correctly awarded supplies, crafting progress and a campaign chapter.

In-progress battles remain memory-only. Real Twitch and local tabletop campaigns persist; hosted demo campaigns expire. Journal export is a readable backup, not an offline-result import or conflict reconciliation system. Bits onboarding is separate and not required. PDFs can be rebuilt with free Python reportlab/pypdf using tools/build_tabletop_kit.py. No new runtime or paid dependency.
