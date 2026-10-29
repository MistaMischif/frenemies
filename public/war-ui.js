import { BattleReactions } from "/war-reactions.js";
const reactions = new BattleReactions();
const $ = (id) => document.getElementById(id),
  key = location.pathname.split("/")[2];
document.body.classList.toggle("overlay", !!key);
if (key) $("commands").hidden = true;
let state,
  csrf,
  busy = false,
  position = 0;
const images = new Map(),
  image = (url) => {
    if (!images.has(url)) {
      const im = new Image();
      im.src = url;
      images.set(url, im);
    }
    return images.get(url);
  };
const list = (id, items, cls) => {
  $(id).replaceChildren(
    ...items.map((text) => {
      const n = document.createElement(id === "chronicle" ? "li" : "div");
      n.className = cls || "";
      n.textContent = text;
      return n;
    }),
  );
};
async function load() {
  try {
    const r = await fetch(
      key ? "/api/war/view/" + encodeURIComponent(key) : "/api/war",
      { cache: "no-store" },
    );
    if (!r.ok) throw Error("Sign in or start a demo from /control.");
    state = await r.json();
    reactions.accept(state, performance.now());
    csrf = state.csrf || csrf;
    render();
    $("connection").textContent = "CONNECTED  -  " + state.persistence;
  } catch (e) {
    $("connection").textContent = e.message;
  }
}
function render() {
  const s = state,
    o = s.operation;
  document.body.classList.toggle("cleared", !!s.cleared);
  const director = o?.director;
  $("host-caption").textContent =
    o?.status === "active"
      ? director?.cue || ""
      : o?.status === "delivered"
        ? "The settlement lights up. Your convoy made it home."
        : o?.status === "lost"
          ? "The convoy is lost. This crossing will remember the stand."
          : "";
  $("host-choice").hidden = !director?.choice;
  document.body.dataset.pacing = director?.phase || "build";
  $("mode").textContent = s.simulated
    ? "SIMULATED WAR · NO LIVE RESULTS"
    : "PERSISTENT SHARED WAR";
  $("title").textContent = s.creator?.title || "The shared front";
  $("integrity").textContent = Math.round(s.integrity);
  $("supplies").textContent = s.supplies;
  $("deliveries").textContent = s.deliveries;
  $("operation").textContent = o
    ? `CONVOY ${o.id} / ${o.status.toUpperCase()}`
    : "AWAITING DISPATCH";
  $("route").textContent = o?.route
    ? o.route.toUpperCase() + " ROUTE"
    : `ROUTE INTEL ${Math.min(3, Math.round(o?.intel || 0))}/3`;
  $("hull").value = o?.hull || 0;
  $("crossing").value = s.crossing;
  $("pressure").value = o?.pressure || 0;
  $("stakes").textContent =
    o?.status === "active"
      ? o.route
        ? `Destination ${Math.round(o.progress)}% · Delivery restores 30 reserves and 10 integrity`
        : "Scout first. The dispatching commander must commit to a route."
      : s.events[0]?.text || "Every community contributes to the same world.";
  $("command-help").textContent = s.enlisted
    ? "Your chat is connected to this shared front. Dispatching commander: " +
      (s.communities[o?.commander]?.name || "none")
    : "Join to direct your viewers’ commands into the shared war. Channel battles pause.";
  $("overlay").textContent = location.origin + (s.overlay || "/war/" + key);
  $("overlay").href = s.overlay || "#";
  $("demo").hidden = !s.simulated;
  $("squad").textContent = s.demoSquad
    ? "Stop simulated squad"
    : "Run simulated squad";
  $("squad").disabled = !s.enlisted;
  for (const b of document.querySelectorAll("[data-action]")) {
    const a = b.dataset.action;
    b.disabled =
      busy ||
      (["director-on", "director-off", "rescue", "press-on"].includes(a) &&
        (o?.status !== "active" || o.commander !== s.channel)) ||
      (["rescue", "press-on"].includes(a) && !o?.director?.choice) ||
      (a === "rescue" && s.supplies < 10) ||
      (a === "join" ? s.enlisted : a === "leave" ? !s.enlisted : !s.enlisted) ||
      (a === "launch" && o?.status === "active") ||
      (["direct", "detour"].includes(a) &&
        (o?.status !== "active" ||
          !!o?.route ||
          o.intel < 3 ||
          o.commander !== s.channel)) ||
      (["reserves", "evacuate"].includes(a) && o?.status !== "active") ||
      (a === "reserves" && (s.supplies < 15 || o?.choices[s.channel])) ||
      (a === "evacuate" && o?.commander !== s.channel);
  }
  list(
    "communities",
    Object.entries(s.communities).map(
      ([id, c]) =>
        `${c.name}${c.active === false ? " · away" : ""} · ${o?.contributions[id] || 0} resolved contributions · ${c.decisions} decisions`,
    ),
    "community",
  );
  list(
    "actions",
    s.recentActions.map(
      (e) => `${s.communities[e.channel]?.name || "Community"} / ${e.text}`,
    ),
    "contribution",
  );
  list(
    "chronicle",
    s.events
      .filter((e) => e.kind !== "resolution")
      .slice(0, 7)
      .map((e) => e.text),
  );
  const m = s.metrics;
  $("metrics").textContent =
    `${m.uniqueAccounts} participating accounts · ${m.returningOnAnotherDay} returned on another UTC day · ${m.crossCommunityAccounts} played across communities · ${m.decisions} commander decisions · ${m.deliveries} deliveries / ${m.losses} losses`;
  $("limits").textContent = m.limitations;
}
async function send(action, extra = {}) {
  if (busy) return;
  busy = true;
  if (state) render();
  try {
    const r = await fetch("/api/war", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ action, ...extra }),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    $("feedback").textContent = "Accepted · " + action;
    await load();
  } catch (e) {
    $("feedback").textContent = e.message;
  } finally {
    busy = false;
    if (state) render();
  }
}
document
  .querySelectorAll("[data-action]")
  .forEach((b) => (b.onclick = () => send(b.dataset.action)));
for (const role of ["scout", "escort", "fortify", "assault"]) {
  const b = document.createElement("button");
  b.textContent = "!" + role;
  b.onclick = () =>
    send("demo-action", { name: $("name").value, message: "!" + role });
  $("demo-buttons").append(b);
}
const canvas = $("scene"),
  ctx = canvas.getContext("2d"),
  reduced = matchMedia("(prefers-reduced-motion: reduce)");
function draw(t) {
  const w = 1440,
    h = 560,
    s = state,
    o = s?.operation;
  ctx.clearRect(0, 0, w, h);
  let bg = false;
  if (s?.environment?.url && !window.FrenemiesScenes.has(s.environment.id)) {
    const im = image(s.environment.url);
    if (im.complete && im.naturalWidth) {
      ctx.drawImage(im, 0, 0, w, h);
      bg = true;
    }
  }
  if (!bg)
    window.FrenemiesScenes.background(
      ctx,
      w,
      h,
      s?.environment?.id === "ruins" ? "ruins" : "forest",
    );
  // One readable side-on lane; route and progress share the same world coordinates.
  ctx.fillStyle = "#172b2f";
  ctx.beginPath();
  ctx.moveTo(935, 280);
  ctx.bezierCurveTo(860, 340, 1020, 400, 940, 560);
  ctx.lineTo(1040, 560);
  ctx.bezierCurveTo(1120, 400, 950, 340, 985, 280);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#6e999566";
  ctx.lineWidth = 3;
  for (let r = 0; r < 5; r++) {
    ctx.beginPath();
    ctx.moveTo(935 + r * 8, 450 + r * 12);
    ctx.lineTo(970 + r * 8, 450 + r * 12);
    ctx.stroke();
  }
  ctx.fillStyle = "#a3a487";
  for (let i = 0; i < 12; i++) ctx.fillRect(885 + i * 11, 405, 9, 12);
  ctx.strokeStyle = "#b9c29c";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(880, 390);
  ctx.lineTo(1020, 390);
  ctx.stroke();
  const target = 150 + (o?.progress || 0) * 10;
  position = reduced.matches ? target : position + (target - position) * 0.035;
  const x = position || 150,
    y = 400;
  ctx.fillStyle = "#13202077";
  ctx.beginPath();
  ctx.ellipse(x, y + 37, 73, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b9c99c";
  ctx.fillRect(x - 50, y - 30, 90, 46);
  ctx.fillStyle = "#6d8678";
  ctx.fillRect(x + 35, y - 18, 30, 34);
  ctx.fillStyle = "#253c44";
  ctx.fillRect(x + 42, y - 13, 16, 14);
  ctx.fillStyle = "#ebd895";
  ctx.fillRect(x - 20, y - 16, 25, 5);
  ctx.fillRect(x - 10, y - 26, 5, 25);
  for (const dx of [-30, 43]) {
    ctx.fillStyle = "#142329";
    ctx.beginPath();
    ctx.arc(x + dx, y + 20, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#778a82";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const roster = s?.roster || [];
  const fallback = [
    "/characters/char01V01.png",
    "/characters/char02V01.png",
    "/characters/char03V01.png",
  ];
  for (
    let i = 0;
    i < Math.min(9, 2 + Math.ceil(Math.sqrt(s?.visualRoles?.escort || 0)));
    i++
  ) {
    const im = image(roster[i]?.asset || fallback[i]);
    if (!im.complete || !im.naturalWidth) continue;
    const height = 100,
      width = (height * im.naturalWidth) / im.naturalHeight,
      px = Math.max(45, x - 105 - i * 28),
      bob = reduced.matches ? 0 : Math.sin(t / 230 + i) * 2;
    ctx.drawImage(im, px - width / 2, y - height + 25 + bob, width, height);
  }
  ctx.font = "bold 16px Segoe UI";
  ctx.fillStyle = "#edf1da";
  ctx.fillText("SHARED CROSSING", 870, 355);
  ctx.fillText("SETTLEMENT", 1180, 295);
  const house = image("/environments/c2g/Map_zone1_house01.png");
  if (house.complete && house.naturalWidth)
    ctx.drawImage(house, 1160, 270, 180, 155);
  if (o?.route && o.status === "active" && o.pressure > 10) {
    ctx.strokeStyle = "#ed9c6a";
    ctx.lineWidth = 2;
    const pulse = reduced.matches ? 0.5 : (t % 1800) / 1800;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(1340, 360);
    ctx.lineTo(1340 - (1340 - x) * pulse, 360 + 60 * pulse);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Readable consequences for viewers who never issue commands.
  if (o?.director?.rescued) {
    ctx.fillStyle = "#dbedaa";
    ctx.font = "bold 18px Segoe UI";
    ctx.fillText("CREW RESCUED", 1080, 245);
  }
  if (o?.status === "delivered") {
    ctx.fillStyle = "#ffe4a3aa";
    ctx.beginPath();
    ctx.arc(1250, 345, 42, 0, Math.PI * 2);
    ctx.fill();
  }
  if (o?.status === "active" && o.hull < 40) {
    ctx.fillStyle = "#26323599";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x + 15, y - 40 - i * 15, 10 + i * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  reactions.draw(ctx, s, t, x, reduced.matches);
  requestAnimationFrame(draw);
}
load();
setInterval(load, 2000);
requestAnimationFrame(draw);

$("squad").onclick = () => send("demo-squad");
