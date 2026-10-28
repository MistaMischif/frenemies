import { createHmac, timingSafeEqual } from "node:crypto";
export function verifyViewerJWT(token, secret, now = Date.now()) {
  if (typeof token !== "string" || token.length > 8192 || !secret)
    throw new Error("Identify through Twitch to continue.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid identity.");
  const [head, payload, signature] = parts;
  const h = JSON.parse(Buffer.from(head, "base64url"));
  if (h.alg !== "HS256") throw new Error("Invalid identity.");
  const expected = createHmac("sha256", Buffer.from(secret, "base64"))
    .update(head + "." + payload)
    .digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("Invalid identity.");
  const p = JSON.parse(Buffer.from(payload, "base64url"));
  if (
    !Number.isFinite(p.exp) ||
    p.exp * 1000 <= now ||
    !/^\d+$/.test(p.channel_id) ||
    !/^\d+$/.test(p.user_id) ||
    !["viewer", "moderator", "broadcaster"].includes(p.role)
  )
    throw new Error("Share your Twitch identity to use Barrage.");
  return p;
}
export function validTransaction(t, config) {
  return !!(
    t &&
    /^[\w-]{1,128}$/.test(t.id) &&
    /^\d+$/.test(t.user_id) &&
    /^\d+$/.test(t.broadcaster_id) &&
    t.product_type === "BITS_IN_EXTENSION" &&
    t.product_data?.domain === "twitch.ext." + config.id &&
    t.product_data?.sku === config.sku &&
    t.product_data?.cost?.type === "bits" &&
    t.product_data?.cost?.amount === config.price &&
    t.product_data?.inDevelopment === false
  );
}
export function createExtension({
  ledger,
  runner,
  rooms,
  env = process.env,
  fetcher = fetch,
}) {
  const config = {
    id: env.EXTENSION_CLIENT_ID,
    secret: env.EXTENSION_CLIENT_SECRET,
    shared: env.EXTENSION_SHARED_SECRET,
    sku: "barrage_v1",
    price: 100,
  };
  const enabled =
    env.EXTENSION_ENABLED === "true" &&
    !!(config.id && config.secret && config.shared);
  let access,
    expires = 0,
    syncing = false,
    status = enabled ? "Connecting" : "Not configured — free chat is available";
  async function api(query) {
    if (Date.now() > expires) {
      const r = await fetcher("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        body: new URLSearchParams({
          client_id: config.id,
          client_secret: config.secret,
          grant_type: "client_credentials",
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error("Twitch connection unavailable.");
      const d = await r.json();
      access = d.access_token;
      expires = Date.now() + Math.max(0, d.expires_in - 60) * 1000;
    }
    const r = await fetcher(
      "https://api.twitch.tv/helix/extensions/transactions?" +
        new URLSearchParams({ extension_id: config.id, ...query }),
      {
        headers: { "Client-Id": config.id, Authorization: "Bearer " + access },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (r.status === 401) expires = 0;
    if (!r.ok) throw new Error("Twitch transaction verification unavailable.");
    return r.json();
  }
  async function grant(t) {
    if (validTransaction(t, config))
      return ledger.grant(config.id + ":" + t.id, t.broadcaster_id, t.user_id);
    return false;
  }
  async function reconcile() {
    if (!enabled || syncing) return;
    syncing = true;
    try {
      let after;
      // Paginate the authoritative history, not client-provided receipts or amounts.
      for (let page = 0; page < 100; page++) {
        const d = await api({ first: "100", ...(after ? { after } : {}) });
        for (const t of d.data) await grant(t);
        after = d.pagination?.cursor;
        if (!after) {
          status = "Connected";
          return;
        }
      }
      status = "Reconciliation limit reached — operator review required";
    } catch {
      status = "Twitch verification unavailable; retrying";
    } finally {
      syncing = false;
    }
  }
  const limits = new Map();
  function mount(app) {
    app.use("/api/extension", (req, res, next) => {
      const origin = req.get("origin");
      if (origin === `https://${config.id}.ext-twitch.tv`) {
        res
          .set("Access-Control-Allow-Origin", origin)
          .set("Vary", "Origin")
          .set("Access-Control-Allow-Headers", "Authorization, Content-Type")
          .set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      }
      if (req.method === "OPTIONS") return res.sendStatus(204);
      res.set("Cache-Control", "no-store");
      if (!enabled)
        return res
          .status(503)
          .json({
            error: "Barrage is not enabled yet. Free chat play is available.",
          });
      try {
        req.viewer = verifyViewerJWT(
          req.get("authorization")?.replace(/^Bearer /, ""),
          config.shared,
        );
      } catch {
        return res
          .status(401)
          .json({ error: "Share your Twitch identity to use Barrage." });
      }
      const key = req.viewer.channel_id + ":" + req.viewer.user_id,
        now = Date.now();
      for (const [k, v] of limits) if (v.until < now) limits.delete(k);
      const limit = limits.get(key) || { until: now + 60000, n: 0 };
      limit.n++;
      limits.set(key, limit);
      if (limit.n > 80)
        return res.status(429).json({ error: "Please wait a moment." });
      next();
    });
    app.get("/api/extension/status", async (req, res, next) => {
      try {
        const { channel_id: c, user_id: u } = req.viewer,
          room = rooms.get(c),
          name = room?.userNames?.get(u),
          g = room?.game;
        res.json({
          shots: await ledger.balance(c, u),
          sku: config.sku,
          price: config.price,
          team: g?.players.get(name) || null,
          status: g?.status || "offline",
          canActivate: !!(
            name &&
            g.canBarrage(name) &&
            !runner.active.has(c + ":" + g.players.get(name)) &&
            !runner.error
          ),
          cooldown: name
            ? Math.max(
                0,
                Math.ceil(
                  ((g.barrageReady[g.players.get(name)] || 0) - g.elapsed) /
                    1000,
                ),
              )
            : 0,
          message: runner.error || status,
        });
      } catch (e) {
        next(e);
      }
    });
    app.post("/api/extension/transaction", async (req, res, next) => {
      try {
        const id = req.body.id;
        if (typeof id !== "string" || !/^[\w-]{1,128}$/.test(id))
          return res.sendStatus(400);
        const d = await api({ id });
        const t = d.data.find(
          (t) =>
            t.id === id &&
            t.user_id === req.viewer.user_id &&
            t.broadcaster_id === req.viewer.channel_id,
        );
        if (!validTransaction(t, config))
          return res
            .status(409)
            .json({ error: "Transaction is not a live Barrage activation." });
        await grant(t);
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    });
    app.post("/api/extension/activate", async (req, res, next) => {
      try {
        const room = rooms.get(req.viewer.channel_id),
          name = room?.userNames?.get(req.viewer.user_id);
        const ok =
          room &&
          name &&
          (await runner.activate(room, req.viewer.user_id, name));
        res
          .status(ok ? 200 : 409)
          .json({
            ok: !!ok,
            error: ok
              ? undefined
              : "Join a team in chat; wait for a running battle and the team cooldown.",
          });
      } catch (e) {
        next(e);
      }
    });
  }
  return { mount, reconcile, enabled, status: () => status };
}
