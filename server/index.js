import express from "express";
import { environmentList, parseEnvironmentUpload } from "./environments.js";
import { TerritoryGame } from "./territory.js";
import { createHash } from "node:crypto";
import { Tabletop } from "./tabletop.js";
import { Campaign } from "./campaign.js";
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
if (production && !process.env.DATABASE_URL && process.env.ALLOW_LOCAL_STORAGE !== "true")
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
    environmentAssets: old.environments || [],
    nextEnvironment: old.nextEnvironment || "default",
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
  room.campaign = new Campaign(old.campaign, () => {
    if (simulated) return;
    persisted[id].campaign = room.campaign.data;
    save(id);
  });
  room.game.campaign = room.campaign;
  room.game.tabletop = new Tabletop(room.game, room.campaign);
  room.territory = new TerritoryGame(room.campaign);
  room.game.territory = room.territory;
  room.bridgeHash = old.bridgeHash;
  room.observation = null;
  for(const [key,c] of Object.entries(room.campaign.data.characters)) if(key.startsWith("table:")) room.campaign.identify(key,c.name);
  room.chat = (userId, name, text) => {
    name = name.toLowerCase(); text = text.trim().toLowerCase();
    if (name === room.game.host || room.game.blockedNames.has(name) || room.game.blockedCommands.has(text)) return;
    room.campaign.identify(userId, name);
    if(room.territory.s.status==="active"){
      if(["!human","!zombie"].includes(text)) {if(room.game.players.has(name))return;}
      else {room.territory.vote(userId,name,room.game.players.get(name),text);return;}
    }
    if (text === "!status") { const status = room.campaign.status(name); if (status) room.game.say(status); return; }
    if (text === "!rescue") { if (room.campaign.rescue(name, room.game)) room.game.say(`${name} recovered at the clinic`); return; }
    const character = room.campaign.data.characters[userId];
    if (text === "!human" && character?.infected) {
      room.game.say(`${name} is infected: use !zombie or !rescue between battles (3 supplies).`); return;
    }
    if (room.game.chat(name, text) && ["!human", "!zombie", "!join"].includes(text))
      room.campaign.join(userId, name, room.game.players.get(name));
  };
  let eventQueue = Promise.resolve();
  room.enqueue = fn => {const run=eventQueue.catch(()=>{}).then(fn);eventQueue=run;return run;};
  room.campaignEvent = (type, event, receipt) => {
    const run = eventQueue.catch(() => {}).then(async () => {
      const changed = room.campaign.event(type, event, receipt);
      const territoryChanged = room.territory.event(type,event,receipt,room.game.players);
      if (!changed && !territoryChanged && !room.campaign.data.receipts[receipt]) return;
      if (!simulated) {
        persisted[id].campaign = room.campaign.data;
        await save(id);
      }
    });
    eventQueue = run; return run;
  };
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
        await room.campaignEvent(body.subscription.type, body.event || {}, id);
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
app.use("/api/environments", express.json({ limit: "750kb" }));
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
app.get("/health", (_, res) => res.json({ ok: true, version: JSON.parse(readFileSync(path.join(root,"package.json"),"utf8")).version }));
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
  for (let i = 0; i < 12; i++) room.chat("demo-human-" + i, "sim_red_" + i, "!human");
  for (let i = 0; i < 6; i++) room.chat("demo-zombie-" + i, "sim_blue_" + i, "!zombie");
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
    environments: environmentList(req.room),
    nextEnvironment: req.room.nextEnvironment,
    state: req.room.game.snapshot(),
  }),
);
app.post("/api/control", owner, async (req, res) => {
  if (!req.session.csrf || req.get("x-csrf-token") !== req.session.csrf)
    return res.sendStatus(403);
  const g = req.room.game;
  const action = req.body.action;
  if (action === "return-twitch") {
    try {
      await req.room.enqueue(async () => {
        const previous = {status:g.territory.s.status, revision:g.territory.s.revision, votes:new Map(g.territory.votes)};
        try {
        if (g.territory.s.status === "active") {
          g.territory.s.status = "suspended";
          g.territory.s.revision++;
          g.territory.votes.clear();
        }
        if (g.tabletop.enabled) {
          g.status = "lobby";
          g.tabletop.configure(false);
          g.votes.clear();
          g.active.clear();
        }
        if (!g.simulated) { persisted[req.room.id].campaign = req.room.campaign.data; await save(req.room.id); }
        } catch (error) {
          g.territory.s.status=previous.status;g.territory.s.revision=previous.revision;g.territory.votes=previous.votes;
          throw error;
        }
      });
      broadcast(req.room); return res.json(g.snapshot());
    } catch { return res.status(500).json({error:"Could not save the mode change. Please retry."}); }
  }
  if(g.territory.s.status==="active")return res.status(409).json({error:"Finish the territory expedition before using classic battle controls."});
  if ((action === "start" || action === "next") && req.room.environmentSaving) return res.status(409).json({error:"Wait for the environment to finish saving."});
  if (action === "start" || action === "next") {
    if (!["running", "paused"].includes(g.status)) {
      if(g.tabletop.enabled && !["red","blue"].every(team=>[...g.players].some(([name,t])=>{
        const c=req.room.campaign.data.characters[req.room.campaign.names.get(name)];return (c?.infected?"blue":t)===team;
      }))) return res.status(400).json({error:"Seat at least one eligible Human and one Zombie before starting."});
      g.environment = environmentList(req.room).find(e => e.id === req.room.nextEnvironment) || environmentList(req.room)[0];
      g.start();
      if(g.tabletop.enabled) g.tabletop.start();
    }
  }
  else if (action === "pause") g.pause();
  else if (action === "kill") g.kill();
  else if (["supply", "fog", "freeze"].includes(action)) g.battlefield(action);
  else if (action === "demo-convoy" && g.simulated) {
    req.room.campaign.event("channel.raid", {}, randomBytes(12).toString("hex"));
  }
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
app.post("/api/environments", owner, async (req, res) => {
  if (!req.session.csrf || req.get("x-csrf-token") !== req.session.csrf) return res.sendStatus(403);
  const room = req.room;
  if (room.environmentSaving) return res.status(409).json({error:"Wait for the current environment save."});
  room.environmentSaving = true;
  const previous = room.nextEnvironment;
  let added;
  try {
    if (req.body.action === "upload") {
      if (room.environmentAssets.length >= 8) return res.status(400).json({error:"Library limit: 8 uploaded environments."});
      added = parseEnvironmentUpload(req.body);
      room.environmentAssets.push(added);
      room.nextEnvironment = added.id;
    } else if (req.body.action === "select" && environmentList(room).some(e => e.id === req.body.id)) {
      room.nextEnvironment = req.body.id;
    } else return res.status(400).json({error:"Choose an environment from the library."});
    if (!room.game.simulated) {
      persisted[room.id].environments = room.environmentAssets;
      persisted[room.id].nextEnvironment = room.nextEnvironment;
      await save(room.id);
    }
    res.json({nextEnvironment:room.nextEnvironment});
  } catch (error) {
    room.nextEnvironment = previous;
    if (added) room.environmentAssets.splice(room.environmentAssets.indexOf(added), 1);
    if (!room.game.simulated) {
      persisted[room.id].environments = room.environmentAssets;
      persisted[room.id].nextEnvironment = previous;
    }
    res.status(400).json({error:added ? "Could not save artwork. Please retry." : error.message});
  } finally { room.environmentSaving = false; }
});
app.get("/environment/:key/:id", (req, res) => {
  const room = [...rooms.values()].find(r => r.overlay === req.params.key);
  const asset = room?.environmentAssets.find(a => a.id === req.params.id);
  if (!asset) return res.sendStatus(404);
  res.set("Cache-Control", "private, max-age=86400").type("image/jpeg").send(Buffer.from(asset.image.split(",")[1], "base64"));
});
app.post(["/tabletop/new","/territory/new"], (req,res) => {
  if(!req.session.csrf || req.body.csrf!==req.session.csrf) return res.sendStatus(403);
  if(rooms.size>1000)return res.sendStatus(503);
  const local=!production && ["127.0.0.1","::1","::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
  const id=local ? "local-tabletop" : "demo-"+randomBytes(12).toString("hex");
  const room=rooms.get(id)||makeRoom(id,"table-host",!local);
  if(!local)room.expires=Date.now()+12*3600000;
  if(!["running","paused"].includes(room.game.status))room.game.tabletop.configure(req.path!=="/territory/new");
  room.nextEnvironment="forest";
  req.session.owner=id;req.session.csrf=randomBytes(24).toString("hex");
  res.redirect(303,req.path==="/territory/new"?"/territory":"/tabletop");
});
app.get("/api/tabletop", owner, (req,res)=>res.json({csrf:req.session.csrf,state:req.room.game.snapshot(),overlay:`${base}/overlay/${req.room.overlay}`,persistent:!req.room.game.simulated,characters:Object.entries(req.room.campaign.data.characters).map(([id,c])=>({...c,local:id.startsWith("table:"),joined:req.room.game.players.has(c.name)}))}));
app.post("/api/tabletop", owner, (req,res)=>{
  if(!req.session.csrf||req.get("x-csrf-token")!==req.session.csrf)return res.sendStatus(403);
  const room=req.room,g=room.game,table=g.tabletop,b=req.body;
  try{
    if(room.territory.s.status==="active")throw Error("Use territory controls until this expedition finishes.");
    if(b.action==="configure")table.configure(b.enabled===true,b.scenario);
    else if(b.action==="join"){
      if(["running","paused"].includes(g.status))throw Error("Seat physical players between battles.");
      if(!/^[a-z0-9_]{1,18}$/.test(b.name)||!["red","blue"].includes(b.team))throw Error("Use a name with 1-18 lowercase letters, numbers or underscores.");
      const name="table_"+b.name;
      if(b.team==="red"&&room.campaign.data.characters["table:"+name]?.infected)throw Error("This character is infected. Join Zombies or recover at the clinic.");
      if(Object.keys(room.campaign.data.characters).filter(id=>id.startsWith("table:")).length>=12&&!room.campaign.data.characters["table:"+name])throw Error("Maximum 12 physical characters.");
      room.chat("table:"+name,name,b.team==="red"?"!human":"!zombie");
    }
    else if(b.action==="reveal"){
      if(!table.enabled||g.status!=="running"||b.turn!==table.turn)throw Error("Round changed or is not running. Refresh first.");
      if(!Array.isArray(b.votes)||b.votes.length>12||b.votes.some(v=>!room.campaign.data.characters["table:"+v.name]||!g.players.has(v.name)||!["attack","defend","heal","surge"].includes(v.action)))throw Error("Invalid physical vote.");
      if(new Set(b.votes.map(v=>v.name)).size!==b.votes.length)throw Error("One card per physical player.");
      if(b.boss && (table.scenario!=="mech"||!["missile","brace"].includes(b.boss)||(b.boss==="missile"?table.missiles:table.braces)<1))throw Error("Boss ability unavailable.");
      for(const v of b.votes)g.chat(v.name,"!"+v.action);
      table.boss=b.boss||"";table.reveal(b.turn);
    }
    else if(b.action==="event")table.event();
    else if(b.action==="craft")table.craft(b.team);
    else if(b.action==="rescue"){
      if(!room.campaign.rescue(b.name,g))throw Error("Recovery needs an infected character, 3 supplies, and a battle break.");
      g.chat(b.name,"!human");const c=room.campaign.data.characters[room.campaign.names.get(b.name)];if(c)c.faction="red";room.campaign.changed();
    }
    else if(b.action==="emergency")table.emergency(b.name);
    else throw Error("Unknown tabletop action.");
    broadcast(room);res.json(g.snapshot());
  }catch(error){res.status(400).json({error:error.message});}
});
const territoryPayload=room=>({state:room.territory.snapshot(),campaign:room.campaign.snapshot(),overlay:`${base}/territory/${room.overlay}`,bridge:`${base}/api/living-table/${room.overlay}`});
app.get("/api/territory",owner,(req,res)=>res.json({...territoryPayload(req.room),csrf:req.session.csrf,persistent:!req.room.game.simulated,observation:req.room.observation}));
app.get("/api/territory/view/:key",(req,res)=>{const room=[...rooms.values()].find(r=>r.overlay===req.params.key);if(!room)return res.sendStatus(404);res.json(territoryPayload(room));});
app.post("/api/territory",owner,async(req,res)=>{
 if(!req.session.csrf||req.get("x-csrf-token")!==req.session.csrf)return res.sendStatus(403);
 const room=req.room;
 try{await room.enqueue(async()=>{
  if(["running","paused"].includes(room.game.status))throw Error("Finish the classic battle before starting territory play.");
  const before=structuredClone(room.campaign.data),votes=new Map(room.territory.votes);
  try{
   if(req.body.action==="resolve-vote")room.territory.resolve(req.body.revision,req.body.requestId);
   else room.territory.execute(req.body);
   if(!room.game.simulated){persisted[room.id].campaign=room.campaign.data;await save(room.id);}
   room.observation=null;broadcast(room);
  }catch(error){room.campaign.data=before;room.territory.votes=votes;if(!room.game.simulated)persisted[room.id].campaign=before;throw error;}
 });res.json(territoryPayload(room));}catch(error){res.status(400).json({error:error.message});}
});
app.post("/api/territory/bridge-key",owner,async(req,res)=>{
 if(!req.session.csrf||req.get("x-csrf-token")!==req.session.csrf)return res.sendStatus(403);
 const key=randomBytes(32).toString("hex"),hash=createHash("sha256").update(key).digest("hex"),room=req.room,old=room.bridgeHash;
 try{room.bridgeHash=hash;if(!room.game.simulated){persisted[room.id].bridgeHash=hash;await save(room.id);}res.json({key,observeUrl:`${base}/api/living-table/observe`});}
 catch{room.bridgeHash=old;if(!room.game.simulated)persisted[room.id].bridgeHash=old;res.status(503).json({error:"Could not save pairing. Retry."});}
});
app.get("/api/living-table/:key",(req,res)=>{
 const room=[...rooms.values()].find(r=>r.overlay===req.params.key);if(!room)return res.sendStatus(404);
 res.json({protocol:"c2g.territory.v1",revision:room.territory.s.revision,definition:room.territory.definition(),figures:Object.values(room.territory.s.pieces),state:room.territory.snapshot()});
});
app.post("/api/living-table/observe",(req,res)=>{
 const token=(req.get("authorization")||"").replace(/^Bearer /,"");if(!/^[a-f0-9]{64}$/.test(token))return res.sendStatus(401);
 const hash=createHash("sha256").update(token).digest("hex"),room=[...rooms.values()].find(r=>r.bridgeHash===hash);if(!room)return res.sendStatus(401);
 const {pieceId,target,revision}=req.body,piece=Object.values(room.territory.s.pieces).find(p=>p.toyId===pieceId||p.tag===pieceId);
 if(!piece||revision!==room.territory.s.revision||!room.territory.snapshot().map.some(t=>t.id===target))return res.status(409).json({error:"Unknown piece/territory or stale observation."});
 if(piece.location===target)return res.json({status:"already-synchronized"});
 room.observation={pieceId:piece.id,target,revision,receivedAt:Date.now()};res.status(202).json({status:"awaiting-host-confirmation"});
});
app.get(["/territory","/territory/:key"],(_,res)=>res.sendFile(path.join(root,"public/territory.html")));
app.get("/tabletop", (_,res)=>res.sendFile(path.join(root,"public/tabletop.html")));
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
      readFileSync(path.join(root, "public/index.html"), "utf8").replaceAll(
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
      g.simulated && !g.tabletop.enabled && g.territory.s.status!=="active" &&
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
