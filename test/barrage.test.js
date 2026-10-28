import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";
import { openBarrageLedger, BarrageRunner } from "../server/barrage.js";
import { verifyViewerJWT, validTransaction } from "../server/extension.js";
import { Game } from "../server/game.js";
async function setup(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "barrage-"));
  const ledger = await openBarrageLedger({ dataDir: dir });
  try {
    await fn(ledger, dir);
  } finally {
    await ledger.close();
    await rm(dir, { recursive: true, force: true });
  }
}
const room = () => {
  const game = new Game({ host: "host" });
  game.chat("r", "!human");
  game.chat("b", "!zombie");
  game.start();
  return { id: "123", game };
};
test("durable transaction grants are idempotent and channel/user isolated; pending shot recovered", () =>
  setup(async (l, dir) => {
    assert.deepEqual(
      await Promise.all([
        l.grant("tx", "123", "10"),
        l.grant("tx", "123", "10"),
      ]),
      [true, false],
    );
    assert.equal(await l.balance("123", "10"), 3);
    assert.equal(await l.balance("124", "10"), 0);
    assert.equal(await l.balance("123", "11"), 0);
    const token = await l.reserve("123", "10");
    assert.ok(token);
    assert.equal(await l.balance("123", "10"), 2);
    await l.close();
    const restarted = await openBarrageLedger({ dataDir: dir });
    assert.equal(await restarted.balance("123", "10"), 3);
    const t = await restarted.reserve("123", "10");
    await restarted.settle(t, true);
    await restarted.settle(t, true);
    assert.equal(await restarted.balance("123", "10"), 2);
    assert.equal(await restarted.grant("tx", "123", "10"), false);
    await restarted.close();
  }));
test("Barrage sends three spaced shield-aware shots, does not consume surge, caps team activation", () =>
  setup(async (l) => {
    const r = room(),
      g = r.game,
      runner = new BarrageRunner(l);
    await l.grant("tx", "123", "10");
    g.teams.blue.shield = true;
    g.teams.red.power = true;
    assert.equal(await runner.activate(r, "10", "r"), true);
    assert.equal(await runner.activate(r, "10", "r"), false);
    await runner.pump();
    assert.equal(g.teams.blue.line, 100);
    g.advance(2000);
    await runner.pump();
    assert.equal(g.teams.blue.line, 98.5);
    await runner.pump();
    assert.equal(g.teams.blue.line, 98.5);
    g.pause();
    g.advance(20000);
    await runner.pump();
    assert.equal(await l.balance("123", "10"), 2);
    g.pause();
    g.battlefield("freeze");
    g.advance(2000);
    await runner.pump();
    assert.equal(g.teams.blue.line, 98.5);
    g.advance(8000);
    await runner.pump();
    g.advance(2000);
    await runner.pump();
    assert.equal(g.teams.blue.line, 92.5);
    assert.equal(g.teams.red.power, true);
    assert.equal(await l.balance("123", "10"), 0);
    assert.equal(g.effects.filter((e) => e.kind === "barrage").length, 3);
  }));
test("Barrage leaves unused shots banked after battle, host and blocked viewers cannot fire", () =>
  setup(async (l) => {
    const r = room(),
      g = r.game,
      runner = new BarrageRunner(l);
    await l.grant("tx", "123", "10");
    assert.equal(!!g.canBarrage("host"), false);
    g.blockedNames.add("r");
    assert.equal(await runner.activate(r, "10", "r"), false);
    g.blockedNames.delete("r");
    g.teams.blue.line = 2;
    await runner.activate(r, "10", "r");
    g.advance(2000);
    await runner.pump();
    await runner.pump();
    assert.equal(g.status, "finished");
    assert.equal(g.winner, "red");
    assert.equal(await l.balance("123", "10"), 2);
  }));
test("Barrage storage failures cannot fire free shots", () =>
  setup(async (l) => {
    const r = room(),
      runner = new BarrageRunner(l);
    await l.grant("tx", "123", "10");
    await runner.activate(r, "10", "r");
    r.game.advance(2000);
    l.reserve = async () => {
      throw new Error("offline");
    };
    await runner.pump();
    assert.equal(r.game.teams.blue.line, 100);
    assert.ok(runner.error);
  }));
test("Extension identity rejects tampering, expiry, anonymous and external roles", () => {
  const secret = Buffer.from("testing-secret-at-least-32-bytes-long").toString(
    "base64",
  );
  function jwt(p, alg = "HS256") {
    const h = Buffer.from(JSON.stringify({ alg })).toString("base64url"),
      b = Buffer.from(JSON.stringify(p)).toString("base64url");
    return (
      h +
      "." +
      b +
      "." +
      createHmac("sha256", Buffer.from(secret, "base64"))
        .update(h + "." + b)
        .digest("base64url")
    );
  }
  const p = {
    exp: Date.now() / 1000 + 60,
    channel_id: "123",
    user_id: "10",
    role: "viewer",
  };
  assert.equal(verifyViewerJWT(jwt(p), secret).user_id, "10");
  for (const token of [
    jwt({ ...p, exp: 1 }),
    jwt({ ...p, user_id: undefined }),
    jwt({ ...p, role: "external" }),
    jwt(p, "none"),
    jwt(p) + "x",
  ])
    assert.throws(() => verifyViewerJWT(token, secret));
});
test("Only the exact live Extension product and price are accepted", () => {
  const config = { id: "ext", sku: "barrage_v1", price: 100 };
  const t = {
    id: "tx-1",
    user_id: "10",
    broadcaster_id: "123",
    product_type: "BITS_IN_EXTENSION",
    product_data: {
      sku: "barrage_v1",
      domain: "twitch.ext.ext",
      cost: { type: "bits", amount: 100 },
      inDevelopment: false,
    },
  };
  assert.equal(validTransaction(t, config), true);
  for (const p of [
    { ...t.product_data, inDevelopment: true },
    { ...t.product_data, domain: "twitch.ext.other" },
    { ...t.product_data, sku: "unknown" },
    { ...t.product_data, cost: { type: "bits", amount: 1 } },
  ])
    assert.equal(validTransaction({ ...t, product_data: p }, config), false);
});

test("Extension HTTP rejects unauthenticated and cross-account transaction claims", () =>
  setup(async (ledger) => {
    const { default: express } = await import("express");
    const { createExtension } = await import("../server/extension.js");
    const secret = Buffer.from("unit-test-extension-shared-secret").toString(
      "base64",
    );
    const env = {
      EXTENSION_ENABLED: "true",
      EXTENSION_CLIENT_ID: "extension",
      EXTENSION_CLIENT_SECRET: "test-only",
      EXTENSION_SHARED_SECRET: secret,
    };
    const transaction = {
      id: "transaction-1",
      broadcaster_id: "123",
      user_id: "10",
      product_type: "BITS_IN_EXTENSION",
      product_data: {
        domain: "twitch.ext.extension",
        sku: "barrage_v1",
        cost: { type: "bits", amount: 100 },
        inDevelopment: false,
      },
    };
    const fetcher = async (url) => ({
      ok: true,
      status: 200,
      json: async () =>
        String(url).includes("oauth2")
          ? { access_token: "test-only", expires_in: 3600 }
          : { data: [transaction], pagination: {} },
    });
    const r = room();
    r.userNames = new Map([["10", "r"]]);
    const runner = new BarrageRunner(ledger);
    const app = express();
    app.use(express.json());
    createExtension({
      ledger,
      runner,
      rooms: new Map([["123", r]]),
      env,
      fetcher,
    }).mount(app);
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = "http://127.0.0.1:" + server.address().port + "/api/extension";
    function identity(user = "10", channel = "123") {
      const h = Buffer.from('{"alg":"HS256"}').toString("base64url"),
        p = Buffer.from(
          JSON.stringify({
            exp: Date.now() / 1000 + 60,
            user_id: user,
            channel_id: channel,
            role: "viewer",
          }),
        ).toString("base64url");
      return (
        h +
        "." +
        p +
        "." +
        createHmac("sha256", Buffer.from(secret, "base64"))
          .update(h + "." + p)
          .digest("base64url")
      );
    }
    const post = (path, body, user = "10", channel = "123") =>
      fetch(base + path, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + identity(user, channel),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    try {
      assert.equal((await fetch(base + "/status")).status, 401);
      assert.equal(
        (await post("/transaction", { id: "transaction-1" }, "11")).status,
        409,
      );
      assert.equal(
        (await post("/transaction", { id: "transaction-1" }, "10", "999"))
          .status,
        409,
      );
      assert.equal(
        (await post("/transaction", { id: "transaction-1", amount: 999999 }))
          .status,
        200,
      );
      assert.equal(
        (await post("/transaction", { id: "transaction-1" })).status,
        200,
      );
      assert.equal(await ledger.balance("123", "10"), 3);
      assert.equal((await post("/activate", {})).status, 200);
      assert.equal((await post("/activate", {})).status, 409);
      const response = await fetch(base + "/status", {
        headers: {
          Authorization: "Bearer " + identity(),
          Origin: "https://evil.example",
        },
      });
      assert.equal(response.headers.get("access-control-allow-origin"), null);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }));
