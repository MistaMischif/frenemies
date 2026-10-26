import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";
import WebSocket from "ws";

test("HTTP authorization, CSRF, webhook signature/replay and persistent score loading", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "frenemies-test-"));
  await writeFile(
    path.join(dir, "scores.json"),
    JSON.stringify({
      123: {
        login: "testhost",
        overlay: "test-read-only-overlay",
        season: { red: 7, blue: 3 },
      },
    }),
  );
  const origin = "http://localhost:43127",
    secret = "test-only-webhook-secret-12345";
  const child = spawn(process.execPath, ["server/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: "43127",
      PUBLIC_URL: origin,
      DATA_DIR: dir,
      EVENTSUB_SECRET: secret,
    },
  });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Server startup timed out")),
        10000,
      );
      child.stdout.on("data", (d) => {
        if (String(d).includes("listening")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      child.once("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error("Server exited " + code));
      });
    });
    assert.equal((await fetch(origin + "/health")).status, 200);
    assert.equal((await fetch(origin + "/api/control")).status, 401);
    assert.equal(
      (await fetch(origin + "/demo", { method: "POST" })).status,
      403,
    );
    const home = await fetch(origin),
      cookie = home.headers.get("set-cookie").split(";")[0],
      html = await home.text();
    const csrf = html.match(/name="csrf" value="([a-f0-9]+)"/)[1];
    const demo = await fetch(origin + "/demo", {
      method: "POST",
      redirect: "manual",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ csrf }),
    });
    assert.equal(demo.status, 303);
    const state = await (
      await fetch(origin + "/api/control", { headers: { Cookie: cookie } })
    ).json();
    assert.equal(state.state.simulated, true);
    assert.equal(
      (
        await fetch(origin + "/api/control", {
          method: "POST",
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: '{"action":"start"}',
        })
      ).status,
      403,
    );
    const action = await fetch(origin + "/api/control", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
        "X-CSRF-Token": state.csrf,
      },
      body: '{"action":"start"}',
    });
    assert.equal(action.status, 200);
    const snapshot = await new Promise((resolve, reject) => {
      const ws = new WebSocket(
        "ws://localhost:43127/?overlay=test-read-only-overlay",
      );
      ws.on("message", (d) => {
        resolve(JSON.parse(d));
        ws.close();
      });
      ws.on("error", reject);
    });
    assert.deepEqual(snapshot.season, { red: 7, blue: 3 });
    const stamp = new Date().toISOString(),
      id = "test-message",
      body = JSON.stringify({
        challenge: "hello",
        subscription: { condition: { broadcaster_user_id: "123" } },
      });
    const signature =
      "sha256=" +
      createHmac("sha256", secret)
        .update(id + stamp + body)
        .digest("hex");
    const headers = {
      "Content-Type": "application/json",
      "Twitch-Eventsub-Message-Id": id,
      "Twitch-Eventsub-Message-Timestamp": stamp,
      "Twitch-Eventsub-Message-Type": "webhook_callback_verification",
      "Twitch-Eventsub-Message-Signature": signature,
    };
    assert.equal(
      (
        await fetch(origin + "/eventsub", {
          method: "POST",
          headers: { ...headers, "Twitch-Eventsub-Message-Signature": "wrong" },
          body,
        })
      ).status,
      403,
    );
    assert.equal(
      await (
        await fetch(origin + "/eventsub", { method: "POST", headers, body })
      ).text(),
      "hello",
    );
    const eventBody = JSON.stringify({
      subscription: {
        type: "channel.follow",
        condition: { broadcaster_user_id: "123" },
      },
      event: { user_login: "viewer" },
    });
    const eventHeaders = {
      ...headers,
      "Twitch-Eventsub-Message-Type": "notification",
      "Twitch-Eventsub-Message-Signature":
        "sha256=" +
        createHmac("sha256", secret)
          .update(id + stamp + eventBody)
          .digest("hex"),
    };
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await fetch(origin + "/eventsub", {
            method: "POST",
            headers: eventHeaders,
            body: eventBody,
          })
        ).status,
        204,
      );
  } finally {
    child.kill();
    await new Promise((r) => child.once("exit", r));
    await rm(dir, { recursive: true, force: true });
  }
});
