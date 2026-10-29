# Frenemies 1.6.0 - Back to Twitch

Twitch-first onboarding, one-command joining, compact OBS layout and battle recaps. Human/Zombie team commands, free participation, C2G artwork and persistent outbreak history remain.

## Test this build

Local: http://localhost:3005. Choose Try simulated chat, then Start battle. Select Compact strip in controls to preview it and copy that OBS URL. Full arena remains available. Live viewers can type !join, then !attack, !defend, !heal or !surge. Joining restores known character faction (infected characters join Zombies); new characters join the smaller roster. Joining alone does not inflate active counts.

If an old prototype was active, use Return to Twitch battles. It retains the saved map without awarding a victory. Board-game links are removed from the main homepage and controls; legacy source and saved state remain archived in the repository.

## Verified

49 automated tests pass. A complete local HTTP simulated battle verified homepage, session creation, compact overlay route, start/pause/resume, 18 participants and a 144-accepted-vote recap. No actual Twitch messages or Bits transactions were sent by this test. Duplicate submissions are excluded; recaps count accepted submissions and are session-only. Equal contributor counts use alphabetical ordering.

Browser/OBS visual verification is pending: the browser tool cannot launch (Windows HRESULT 0x80070020). Hosted health still reports 1.4.0 on October 29, 2026. Deploy latest commit on the existing Render service before using these changes at https://frenemies-u3n4.onrender.com. No Render API credential is configured. Live Bits availability remains blocked by Extension onboarding/eligibility.

## Product direction

See docs/TWITCH-PRODUCT-DIRECTION.md in the ZIP/repository for primary research sources, planned signature raid encounter, living-chronicle moments, creator controls, bounded monetization, scale tests and creator-pilot success gates. These future features are not all implemented in this release. No claim of top-streamer adoption or retention uplift is made.

## Self-host

Extract ZIP; install Node.js 22+; run npm ci then npm start; visit http://localhost:3000. Demo requires no Twitch credentials or paid API. Configure Twitch with .env.example only when needed. Keep secrets outside version control. Existing Render Free/Neon Free hosting is unchanged. ZIP excludes credentials, runtime data, private submission evidence and previous release packages.
