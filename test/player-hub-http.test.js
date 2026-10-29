import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
test("player hub isolates identities and CSRF, demo access stays scoped, creator broadcasts reject invalid controls", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "player-hub-")),
    base = "http://localhost:43137",
    child = spawn(process.execPath, ["server/index.js"], {
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: "43137",
        PUBLIC_URL: base,
        DATA_DIR: dir,
      },
    });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("startup timeout")), 10000);
      child.stdout.on("data", (d) => {
        if (String(d).includes("listening")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.on("error", reject);
    });
    let r = await fetch(base),
      html = await r.text(),
      cookie = r.headers.get("set-cookie").split(";")[0],
      csrf = html.match(/name="csrf" value="([^"]+)"/)[1];
    await fetch(base + "/demo", {
      method: "POST",
      redirect: "manual",
      headers: { cookie, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrf }),
    });
    let data = await (
      await fetch(base + "/api/creator", { headers: { cookie } })
    ).json();
    csrf = data.csrf;
    const key = data.shop.split("/").pop();
    const post = (url, body, token = csrf) =>
      fetch(base + url, {
        method: "POST",
        headers: {
          cookie,
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: JSON.stringify(body),
      });
    assert.equal((await fetch(base + "/api/player/" + key)).status, 401);
    assert.equal(
      (await post("/api/demo-player", { name: "pilot" }, "wrong")).status,
      403,
    );
    assert.equal(
      (await post("/api/demo-player", { name: "pilot" })).status,
      200,
    );
    let me = await (
      await fetch(base + "/api/player/" + key, { headers: { cookie } })
    ).json();
    assert.equal(me.name, "pilot");
    assert.equal(me.balance, 0);
    assert.equal(me.joined, true);
    assert.equal(
      (
        await post(
          "/api/player/" + key,
          { action: "equip", id: "human-starter" },
          "wrong",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await post("/api/player/" + key, {
          action: "equip",
          id: "human-starter",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await post("/api/creator", {
          action: "session-start",
          label: "Baseline",
          kind: "control",
          pair: "pilot",
        })
      ).status,
      200,
    );
    assert.equal((await post("/api/control", { action: "auto" })).status, 409);
    assert.equal((await post("/api/control", { action: "start" })).status, 409);
    assert.equal(
      (await post("/api/creator", { action: "session-end" })).status,
      200,
    );
    assert.equal((await post("/api/control", { action: "auto" })).status, 200);
    const control = await (
      await fetch(base + "/api/control", { headers: { cookie } })
    ).json();
    assert.equal(control.state.show.auto, true);
    assert.equal(control.state.cadence, 6000);
    assert.equal((await post("/api/control", { action: "kill" })).status, 200);
    const killed = await (
      await fetch(base + "/api/control", { headers: { cookie } })
    ).json();
    assert.equal(killed.state.show.auto, false);
    assert.equal(killed.state.cleared, true);
    data = await (
      await fetch(base + "/api/creator", { headers: { cookie } })
    ).json();
    assert.equal(
      JSON.stringify(data.broadcastAnalytics).includes("demo-user-pilot"),
      false,
    );
  } finally {
    child.kill();
    if (child.exitCode === null)
      await new Promise((resolve) => child.once("exit", resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
