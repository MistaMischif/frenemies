# Live test record — pending

Channel: https://www.twitch.tv/jztheartist

No real live test has yet occurred. Fill each item only from observed evidence; include date, public URL, participants' consent to appearing in the demo, and recording timestamps.

- [ ] Public home, owner control and OBS overlay load over HTTPS.
- [ ] Streamer signs in; own channel selected; setup measured under five minutes.
- [ ] At least two real viewers join opposing teams. Streamer cannot play.
- [ ] First counted vote per viewer per two-second window; duplicate votes ignored.
- [ ] Team switching rejected during battle and reopened after result.
- [ ] Unequal active counts visibly yield unequal attacks. Counts do not expire.
- [ ] Defense, heal and surge work; cooldown and damage cap visible.
- [ ] Genuine joined-viewer follow/sub/raid event changes the correct team.
- [ ] Hype Train contribution policy, if available, matches documentation.
- [ ] Supply/Fog/Freeze via controls and available channel-point rewards.
- [ ] Kill immediately clears OBS overlay, rejects votes; resume works.
- [ ] Complete battle reaches result and increments stream/season scoreboard.
- [ ] Next battle begins in one click; viewers may repick between battles.
- [ ] Restart server: season score and overlay URL survive; reconnect Twitch.
- [ ] Capture live overlay, scoreboard and controls screenshots.
- [ ] Record and edit under-two-minute video; publish on YouTube.

Any unavailable event must be stated as unverified. Never substitute simulated chat for real test evidence.

## Observed real-chat functional test — October 26, 2026

Test accounts controlled by the builder: MistaMischif (Red), colonelpeck3r (Blue). This was actual Twitch chat, not simulated players; an independent audience or live broadcast was not verified.

Observed: both accounts joined and attacked; both active counts became 1 and both lines fell to 94 (6 damage each). In battle 3, chat showed defend, attack, heal, surge, attack in sequence; final Red strength 88 and last action “blue attacks −12” directly verified surge. Defense/heal intermediate states were not captured separately; final state is consistent with them.

During battle 3, kill-switch cleared the overlay, resume restored running state, fog hid vote totals, freeze displayed its countdown and expired, and supply drop changed Red 88→93 while Blue stayed capped at 100. Timer expired with Blue 100 vs Red 93. Both stream and season scoreboards became Red 0 / Blue 1. Controls reported “Scores: saved”. Evidence saved locally as real-chat-attacks.jpg, real-surge-result.jpg and real-blue-win.jpg.

Still pending: genuine EventSub effect, persistence verified after restart, unequal active headcounts, channel-point redemption, rejection of duplicate votes/mid-battle switches observed live, OBS/live broadcast and final video. An earlier server restart cleared the current session and teams; Twitch reconnect restored operation. Logs showed a new process but no crash cause.

## Follow protection deployment and persistence — October 26, 2026

Deployed commit 8f95615 on Render Free. All 14 automated tests passed. Production startup successfully initialized the durable follow-claim table. After reconnecting Twitch, the same overlay URL showed SEASON RED 0 : 1 BLUE, while THIS STREAM reset to 0 : 0 as designed. Evidence: real-season-after-restart.jpg. This verifies season-score persistence after a real battle and service replacement. The persistent follow limit is deployed; a genuine post-patch follow effect remains unverified.

## Animated overlay and Barrage — October 27, 2026

21 automated tests pass, including the Extension HTTP boundary, forged/expired identities, wrong viewer/channel claims, duplicate transactions, durable balances, pending-shot recovery, cooldowns, shields, pause/freeze and battle-ending interruption. Local 1280×720 browser test showed animated attacks and Barrage, no console errors, and kill cleared the entire overlay. Screenshots animated-battle-simulated.jpg and animated-barrage-simulated.jpg are explicitly simulated. Twitch Extension registration/credentials, real Bits transaction and Twitch mobile testing remain pending; the paid feature is disabled by default.
