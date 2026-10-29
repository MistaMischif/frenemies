import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../server/game.js";
import { Campaign } from "../server/campaign.js";
import { Economy } from "../server/economy.js";
import { Show } from "../server/show.js";
import { SaveQueue } from "../server/save-queue.js";
function setup(n = 2) {
  const g = new Game(),
    c = new Campaign(),
    e = new Economy(c),
    show = new Show(c);
  g.campaign = c;
  g.economy = e;
  g.show = show;
  g.simulated = true;
  for (let i = 0; i < n; i++) {
    const name = "viewer_" + i,
      team = i < n / 2 ? "red" : "blue";
    c.join("id" + i, name, team);
    g.chat(name, team === "red" ? "!human" : "!zombie");
  }
  return { g, c, e, show };
}
function fight(g) {
  g.start();
  for (const name of g.players.keys()) g.chat(name, "!attack");
  for (let i = 0; i < 30 && g.status === "running"; i++) g.advance(6000);
}
test("40 and 2000 viewers get fair six-second battles and rewards from one persistent choice", () => {
  for (const size of [40, 2000]) {
    const { g, e } = setup(size);
    fight(g);
    assert.equal(g.status, "finished");
    assert.equal(g.elapsed, 78000);
    assert.equal(g.winner, "draw");
    assert.equal(e.account("id0").balance, 30);
    assert.equal(e.account("id" + (size - 1)).balance, 30);
    assert.equal(g.recap.acceptedVotes, size);
    assert.equal(g.counts().red, size / 2);
    g.start();
    g.advance(12000);
    assert.equal(g.teams.red.line, 100);
    assert.equal(g.intents.size, 0);
  }
});
test("a 100-to-1 team has no damage or timeout tiebreak advantage", () => {
  const { g } = setup();
  for (let i = 2; i < 101; i++) {
    g.chat("extra_" + i, "!human");
  }
  g.start();
  for (const name of g.players.keys()) g.chat(name, "!attack");
  g.advance(6000);
  assert.equal(g.teams.red.line, 92);
  assert.equal(g.teams.blue.line, 92);
  g.finish();
  assert.equal(g.winner, "draw");
});
test("missions continue past daily currency cap and showcase ranks cannot overspend", () => {
  const { g, e } = setup();
  e.author({
    action: "mission",
    title: "Regular",
    story: "You returned.",
    objective: "play",
    target: 11,
    reward: 20,
  });
  e.author({ action: "publish", id: e.d.missions[0].id, published: true });
  for (let i = 0; i < 11; i++) fight(g);
  assert.equal(e.account("id0").balance, 140);
  assert.equal(e.account("id0").progress[e.d.missions[0].id], 11);
  e.command("id0", "viewer_0", "!upgrade", "red");
  assert.equal(e.account("id0").balance, 90);
  assert.equal(e.account("id0").prestige, 1);
  assert.throws(() => e.command("id0", "viewer_0", "!upgrade", "red"), /Need/);
  assert.equal(e.account("id0").balance, 90);
});
test("published mission copy permits new rules without resetting previous ownership", () => {
  const { e } = setup();
  e.author({
    action: "mission",
    title: "First",
    story: "Story",
    objective: "play",
    target: 1,
    reward: 10,
  });
  const m = e.d.missions[0];
  e.author({ action: "publish", id: m.id, published: true });
  e.author({
    action: "edit",
    id: m.id,
    title: "Renamed",
    story: "Updated",
    objective: "win",
    target: 50,
    reward: 50,
  });
  assert.equal(m.target, 1);
  assert.equal(m.reward, 10);
  e.author({ action: "duplicate", id: m.id });
  const copy = e.d.missions[1];
  e.author({
    action: "edit",
    id: copy.id,
    title: "New",
    story: "New edition",
    objective: "win",
    target: 3,
    reward: 40,
  });
  assert.equal(copy.target, 3);
  assert.equal(copy.published, false);
  assert.notEqual(copy.id, m.id);
});
test("episodes snapshot revisions, branch on results and unlock cosmetics once for eligible players", () => {
  const { g, show, e } = setup();
  const template = {
    action: "episode",
    title: "Relay",
    intro: "Save the signal",
    success: "Restored",
    failure: "Lost",
    objective: "attack",
    target: 2,
    rounds: 2,
    unlock: "human-purple",
  };
  show.author(template);
  const id = show.d.episodes[0].id;
  show.author({ action: "launch-episode", id });
  show.author({ ...template, id, title: "Changed", target: 100 });
  fight(g);
  assert.equal(show.snapshot().episode.title, "Relay");
  assert.equal(show.snapshot().episode.status, "complete");
  assert.ok(e.account("id0").owned.includes("human-purple"));
  show.finished(g);
  assert.equal(
    e.account("id0").owned.filter((x) => x === "human-purple").length,
    1,
  );
  show.author({ action: "launch-episode", id });
  fight(g);
  fight(g);
  assert.equal(show.snapshot().episode.status, "missed");
  assert.equal(show.snapshot().episode.ending, "Lost");
});
test("automatic mode obeys intermission, pause/kill, empty rounds, restart and control sample safety", () => {
  const { g, show, c } = setup();
  show.auto = true;
  fight(g);
  const next = show.nextAt;
  let starts = 0;
  show.advance(g, () => starts++, next - 1);
  assert.equal(starts, 0);
  g.kill();
  show.advance(g, () => starts++, next + 1);
  assert.equal(starts, 0);
  assert.equal(show.auto, false);
  show.auto = true;
  g.status = "lobby";
  g.start();
  g.finish();
  g.start();
  g.finish();
  assert.equal(show.auto, false);
  show.begin({ label: "Test" });
  const restored = new Show(new Campaign(JSON.parse(JSON.stringify(c.data))));
  assert.equal(restored.auto, false);
  assert.equal(restored.session, undefined);
  assert.equal(restored.d.sessions.at(-1).interrupted, true);
});
test("broadcast retention uses subsequent sessions; ROI unknowns are not zero and export has no identities", () => {
  const { show } = setup();
  for (let i = 0; i < 4; i++) {
    show.begin({ label: "Show " + i, kind: "game", pair: "week" }, i * 7200000);
    show.eligible("private-alice");
    if (i === 0) show.eligible("private-bob");
    show.end(
      { receipts: 100, costs: 10, minutes: 30, hourlyRate: 20 },
      i * 7200000 + 3600000,
    );
  }
  let a = show.analytics();
  assert.deepEqual(a.nextBroadcast, { eligible: 4, returned: 3, rate: 0.75 });
  assert.deepEqual(a.nextThree, { eligible: 2, returned: 1, rate: 0.5 });
  assert.equal(a.sessions[0].contribution, 80);
  assert.equal(JSON.stringify(a).includes("private-"), false);
  show.begin({ label: "Control", kind: "control", pair: "week" }, 30000000);
  show.end({ receipts: 80, costs: 10, minutes: 30, hourlyRate: 20 }, 33600000);
  assert.equal(show.analytics().pairs[0].contributionLiftPerHour, 20);
  show.begin({ label: "Unknown" }, 35000000);
  show.end({}, 38600000);
  assert.equal(show.analytics().sessions.at(-1).contribution, null);
});
test("slow/failing saves coalesce snapshots without blocking battle actions or erasing rewards", async () => {
  const { g, e } = setup();
  let release;
  const stored = [];
  let calls = 0;
  const queue = new SaveQueue(async (id, record) => {
    calls++;
    if (calls === 1) await new Promise((r) => (release = r));
    stored.push(record);
  });
  const first = queue.put("channel", () => ({
    balance: e.account("id0").balance,
  }));
  const second = queue.put("channel", () => ({
    balance: e.account("id0").balance,
  }));
  const third = queue.put("channel", () => ({
    balance: e.account("id0").balance,
  }));
  fight(g);
  assert.equal(e.account("id0").balance, 30);
  release();
  await Promise.all([first, second, third]);
  assert.equal(calls, 2);
  assert.equal(stored[1].balance, 30);
  const failed = new SaveQueue(async () => {
    throw Error("disk offline");
  });
  await assert.rejects(failed.put("channel", {}));
  assert.equal(e.account("id0").balance, 30);
});

test("read commands do not create accounts and custom starters replace example art for new players", () => {
  const { e } = setup();
  e.command("new", "new", "!wallet", "red");
  assert.equal(e.d.accounts.new, undefined);
  e.d.items.push({
    id: "creator-free",
    team: "red",
    name: "Pilot",
    price: 0,
    published: true,
    asset: "/characters/char02V01.png",
  });
  e.author({
    action: "settings",
    title: "Crew",
    currency: "Stars",
    redStarter: "creator-free",
    blueStarter: "zombie-starter",
  });
  const a = e.account("new");
  assert.deepEqual(a.owned, ["creator-free", "zombie-starter"]);
  assert.equal(a.equipped.red, "creator-free");
  assert.throws(() =>
    e.author({
      action: "settings",
      title: "Crew",
      currency: "Stars",
      redStarter: "human-purple",
      blueStarter: "zombie-starter",
    }),
  );
});
