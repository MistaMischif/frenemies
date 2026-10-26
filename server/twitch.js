import WebSocket from "ws";
export const SCOPES = [
  "chat:read",
  "moderator:read:followers",
  "channel:read:subscriptions",
  "channel:read:redemptions",
  "channel:read:hype_train",
];
const client = () => process.env.TWITCH_CLIENT_ID;
export async function token(params) {
  const r = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: client(),
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      ...params,
    }),
  });
  if (!r.ok) throw new Error(`Twitch token request failed (${r.status})`);
  return r.json();
}
export async function helix(path, access, options = {}) {
  const r = await fetch(`https://api.twitch.tv/helix/${path}`, {
    ...options,
    headers: {
      "Client-Id": client(),
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!r.ok)
    throw new Error(`Twitch API ${path.split("?")[0]} failed (${r.status})`);
  return r.status === 204 ? {} : r.json();
}
export async function subscribe(room, base) {
  const app = await token({ grant_type: "client_credentials" }),
    id = room.id;
  const specs = [
    ["channel.follow", "2", { broadcaster_user_id: id, moderator_user_id: id }],
    ["channel.subscribe", "1"],
    ["channel.subscription.gift", "1"],
    ["channel.subscription.message", "1"],
    ["channel.raid", "1", { to_broadcaster_user_id: id }],
    ["channel.hype_train.begin", "2"],
    ["channel.channel_points_custom_reward_redemption.add", "1"],
  ];
  room.integration.subscriptions = [];
  for (const [type, version, condition] of specs) {
    try {
      await helix("eventsub/subscriptions", app.access_token, {
        method: "POST",
        body: JSON.stringify({
          type,
          version,
          condition: condition || { broadcaster_user_id: id },
          transport: {
            method: "webhook",
            callback: `${base}/eventsub`,
            secret: process.env.EVENTSUB_SECRET,
          },
        }),
      });
      room.integration.subscriptions.push({ type, status: "requested" });
    } catch (e) {
      room.integration.subscriptions.push({
        type,
        status: e.message.includes("(409)") ? "existing" : "failed",
        error: e.message,
      });
    }
  }
}
export function connectChat(room, tokens) {
  room.stopChat?.();
  let stopped = false,
    ws,
    timer,
    refreshTimer;
  const open = () => {
    if (stopped) return;
    ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
    ws.on("open", () => {
      ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      ws.send(`PASS oauth:${tokens.access_token}`);
      ws.send(`NICK ${room.login}`);
      ws.send(`JOIN #${room.login}`);
    });
    ws.on("message", (raw) => {
      for (const line of String(raw).split("\r\n")) {
        if (line.startsWith("PING")) {
          ws.send(line.replace("PING", "PONG"));
          continue;
        }
        if (line.includes(" 001 ")) room.integration.chat = "connected";
        if (line.includes(" RECONNECT")) ws.close();
        if (line.includes("Login authentication failed")) {
          room.integration.chat = "authentication failed";
          ws.close();
        }
        const m = line.match(
          /^(?:@([^ ]+) )?:([^! ]+)!\S+ PRIVMSG #[^ ]+ :(.*)$/,
        );
        if (m) room.game.chat(m[2], m[3]);
        if (line.includes(" CLEARCHAT ") || line.includes(" CLEARMSG ")) {
          room.game.events = [];
          room.game.last = "Chat moderation applied";
        }
      }
    });
    ws.on("error", () => {
      room.integration.chat = "connection error";
    });
    ws.on("close", () => {
      room.integration.chat = "disconnected";
      if (!stopped) timer = setTimeout(open, 5000);
    });
  };
  const refresh = async () => {
    try {
      tokens = await token({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      });
      ws?.close();
      refreshTimer = setTimeout(
        refresh,
        Math.max(60000, (tokens.expires_in - 300) * 1000),
      );
    } catch {
      room.integration.chat = "Sign in again to reconnect";
    }
  };
  refreshTimer = setTimeout(
    refresh,
    Math.max(60000, (tokens.expires_in - 300) * 1000),
  );
  room.stopChat = () => {
    stopped = true;
    clearTimeout(timer);
    clearTimeout(refreshTimer);
    ws?.close();
  };
  open();
}
export async function applyEvent(room, type, e) {
  const g = room.game;
  if (type === "channel.follow") {
    const name = String(e.user_login || "").toLowerCase();
    if (
      g.status !== "running" ||
      !g.players.has(name) ||
      name === g.host ||
      g.blockedNames.has(name) ||
      !/^\d+$/.test(String(e.user_id || ""))
    )
      return;
    const round = g.round;
    // Claim before awarding: database failures cannot grant unrecorded bonuses.
    if (await room.claimFollow(String(e.user_id))) {
      if (g.round === round && g.status === "running") g.moment("follow", name);
    }
    return;
  }
  if (type === "channel.channel_points_custom_reward_redemption.add") {
    const names = { "Supply drop": "supply", Fog: "fog", Freeze: "freeze" };
    const action = names[e.reward?.title];
    if (action) g.battlefield(action);
    return;
  }
  if (type === "channel.hype_train.begin") {
    // v2 has no triggering viewer. Policy must be explicitly selected in deployment configuration.
    if (process.env.HYPE_TEAM_POLICY === "contributors")
      for (const t of ["red", "blue"]) {
        const c = e.top_contributions?.find(
          (c) => g.players.get(c.user_login?.toLowerCase()) === t,
        );
        if (c) g.moment("hype", c.user_login);
      }
    else g.say("HYPE TRAIN · Triggering team unavailable");
    return;
  }
  const kind = {
    "channel.subscribe": "sub",
    "channel.subscription.gift": "sub",
    "channel.subscription.message": "sub",
    "channel.raid": "raid",
  }[type];
  // Gift recipients do not trigger the purchase. Award only the gift sender's event.
  if (type === "channel.subscribe" && e.is_gift) return;
  if (kind)
    g.moment(
      kind,
      type === "channel.raid" ? e.from_broadcaster_user_login : e.user_login,
    );
}
