import { War, WAR_KEY } from "./war.js";
export function installWar({
  app,
  owner,
  rooms,
  persisted,
  save,
  root,
  environmentList,
}) {
  const live = new War(persisted[WAR_KEY]);
  let persistence = "saved";
  const demo = new War(null, { simulated: true });
  const select = (r) => (r.game.simulated ? demo : live);
  async function flush(w) {
    if (w.simulated || !w.dirty) return;
    persistence = "saving";
    persisted[WAR_KEY] = w.s;
    w.dirty = false;
    try {
      await save(WAR_KEY);
      persistence = "saved";
    } catch (e) {
      w.dirty = true;
      persistence = "SAVE FAILED  -  in-memory changes pending retry";
      throw Error(
        "Change applied in memory; saving will retry. Do not repeat the action.",
      );
    }
  }
  const active = (r) =>
    !!select(r).s.communities[r.id] &&
    select(r).s.communities[r.id].active !== false;
  const decorate = (r) => ({
    ...select(r).snapshot(),
    persistence: r.game.simulated
      ? "simulated  -  not persisted"
      : select(r).dirty
        ? "pending save"
        : persistence,
    channel: r.id,
    channelName: r.login,
    creator: r.game.snapshot().creator,
    roster: Object.values(r.economy.roster(r.game, r.overlay)).flat(),
    environment: environmentList(r).find((e) => e.id === r.nextEnvironment),
    enlisted: active(r),
    cleared: r.game.cleared,
    demoSquad: !!r.simWarSquad,
  });
  app.get("/war", (_, res) => res.sendFile(root + "/public/war.html"));
  app.get("/war/:key", (req, res) =>
    [...rooms.values()].some((r) => r.overlay === req.params.key)
      ? res.sendFile(root + "/public/war.html")
      : res.sendStatus(404),
  );
  app.get("/api/war", owner, (req, res) =>
    res.json({
      ...decorate(req.room),
      csrf: req.session.csrf,
      overlay: "/war/" + req.room.overlay,
    }),
  );
  app.get("/api/war/view/:key", (req, res) => {
    const r = [...rooms.values()].find((r) => r.overlay === req.params.key);
    if (!r) return res.sendStatus(404);
    res.json(decorate(r));
  });
  app.get("/api/war/evidence", owner, (req, res) => {
    const w = select(req.room);
    res.attachment("frenemies-war-evidence.json").json({
      generatedAt: new Date().toISOString(),
      metrics: w.report(),
      world: w.snapshot(),
      events: w.s.events,
    });
  });
  app.post("/api/war", owner, async (req, res) => {
    if (!req.session.csrf || req.get("x-csrf-token") !== req.session.csrf)
      return res.sendStatus(403);
    const r = req.room,
      w = select(r);
    try {
      if (req.body.action === "demo-start" && w.simulated) {
        w.enlist(r.id, r.login + "-" + r.id.slice(-4));
        r.game.cleared = false;
        r.show.auto = false;
        if (r.game.status === "running") r.game.status = "paused";
        if (w.s.operation?.status !== "active") w.command(r.id, "launch");
        r.simWarSquad = true;
        r.simWarAutoRoute = true;
      } else if (req.body.action === "demo-squad" && w.simulated) {
        r.simWarSquad = !r.simWarSquad;
      } else if (req.body.action === "join") {
        w.enlist(
          r.id,
          r.game.simulated ? r.login + "-" + r.id.slice(-4) : r.login,
        );
        r.game.cleared = false;
        r.show.auto = false;
        r.show.nextAt = null;
        if (r.game.status === "running") r.game.status = "paused";
      } else if (req.body.action === "hide" || req.body.action === "show") {
        r.game.cleared = req.body.action === "hide";
      } else if (req.body.action === "leave") {
        if (w.s.communities[r.id]) w.s.communities[r.id].active = false;
        w.dirty = true;
      } else if (req.body.action === "demo-action" && w.simulated) {
        if (!/^[a-zA-Z0-9_]{1,25}$/.test(String(req.body.name)))
          throw Error("Use a Twitch-style account name.");
        if (
          !w.act(
            r.id,
            "demo-war-" + String(req.body.name).slice(0, 25),
            String(req.body.name).slice(0, 25),
            String(req.body.message),
          )
        )
          throw Error(
            "Action not accepted: dispatch convoy, choose a valid role, and allow 6 seconds per account.",
          );
      } else w.command(r.id, req.body.action);
      await flush(w);
      res.json(decorate(r));
    } catch (e) {
      res.status(409).json({ error: e.message });
    }
  });
  setInterval(() => {
    for (const r of rooms.values())
      if (r.game.simulated && r.simWarSquad && active(r)) {
        ["scout", "escort", "escort", "fortify", "fortify", "assault"].forEach(
          (role, i) =>
            demo.act(
              r.id,
              "squad-" + r.id + "-" + i,
              "sim_squad_" + i,
              "!" + role,
            ),
        );
      }
    const commander = rooms.get(demo.s.operation?.commander);
    if (commander?.simWarAutoRoute && commander.simWarSquad &&
        demo.s.operation?.status === "active" && !demo.s.operation.route &&
        demo.s.operation.intel >= 3) {
      demo.command(commander.id, "detour");
    }
    for (const w of [live, demo]) {
      w.tick();
      flush(w).catch(() => {});
    }
  }, 1000).unref();
  return {
    active,
    flush: () => flush(live),
    chat: (r, id, name, text) => {
      if (!select(r).act(r.id, id, name, text)) return false;
      r.campaign.identify(id, name);
      r.game.chat(name, "!join");
      r.game.spotlights.set(name, Date.now());
      return true;
    },
  };
}
