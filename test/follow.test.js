import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { openStorage } from "../server/storage.js";
import { Game } from "../server/game.js";
import { applyEvent } from "../server/twitch.js";

test("follow claims survive restart, reject concurrent repeats and allow separate channels", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "frenemies-follow-"));
  try {
    let storage = await openStorage({ dataDir });
    assert.deepEqual(
      await Promise.all([
        storage.claimFollow("1", "2"),
        storage.claimFollow("1", "2"),
      ]),
      [true, false],
    );
    await storage.close();
    storage = await openStorage({ dataDir });
    assert.equal(await storage.claimFollow("1", "2"), false);
    assert.equal(await storage.claimFollow("3", "2"), true);
    await storage.close();
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("follow eligibility, stable identity, storage failure and round boundary", async () => {
  const game = new Game({ host: "host" });
  const claims = new Set();
  const room = {
    game,
    claimFollow: async (id) => {
      if (claims.has(id)) return false;
      claims.add(id);
      return true;
    },
  };
  const follow = (user_login = "r", user_id = "12") =>
    applyEvent(room, "channel.follow", { user_login, user_id });
  await follow();
  assert.equal(claims.size, 0);
  game.chat("r", "!red");
  game.start();
  game.teams.red.line = 50;
  await Promise.all([follow(), follow()]);
  assert.equal(game.teams.red.line, 52);
  game.chat("renamed", "!red");
  await follow("renamed");
  assert.equal(game.teams.red.line, 52);
  room.claimFollow = async () => {
    throw new Error("offline");
  };
  await assert.rejects(follow("r", "13"), /offline/);
  assert.equal(game.teams.red.line, 52);
  room.claimFollow = async () => {
    game.finish();
    game.start();
    game.teams.red.line = 50;
    return true;
  };
  await follow("r", "14");
  assert.equal(game.teams.red.line, 50);
});
