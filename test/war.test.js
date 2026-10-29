import { test } from "node:test";
import assert from "node:assert/strict";
import { War } from "../server/war.js";
function setup() {
  let now = 100000;
  const w = new War(null, { now: () => now });
  w.enlist("a", "Alpha");
  w.enlist("b", "Bravo");
  w.command("a", "launch");
  return {
    w,
    step: () => {
      now += 6000;
      w.tick();
    },
    advance: (n) => (now += n),
  };
}
test("one Twitch account cannot multiply its actions across communities", () => {
  const { w, advance } = setup();
  assert.equal(w.act("a", "123", "viewer", "!scout"), true);
  assert.equal(w.act("b", "123", "viewer", "!escort"), false);
  advance(6000);
  assert.equal(w.act("b", "123", "viewer", "!escort"), true);
  assert.equal(w.report().uniqueAccounts, 1);
  assert.equal(w.report().crossCommunityAccounts, 1);
  assert.equal(w.report().acceptedActions, 2);
});
test("only dispatching commander can choose route, after scouting; reserves cannot be spent twice", () => {
  const { w, step } = setup();
  assert.throws(() => w.command("a", "direct"));
  w.act("b", "123", "scout", "!scout");
  step();
  assert.throws(() => w.command("b", "direct"));
  w.command("a", "detour");
  assert.throws(() => w.command("a", "direct"));
  w.command("b", "reserves");
  assert.equal(w.s.supplies, 45);
  assert.throws(() => w.command("b", "reserves"));
});
test("unattended war holds and reload preserves state, choices and global action limit", () => {
  const { w, step } = setup();
  step();
  assert.equal(w.s.operation.steps, 0);
  w.act("a", "123", "scout", "!scout");
  step();
  w.command("a", "detour");
  w.command("a", "reserves");
  const copy = new War(JSON.parse(JSON.stringify(w.s)), { now: () => 106001 });
  assert.equal(copy.s.supplies, 45);
  assert.throws(() => copy.command("a", "reserves"));
  assert.equal(copy.act("b", "123", "scout", "!scout"), false);
  assert.equal(copy.report().uniqueAccounts, 1);
});
function run(roles) {
  const { w, step } = setup();
  w.act("a", "scout", "scout", "!scout");
  step();
  w.command("a", "detour");
  for (let i = 0; i < 80 && w.s.operation.status === "active"; i++) {
    for (let j = 0; j < roles.length; j++)
      w.act(j % 2 ? "a" : "b", "user" + j, "user" + j, "!" + roles[j]);
    step();
  }
  return w;
}
test("complementary communities deliver; repeating assault cannot deliver", () => {
  const mixed = run([
    "escort",
    "escort",
    "fortify",
    "fortify",
    "scout",
    "assault",
  ]);
  assert.equal(mixed.s.operation.status, "delivered");
  assert.equal(mixed.s.deliveries, 1);
  assert.equal(mixed.s.supplies, 90);
  assert.equal(Object.keys(mixed.s.operation.contributions).length, 2);
  const assault = run([
    "assault",
    "assault",
    "assault",
    "assault",
    "assault",
    "assault",
  ]);
  assert.notEqual(assault.s.operation.status, "delivered");
});
test("evacuation persists cost without claiming a win, a new convoy preserves war consequences", () => {
  const { w, advance } = setup();
  w.command("a", "evacuate");
  assert.equal(w.s.integrity, 75);
  assert.equal(w.s.deliveries, 0);
  assert.throws(() => w.command("b", "launch"));
  advance(16000);
  w.command("b", "launch");
  assert.equal(w.s.integrity, 75);
  assert.equal(w.s.operation.id, 2);
});
test("public state excludes participant identifiers; separate simulated war has no live counters", () => {
  const { w } = setup();
  w.act("a", "private-id", "name", "!scout");
  assert.equal(JSON.stringify(w.snapshot()).includes("private-id"), false);
  assert.equal(w.snapshot().players, undefined);
  assert.equal(w.snapshot().recentActions[0].participant, undefined);
  assert.equal(new War(null, { simulated: true }).report().uniqueAccounts, 0);
});
test("inactive communities cannot contribute or command; UTC-day return is counted once", () => {
  const { w, advance } = setup();
  w.act("a", "123", "viewer", "!scout");
  w.s.communities.a.active = false;
  assert.equal(w.act("a", "456", "other", "!escort"), false);
  assert.throws(() => w.command("a", "reserves"));
  advance(86400000);
  w.act("b", "123", "viewer", "!escort");
  assert.equal(w.report().returningOnAnotherDay, 1);
});

test("commander can hand off without resetting war; another community cannot seize an active decision immediately", () => {
  const { w, advance } = setup();
  assert.throws(() => w.command("b", "take-command"));
  advance(120000);
  w.command("b", "take-command");
  assert.equal(w.s.operation.commander, "b");
  assert.equal(w.s.operation.id, 1);
  assert.throws(() => w.command("a", "evacuate"));
  w.command("b", "evacuate");
  assert.equal(w.s.operation.status, "evacuated");
});
