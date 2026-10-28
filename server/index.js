import express from "express";
import session from "express-session";
import helmet from "helmet";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Game } from "./game.js";
import { openStorage } from "./storage.js";
import { openBarrageLedger, BarrageRunner } from "./barrage.js";
import { createExtension } from "./extension.js";
import {
  SCOPES,
  token,
  helix,
  subscribe,
  connectChat,
  applyEvent,
} from "./twitch.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const production = process.env.NODE_ENV === "production";
if (
  production &&
  (!process.env.SESSION_SECRET ||
    !(process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL))
)
  throw new Error("SESSION_SECRET and PUBLIC_URL required");
const base = (
  process.env.PUBLIC_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, "data"));
if (production && !process.env.DATABASE_URL)
  throw new Error(
    "DATABASE_URL is required for persistent scores on free hosting",
  );
const storage = await openStorage({
  databaseUrl: process.env.DATABASE_URL,
  dataDir,
});
const persisted = storage.data;
const barrageLedger = await openBarrageLedger({
  databaseUrl: process.env.DATABASE_URL,
  dataDir,
});
const barrageRunner = new BarrageRunner(barrageLedger);
const rooms = new Map(),
  seen = new Map();
const writes = new Map();
function save(id) {
  const record = structuredClone(persisted[id]);
  const pending = (writes.get(id) || Promise.resolve())
    .catch(() => {})
    .then(() => storage.put(id, record));
  writes.set(id, pending);
  const room = rooms.get(id);
  if (room) room.integration.storage = "saving";
  pending.then(
    () => {
      if (room) room.integration.storage = "saved";
    },
    () => {
      if (room)
        room.integration.storage =
          "SAVE FAILED — reconnect before ending stream";
      console.error("Season score save failed");
    },
  );
  return pending;
}
function makeRoom(id, login, simulated = false) {
  const old = persisted[id] || {
    season: { red: 0, blue: 0 },
    overlay: randomBytes(24).toString("hex"),
    login,
  };
  if (!simulated) {
    persisted[id] = old;
  }
  const room = {
    id,
    login,
    overlay: old.overlay,
    userNames: new Map(),
    claimFollow: (userId) => storage.claimFollow(id, userId),
    integration: {
      chat: simulated ? "SIMULATED" : "not connected",
      subscriptions: [],
      storage: simulated ? "simulated — not persisted" : storage.mode,
    },
  };
  room.game = new Game({
    host: login,
    season: old.season,
    save: (season) => {
      persisted[id].season = season;
      save(id);
    },
    blockedNames: (process.env.BLOCKED_NAMES || "").split(","),
    blockedCommands: (process.env.BLOCKED_COMMANDS || "").split(","),
  });
  room.game.simulated = simulated;
  room.barrage = (user, name) =>
    barrageRunner
      .activate(room, user, name)
      .catch(() => room.game.say("Barrage unavailable; saved shots are safe."));
  rooms.set(id, room);
  return room;
}
for (const [id, r] of Object.entries(persisted)) makeRoom(id, r.login);
const app = express();
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { "connect-src": ["'self'", "wss:", "ws:"] },
    },
  }),
);
app.use("/eventsub", express.raw({ type: "application/json", limit: "64kb" }));
app.post("/eventsub", async (req, res) => {
  const id = req.get("Twitch-Eventsub-Message-Id") || "",
    stamp = req.get("Twitch-Eventsub-Message-Timestamp") || "",
    sig = req.get("Twitch-Eventsub-Message-Signature") || "";
  if (
    !process.env.EVENTSUB_SECRET ||
    !Buffer.isBuffer(req.body) ||
    !id ||
    !Number.isFinite(Date.parse(stamp)) ||
    Math.abs(Date.now() - Date.parse(stamp)) > 600000
  )
    return res.sendStatus(403);
  const expected =
    "sha256=" +
    createHmac("sha256", process.env.EVENTSUB_SECRET)
      .update(id + stamp)
      .update(req.body)
      .digest("hex");
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  )
    return res.sendStatus(403);
  let body;
  try {
    body = JSON.parse(req.body);
  } catch {
    return res.sendStatus(400);
  }
  if (
    req.get("Twitch-Eventsub-Message-Type") === "webhook_callback_verification"
  )
    return res.type("text").send(body.challenge);
  if (seen.has(id)) return res.sendStatus(204);
  const room = rooms.get(
    body.subscription?.condition?.broadcaster_user_id ||
      body.subscription?.condition?.to_broadcaster_user_id,
  );
  if (room) {
    if (req.get("Twitch-Eventsub-Message-Type") === "revocation")
      room.integration.subscriptions.push({
        type: body.subscription.type,
        status: "revoked",
      });
    else {
      try {
        await applyEvent(room, body.subscription.type, body.event || {});
      } catch {
        console.error("EventSub processing failed; requesting retry");
        return res.sendStatus(503);
      }
    }
  }
  seen.set(id, Date.now());
  res.sendStatus(204);
});
app.use(express.json({ limit: "8kb" }));
app.use(express.urlencoded({ extended: false, limit: "8kb" }));
const extension = createExtension({
  ledger: barrageLedger,
  runner: barrageRunner,
  rooms,
});
extension.mount(app);
extension.reconcile();
setInterval(() => extension.reconcile(), 300000).unref();
app.use(
  session({
    name: "frenemies.sid",
    secret: process.env.SESSION_SECRET || randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      maxAge: 12 * 3600000,
    },
  }),
);
app.get("/health", (_, res) => res.json({ ok: true }));
app.get("/auth/twitch", (req, res) => {
  if (
    !process.env.TWITCH_CLIENT_ID ||
    !process.env.TWITCH_CLIENT_SECRET ||
    !process.env.EVENTSUB_SECRET
  )
    return res
      .status(503)
      .send(
        "Twitch setup is not configured yet. Use simulated demo or configure server environment.",
      );
  req.session.state = randomBytes(24).toString("hex");
  res.redirect(
    "https://id.twitch.tv/oauth2/authorize?" +
      new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        redirect_uri: base + "/auth/callback",
        response_type: "code",
        scope: SCOPES.join(" "),
        state: req.session.state,
      }),
  );
});
app.get("/auth/callback", async (req, res, next) => {
  try {
    if (
      !req.query.state ||
      req.query.state !== req.session.state ||
      typeof req.query.code !== "string"
    )
      return res
        .status(403)
        .send("Invalid sign-in state. Start sign-in again.");
    delete req.session.state;
    const tokens = await token({
      grant_type: "authorization_code",
      code: req.query.code,
      redirect_uri: base + "/auth/callback",
    });
    const {
      data: [user],
    } = await helix("users", tokens.access_token);
    await new Promise((resolve, reject) =>
      req.session.regenerate((e) => (e ? reject(e) : resolve())),
    );
    req.session.owner = user.id;
    req.session.csrf = randomBytes(24).toString("hex");
    const room = rooms.get(user.id) || makeRoom(user.id, user.login);
    await save(user.id);
    connectChat(room, tokens);
    await subscribe(room, base);
    res.redirect("/control");
  } catch (e) {
    next(e);
  }
});
app.post("/demo", (req, res) => {
  if (!req.session.csrf || req.body.csrf !== req.session.csrf)
    return res.sendStatus(403);
  if (rooms.size > 1000) return res.sendStatus(503);
  const id = "demo-" + randomBytes(12).toString("hex"),
    room = makeRoom(id, "simulated-host", true);
  req.session.owner = id;
  req.session.csrf = randomBytes(24).toString("hex");
  room.expires = Date.now() + 12 * 3600000;
  for (let i = 0; i < 12; i++) room.game.chat("sim_red_" + i, "!red");
  for (let i = 0; i < 6; i++) room.game.chat("sim_blue_" + i, "!blue");
  res.redirect(303, "/control");
});
const owner = (req, res, next) => {
  req.room = rooms.get(req.session.owner);
  if (!req.room)
    return res
      .status(401)
      .json({ error: "Sign in with Twitch or start a simulated demo." });
  next();
};
app.get("/api/control", owner, (req, res) =>
  res.json({
    csrf: req.session.csrf,
    channel: req.room.login,
    overlay: `${base}/overlay/${req.room.overlay}`,
    control: `${base}/control`,
    integration: req.room.integration,
    barrage: barrageRunner.error || extension.status(),
    state: req.room.game.snapshot(),
  }),
);
app.post("/api/control", owner, (req, res) => {
  if (!req.session.csrf || req.get("x-csrf-token") !== req.session.csrf)
    return res.sendStatus(403);
  const g = req.room.game;
  const action = req.body.action;
  if (action === "start" || action === "next") g.start();
  else if (action === "pause") g.pause();
  else if (action === "kill") g.kill();
  else if (["supply", "fog", "freeze"].includes(action)) g.battlefield(action);
  else if (action === "demo-barrage" && g.simulated) {
    if (g.canBarrage("sim_red_0")) {
      const id = "demo-" + randomBytes(12).toString("hex");
      barrageLedger
        .grant(id, req.room.id, "demo")
        .then(() => barrageRunner.activate(req.room, "demo", "sim_red_0"))
        .catch(() => g.say("Demo Barrage unavailable"));
    }
  } else return res.sendStatus(400);
  broadcast(req.room);
  res.json(g.snapshot());
});
app.get("/control", (_, res) =>
  res.sendFile(path.join(root, "public/control.html")),
);
app.get("/overlay/:key", (req, res) => {
  if (![...rooms.values()].some((r) => r.overlay === req.params.key))
    return res.sendStatus(404);
  res.sendFile(path.join(root, "public/overlay.html"));
});
app.get("/", (req, res) => {
  req.session.csrf ||= randomBytes(24).toString("hex");
  res
    .set("Cache-Control", "no-store")
    .type("html")
    .send(
      readFileSync(path.join(root, "public/index.html"), "utf8").replace(
        "<!--CSRF-->",
        `<input type="hidden" name="csrf" value="${req.session.csrf}">`,
      ),
    );
});
app.use(express.static(path.join(root, "public")));
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({
    error: "Request failed. Check server configuration and reconnect Twitch.",
  });
});
const server = createServer(app),
  wss = new WebSocketServer({ server, maxPayload: 1024 });
wss.on("connection", (ws, req) => {
  const key = new URL(req.url, base).searchParams.get("overlay");
  const room = [...rooms.values()].find((r) => r.overlay === key);
  if (!room) {
    ws.close(1008);
    return;
  }
  ws.room = room;
  ws.alive = true;
  ws.on("pong", () => {
    ws.alive = true;
  });
  ws.send(JSON.stringify(room.game.snapshot()));
  ws.on("error", () => {});
});
function broadcast(room) {
  const data = JSON.stringify(room.game.snapshot());
  for (const ws of wss.clients)
    if (ws.room === room && ws.readyState === 1) {
      if (ws.bufferedAmount > 1e6) ws.close();
      else ws.send(data);
    }
}
let last = Date.now();
setInterval(() => {
  const now = Date.now(),
    dt = now - last;
  last = now;
  for (const [id, room] of rooms) {
    if (room.expires < now) {
      rooms.delete(id);
      for (const ws of wss.clients) if (ws.room === room) ws.close();
      continue;
    }
    const g = room.game;
    if (
      g.simulated &&
      g.status === "running" &&
      Math.floor(g.elapsed / 2000) !== room.simTick
    ) {
      room.simTick = Math.floor(g.elapsed / 2000);
      for (const [name, t] of g.players)
        g.chat(
          name,
          t === "red"
            ? "!attack"
            : room.simTick % 3 === 0
              ? "!defend"
              : "!attack",
        );
      if (room.simTick === 4) g.moment("follow", "sim_blue_0");
    }
    g.advance(dt);
    broadcast(room);
  }
  barrageRunner.pump();
  for (const [id, time] of seen) if (now - time > 600000) seen.delete(id);
}, 250).unref();
server.listen(process.env.PORT || 3000, () =>
  console.log(`Frenemies listening on ${base}`),
);
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    ws.ping();
  }
}, 30000).unref();
process.on("SIGTERM", async () => {
  for (const room of rooms.values()) room.stopChat?.();
  for (const ws of wss.clients) ws.close();
  server.close();
  await Promise.allSettled([...writes.values()]);
  await storage.close();
  await barrageLedger.close();
  process.exit(0);
});
