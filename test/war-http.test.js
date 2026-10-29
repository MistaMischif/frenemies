import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { War, WAR_KEY } from "../server/war.js";
test("shared war HTTP authorization, two demo communities, public isolation and durable live world", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "war-test-")),
    base = "http://localhost:43139";
  const live = new War();
  live.enlist("live-one", "Live");
  live.command("live-one", "launch");
  live.command("live-one", "evacuate");
  await writeFile(
    path.join(dir, "scores.json"),
    JSON.stringify({ [WAR_KEY]: live.s }),
  );
  const child = spawn(process.execPath, ["server/index.js"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: "43139",
      PUBLIC_URL: base,
      DATA_DIR: dir,
      DATABASE_URL: "",
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
    assert.equal((await fetch(base + "/api/war")).status, 401);
    assert.equal((await fetch(base + "/api/war/evidence")).status, 401);
    async function demo() {
      let r = await fetch(base),
        html = await r.text(),
        cookie = r.headers.get("set-cookie").split(";")[0],
        csrf = html.match(/name="csrf" value="([^"]+)"/)[1];
      r = await fetch(base + "/demo", {
        method: "POST",
        redirect: "manual",
        headers: {
          cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ csrf }),
      });
      assert.equal(r.headers.get("location"), "/war?demo=1");
      cookie = r.headers.get("set-cookie")?.split(";")[0] || cookie;
      let d = await (
        await fetch(base + "/api/war", { headers: { cookie } })
      ).json();
      return { cookie, csrf: d.csrf };
    }
    const a = await demo(),
      b = await demo();
    const post = (who, body) =>
      fetch(base + "/api/war", {
        method: "POST",
        headers: {
          cookie: who.cookie,
          "Content-Type": "application/json",
          "X-CSRF-Token": who.csrf,
        },
        body: JSON.stringify(body),
      });
    assert.equal(
      (await post({ ...a, csrf: "bad" }, { action: "join" })).status,
      403,
    );
    await post(a, { action: "join" });
    await post(b, { action: "join" });
    let r = await post(a, { action: "launch" });
    let d = await r.json();
    assert.equal(d.simulated, true);
    assert.equal(Object.keys(d.communities).length, 2);
    assert.equal(
      (
        await post(a, {
          action: "demo-action",
          name: "same_account",
          message: "!scout",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await post(b, {
          action: "demo-action",
          name: "same_account",
          message: "!escort",
        })
      ).status,
      409,
    );
    d = await (
      await fetch(base + "/api/war/view/" + d.overlay?.split("/").pop())
    )
      .json()
      .catch(() => null);
    const view = await (
      await fetch(base + "/api/war", { headers: { cookie: a.cookie } })
    ).json();
    const publicData = await (
      await fetch(base + "/api/war/view/" + view.overlay.split("/").pop())
    ).json();
    assert.equal(publicData.csrf, undefined);
    assert.equal(publicData.players, undefined);
    assert.equal(publicData.metrics.uniqueAccounts, 1);
    const evidence = await (
      await fetch(base + "/api/war/evidence", { headers: { cookie: a.cookie } })
    ).json();
    assert.equal(evidence.metrics.simulated, true);
    assert.ok(evidence.events.some((e) => e.kind === "action"));
    await post(a, { action: "hide" });
    assert.equal(
      (
        await (
          await fetch(base + "/api/war/view/" + view.overlay.split("/").pop())
        ).json()
      ).cleared,
      true,
    );
    assert.equal(
      JSON.parse(await readFile(path.join(dir, "scores.json"), "utf8"))[WAR_KEY]
        .integrity,
      75,
    );
    const started = await (await post(a, { action: "demo-start" })).json();
    assert.equal(started.enlisted, true);
    assert.equal(started.cleared, false);
    assert.equal(started.demoSquad, true);
    const convoyId = started.operation.id;
    await post(a, { action: "demo-start" });
    let moving;
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      moving = await (await fetch(base + "/api/war", { headers: { cookie: a.cookie } })).json();
      if (moving.operation.progress > 0) break;
    }
    assert.equal(moving.operation.id, convoyId);
    assert.equal(moving.operation.route, "detour");
    assert.ok(moving.operation.progress > 0, "demo must advance without extra clicks");
    for (const role of ["fortify", "scout", "assault", "escort"]) {
      assert.ok(moving.visualRoles[role] > 0);
      assert.ok(moving.operation.visual.actions[role] > 0);
    }
  } finally {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
