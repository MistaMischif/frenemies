import { test } from "node:test";
import assert from "node:assert/strict";
import { War } from "../server/war.js";
function front() {
  let now = 100000;
  const w = new War(null, { now: () => now });
  w.enlist("a", "Alpha");
  w.enlist("b", "Bravo");
  w.command("a", "launch");
  w.s.operation.intel = 3;
  w.command("a", "detour");
  w.s.operation.progress = 30;
  return {
    w,
    step(roles = ["fortify", "fortify", "assault", "scout", "escort"]) {
      now += 6000;
      roles.forEach((r, i) => w.act("a", "p" + i, "player_" + i, "!" + r));
      w.tick();
    },
    idle() {
      now += 30000;
      w.tick();
    },
    advance() {
      now += 16000;
    },
  };
}
test("visible bridge enemies own damage, assaults hit named targets and mixed roles save the crossing", () => {
  const { w, step } = front();
  step();
  const b = w.s.operation.bridge;
  assert.equal(b.phase, "defend");
  assert.equal(b.enemies.length, 2);
  assert.ok(b.shots[0].damage > 0);
  assert.ok(b.repairs[0].amount > 0);
  assert.equal(b.revealed, true);
  assert.equal(w.s.operation.progress, 30);
  w.command("a", "bridge-repair");
  for (let i = 0; i < 18 && b.phase === "defend"; i++) step();
  assert.equal(b.phase, "secured");
  assert.equal(b.kills, 8);
  assert.equal(w.s.bridgeLegacy.condition, "secured");
  assert.ok(b.spotlight.includes("player_"));
  assert.equal(w.snapshot().operation.bridge.seen, undefined);
});
test("unopposed enemies approach then damage the barricade and leave persistent damage", () => {
  const { w, step } = front();
  step(["escort"]);
  const b = w.s.operation.bridge;
  assert.equal(b.impact, 0);
  for (let i = 0; i < 18 && b.phase === "defend"; i++) step(["escort"]);
  assert.equal(b.phase, "breached");
  assert.ok(w.s.operation.hull < 100);
  assert.equal(w.s.crossing, 0);
});
test("bridge choices authorize commander, spend once, and rush persists into the next convoy", () => {
  const { w, step, advance } = front();
  step();
  assert.throws(() => w.command("b", "bridge-repair"));
  w.command("a", "bridge-repair");
  assert.equal(w.s.supplies, 50);
  assert.throws(() => w.command("a", "bridge-repair"));
  assert.equal(w.s.supplies, 50);
  const z = front();
  z.step();
  const before = z.w.s.crossing;
  z.w.command("a", "bridge-rush");
  assert.equal(z.w.s.operation.progress, 48);
  assert.equal(z.w.s.crossing, Math.max(0, before - 25));
  assert.equal(z.w.s.bridgeLegacy.condition, "abandoned");
  z.w.command("a", "evacuate");
  z.advance();
  z.w.command("a", "launch");
  assert.equal(z.w.s.bridgeLegacy.condition, "abandoned");
  assert.equal(z.w.s.crossing, Math.max(0, before - 25));
});
test("bridge holds when empty, survives restart, and defaults without spending", () => {
  const { w, step, idle } = front();
  step();
  const before = structuredClone(w.s.operation.bridge);
  idle();
  assert.deepEqual(w.s.operation.bridge, before);
  const restored = new War(structuredClone(w.s));
  assert.deepEqual(restored.s.operation.bridge, before);
  step();
  step();
  step();
  step();
  assert.equal(w.s.operation.bridge.decision, "hold");
  assert.equal(w.s.supplies, 60);
});

test("changing the crowd response can save the bridge without buying repairs", () => {
  const { w, step } = front();
  step();
  w.command("a", "bridge-hold");
  for (let i = 0; i < 18 && w.s.operation.bridge.phase === "defend"; i++)
    step(["fortify", "fortify", "assault", "assault", "scout", "escort"]);
  assert.equal(w.s.operation.bridge.phase, "secured");
  assert.equal(w.s.supplies, 60);
});
