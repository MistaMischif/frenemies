# Frenemies

Frenemies: Twitch chat splits into two teams and wages live battles — and when one side dwindles, the other side gains the advantage, just like in a real war.

Red and Blue are the only teams. The streamer hosts; viewers play through Twitch chat. Original CSS arena, no external art or music.

## Current delivery status

Deployed October 26, 2026: **https://frenemies-u3n4.onrender.com**. Public source: **https://github.com/MistaMischif/frenemies**. Render Free + Neon Free are configured. Twenty-one automated tests pass. Twitch sign-in and real chat battles with two builder-controlled accounts have been verified, including attacks, surge, control effects and a Blue win saved to the season scoreboard. This is not evidence of an independent audience or live OBS broadcast. Genuine Twitch event effects and the final video remain pending. See `submission/LIVE-TEST.md` for observed evidence and remaining checks; simulated screenshots remain labelled.

## Streamer setup — target under five minutes on a configured server

1. Open the deployed home page and choose **Connect your Twitch channel**.
2. Sign into the broadcaster account and authorize the read-only scopes. The selected channel is the broadcaster's own channel; there is no access to other channels.
3. Copy the overlay URL from controls. In OBS add a Browser Source, paste the URL, and set 1920×1080 or 1280×720.
4. Keep `/control` open in the signed-in browser. Tell chat to type `!human` or `!zombie`, then `!attack`, `!defend`, `!heal` or `!surge`.
5. Click **Start battle**. Use Pause/Resume, Next battle, battlefield events, or the red kill-switch. Kill pauses voting and makes the overlay transparent. Resume restores it.

This five-minute flow assumes the operator has already deployed and registered the Twitch application. Initial developer account/hosting setup takes longer. Setup timing has not yet been measured with a stranger.

## Run locally

Use Node 22 or later. Run `npm ci`, then `npm test`, then `npm start`. Open `http://localhost:3000`. Choose **Try simulated chat** to run without Twitch credentials. The demo uses 12 Red and 6 Blue simulated participants. It runs the same battle engine and does not save season wins. No Twitch messages are sent by the demo.

To configure Twitch, copy `.env.example` to `.env` and fill values locally. Never commit it. Production secrets belong in the host's environment configuration. OAuth access/refresh tokens exist only in process memory, never in files or the client.

## Rules and explicit interpretations

- A battle lasts up to 180 seconds; each team begins at 100 line strength. Tick every two seconds. One counted vote per viewer per window, enforced on the server. The first valid vote wins; duplicates do not change it.
- The most-voted command executes. Command ties use the public order attack, defend, heal, surge. If there are no votes, no command executes.
- Attack is `min(25, (5 + active players) × power multiplier)`. The 25-damage total cap is applied after double damage. Defense then halves damage; fractional line strength is retained.
- Heal is `min(15, 3 + floor(active players / 2))`. Healing and bonuses cannot exceed the starting maximum of 100.
- Defend halves the next incoming attack and is consumed by it. Shields do not stack. Surge doubles the next attack, once per team per 30 seconds. Surge and subscription power-ups do not multiply together or stack.
- Preparation/healing resolves before simultaneous attacks on each tick. This prevents Red-first ordering advantage. Simultaneous zero lines produce a draw. Otherwise zero loses; at timeout compare line strength, then active players, then draw.
- **Active player means a joined viewer who voted or triggered an applicable EventSub moment at any time in this battle. Counts do not decay when people stop chatting or leave.** The user explicitly confirmed this interpretation. Counts reset at the next battle. A smaller team hits less hard, but the game does not invent departures to make headcounts dwindle. The pitch's “dwindles” must not be demonstrated as an inactivity mechanic.
- New viewers can choose their first team mid-battle. Existing players cannot switch while running or paused. Team switching reopens after the result. Next battle resets lines and active counts and starts immediately.
- Pause stops battle time and timed effects and clears pending votes. Freeze clears pending votes and blocks new votes for ten seconds while battle time continues. Fog removes vote totals from the server's public snapshot for ten seconds.
- There is **no hidden rubber-banding, catch-up bonus or secret balancing**. Battlefield events affect both teams equally.

## Twitch integration and scopes

Chat uses Twitch IRC over TLS WebSocket independently of EventSub, so EventSub failure does not stop votes. Twitch recommends EventSub for general chatbots; separate IRC here deliberately satisfies the requested independent chat path and uses only `chat:read`, never chat sending permissions.

Requested scopes, exactly:

- `chat:read`: receive chat over IRC.
- `moderator:read:followers`: follow EventSub v2, with the signed-in broadcaster as moderator.
- `channel:read:subscriptions`: subscriptions, gifts and resubscription messages.
- `channel:read:redemptions`: custom reward redemptions.
- `channel:read:hype_train`: Hype Train begin v2.

Raid events require no additional scope. No email, bits-spending, chat-writing, channel-management or reward-management scopes are requested.

After OAuth, the server looks up the broadcaster through Helix, connects their channel chat, and requests webhook subscriptions: `channel.follow` v2, `channel.subscribe` v1, `channel.subscription.gift` v1, `channel.subscription.message` v1, `channel.raid` v1, `channel.hype_train.begin` v2 and `channel.channel_points_custom_reward_redemption.add` v1. Controls display requested/existing/failed states; “requested” alone is not proof a live event arrived.

- Follow: joined follower's team +2, once per Twitch account per channel across all battles and restarts.
- Subscription/resub: subscriber's next team attack powered up. Gift subscriptions credit the giver; gift-recipient subscribe notifications are ignored to avoid double awards. Anonymous/unjoined givers cannot be assigned a team and get no bonus.
- Raid: the raiding broadcaster's chosen team gets +5. Twitch does not supply a team roster of all raiders. Unjoined raiding broadcaster means no team bonus; raiders may join through chat.
- Hype Train v2 does not identify one triggering viewer. With the **user-approved** `HYPE_TEAM_POLICY=contributors`, each team represented by `top_contributions` gets 60 seconds of double vote weight. Both teams may benefit; the overlay shows individual frenzy countdowns. Unknown/unjoined contributors are not silently assigned a team. With any other policy value, the overlay announces the train without assigning frenzy.
- Rewards named exactly **Supply drop**, **Fog**, and **Freeze** trigger the symmetric effects. Create them manually in Twitch if channel points are available. These effects also work through authenticated streamer controls without channel points.

All team bonuses require a running battle and a joined, nonblocked viewer. Events received during a pause or between battles are not banked. Real EventSub delivery is authenticated with Twitch HMAC signatures, checked for timestamp freshness and deduplicated by message ID. No simulated event is represented as Twitch evidence.

References: [Twitch IRC](https://dev.twitch.tv/docs/chat/irc/), [EventSub types](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/), [webhook handling](https://dev.twitch.tv/docs/eventsub/handling-webhook-events/), [scopes](https://dev.twitch.tv/docs/authentication/scopes/).

## Deployment and Twitch application setup

Use **Render Free + Neon Free PostgreSQL**, selected after comparing Render, Koyeb and Railway on October 26, 2026. `render.yaml` selects Free explicitly and has no paid disk. Neon Free currently has 1GB database storage and 100 CU-hours/project/month, with no card or time limit. Render includes 750 instance-hours/workspace/month. This lightweight score-only database should fit comfortably; monitor actual quotas. Do not horizontally scale the in-memory battle server.

Render can sleep after 15 minutes without inbound requests/messages and take about a minute to wake. Open controls before the stream; reconnect Twitch after a restart. WebSocket ping/pong checks keep active overlay connections healthy; no external keep-awake service is used. Free hosting has no uptime guarantee and may restart. Render quotas can suspend the service; keep the workspace on Free without payment details or paid add-ons.

Render free Postgres expires after 30 days, so it is not used. Railway offers only $1 monthly credit after its trial, which is less predictable for an always-running game. Koyeb is viable, but switching hosts offers no necessary advantage over the already selected Render workflow. Sources: [Render Free](https://render.com/docs/free), [Neon pricing](https://neon.com/pricing), [Railway Free](https://docs.railway.com/pricing/free-trial), [Koyeb scaling](https://www.koyeb.com/docs/run-and-scale/scale-to-zero).

1. Push this directory alone to its public GitHub repository. Do not push the surrounding Unity project.
2. Create a Free Neon project and copy its pooled PostgreSQL connection string with TLS into Render as secret `DATABASE_URL`. In Render create a Free Web Service from the repository. Build: `npm ci`; start: `npm start`; health: `/health`. Keep the Free plan selected. Render supplies `RENDER_EXTERNAL_URL` automatically; `PUBLIC_URL` can override it for a custom domain. The table `frenemies_rooms` is created automatically.
3. Register a web application in [Twitch Developer Console](https://dev.twitch.tv/console/apps). Set the OAuth redirect to `https://YOUR-HOST/auth/callback`. Select an appropriate web application category. Keep client secret in environment variables only.
4. Set `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `SESSION_SECRET`, `EVENTSUB_SECRET`, `DATABASE_URL`, `NODE_ENV=production` and `HYPE_TEAM_POLICY=contributors`. Generate long random session and EventSub secrets (Render can generate them). EventSub secret must be 10–100 ASCII characters.
5. Redeploy. Visit home and sign in with the broadcaster account. The server automatically creates subscriptions using callback `https://YOUR-HOST/eventsub`. The webhook callback belongs to each EventSub subscription, not to the Twitch application's OAuth redirect list.
6. Check controls for subscription errors. Affiliate/Partner-only features may be unavailable for some channels; chat remains usable. Test a real follow from a viewer who already joined a team.
7. Add OBS source, run the live checklist in `submission/LIVE-TEST.md`, and save genuine evidence. Keep hosting available through November 15, 2026 for judging.

## Environment variables — names only

Required for deployed Twitch operation: `DATABASE_URL`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `SESSION_SECRET`, `EVENTSUB_SECRET`, `NODE_ENV`, and either `PUBLIC_URL` or host-provided `RENDER_EXTERNAL_URL`.

Optional: `PORT`, `DATA_DIR` (local JSON fallback only), `BLOCKED_NAMES`, `BLOCKED_COMMANDS`, `HYPE_TEAM_POLICY`.

Blocklists are comma-separated exact values. Names are case-insensitive Twitch logins; commands include `!`. Public display uses text content, never HTML interpolation. Only usernames, team assignments and vote counts needed for play are kept in memory; no chat history or personal profiles are saved.

## Persistence and access

On free hosting, season totals and read-only overlay identifiers live in Neon PostgreSQL table `frenemies_rooms` (keyed by broadcaster ID). Writes are parameterized and serialized per channel. Controls report save failures rather than silently claiming persistence. The database is contacted at startup, sign-in and battle results, not every vote. Back up that table. Local development without `DATABASE_URL` uses `${DATA_DIR}/scores.json`, replaced atomically; corrupt files fail startup rather than silently resetting scores. Production refuses to run without the external database to prevent accidental use of an ephemeral file. Stream totals, battles, viewer choices, login sessions and OAuth tokens are memory-only. A server restart ends the current stream session and requires Twitch sign-in again; season totals and overlay URLs survive in Neon. One process serves all connected rooms; each broadcaster gets a separate room.

The `/control` URL requires an authenticated owner session; knowing an overlay link grants no control privileges. All state-changing controls require an unpredictable CSRF token. Session cookies are HttpOnly, SameSite=Lax and Secure in production. The simple in-memory session store is appropriate only for this single-instance prototype; it does not preserve sessions across restarts. A demo room expires after 12 hours.

## Official contest verification and adjustments

Verified from the **logged-in official Devpost rules page on October 26, 2026 before game code was written**: https://twitchcon-codex.devpost.com/rules .

- Prize split: first $10,000; second $6,000; third $4,000; two runners-up $2,500 each. All five receive stage time at TwitchCon.
- Stage one is viability/theme/tool pass/fail. Stage two equally weights innovation/idea, potential impact, technological implementation (including Codex use), and design.
- Newly created during October 23–November 2 submission period; Twitch-connected and built with Codex. The surrounding older Unity project is not part of this submission.
- Repository must include source/assets/run instructions and be accessible for judging. Public GitHub is our chosen option.
- Include feature/functionality description and how Codex was used; provide the main build's Codex session ID.
- Public YouTube demonstration under three minutes, showing Twitch operation **and footage of how it was built with Codex**. The user's stricter under-two-minute target is retained; the video plan adds Codex footage absent from the original brief. No unlicensed music/art.
- Submission deadline: Monday November 2, 2026, 2 PM Pacific / 4 PM Central. Target noon Central. Feature development stops before the October 30–31 live-test/fix period; November 1 is submission drafting.
- Official rules specify judging November 5–15, overriding the different dates displayed on the schedule page. Keep the project available for judging through November 15.
- Individuals/eligible teams may enter; organizations are excluded. The user must complete eligibility and final submission themselves.

Main Codex session ID: `01a177d0-c6fd-7e90-9a57-dfd241130600`.

## Asset replacement

`public/theme.css` is the marked palette/art swap point. The overlay structure and engine have no dependency on artwork. Future images must retain native proportions using `object-fit:contain` and automatic height/width. Current visuals are original CSS only. No final creator artwork is claimed.

## Future direction

A later version may head toward the Cradle to the Grave universe with Humans vs Zombies, subject to appropriate rights and supplied art. This is not a version-one feature, and must not appear as a claim in the contest submission.

## Future ideas

None implemented beyond the requested scope.
Follow bonuses are limited to one per Twitch account per channel, using the stable Twitch user ID. Eligible claims are saved before awarding points in `frenemies_follow_claims` (or local `follow-claims.json`) and survive server restarts and season resets. Back up this table alongside scores. These IDs are retained solely to prevent repeat bonuses. A claim at full strength still counts; a pause or battle transition during saving may consume the claim without awarding points. Database failures award nothing and request delivery retry. Bonuses issued before this protection was deployed cannot be reconstructed.

## Animated battlefield and optional Barrage

The OBS overlay now draws squads, forts, projectiles, impacts, shields, healing/surge and victory effects from server events. All basic chat actions remain free. Exact player counts are shown numerically; graphical squad symbols are capped at eight per side. No third-party graphics or audio are used.

Barrage is an optional Twitch Extension integration, **disabled pending Twitch setup, review and real transaction validation**. The prepared fixed product is `barrage_v1`, draft 100 Bits, three extra 3-damage shots spaced two seconds apart and a 30-second team cooldown. Shields halve a shot; surge does not multiply Barrage. This intentionally adds a separate paid-action path while retaining the one-free-vote rule. `!barrage` activates banked shots; the Extension also has a button. Unused shots persist by Twitch user ID/channel in `frenemies_barrage` and must be included in database backups. Viewer identity sharing is needed only for this optional feature. Free users need no Extension/account setup.

See `submission/BARRAGE-SETUP.md` for the package, credentials, live gate, retention and rollout limitations. The simulated demo has a **Simulate Barrage · no Bits** button; it is unavailable in real channels. Simulated shots do not constitute real transaction evidence. Existing follow/subscription/channel-point effects remain separate.



Character artwork: seven PNGs supplied by the project owner, served unchanged from public/characters. Human and Zombie presentation retain existing red/blue storage keys to preserve scores. Join commands: !human and !zombie.


## Outbreak campaign (1.1.0)
Persistent characters, settlement chapters, infection/recovery, Twitch convoy objectives and a living chronicle are now included. See releases/1.1.0/README.md for mechanics, commands, self-hosting, and test limitations. !status displays progress on the overlay; !rescue spends free-earned community supplies between battles.


## Battle environments (1.2.0)
Streamer controls now support assigning a built-in scene or uploaded artwork to the next battle. Active battles keep their current scene. See releases/1.2.0/README.md for image limits, persistence and self-hosting.

## C2G battle scenes (1.3.0)

Choose **C2G Woodland clearing** or **C2G Settlement outskirts** in Next battle environment, then assign and start the next battle. Original C2G trees, grass, rocks and a house are composed in depth around a clear combat lane. The control preview uses the same scene renderer. Existing forest/ruins selections now use these compositions. Custom uploads and Neon battlefield remain available. No new service or dependency is required.
