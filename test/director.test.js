import { test } from "node:test";
import assert from "node:assert/strict";
import { createDirector, direct } from "../server/director.js";
import { War } from "../server/war.js";
test("director cycles buildup, peak, fade, recovery without changing fixed encounter strength", () => {
  const d = createDirector(),
    o = { pressure: 80 };
  d.damage = 5;
  assert.equal(direct(d, o).spawn, 4);
  assert.equal(d.phase, "peak");
  assert.equal(direct(d, o).spawn, -6);
  assert.equal(d.phase, "fade");
  o.pressure = 0;
  d.damage = 0;
  for (let i = 0; i < 8 && d.phase !== "relax"; i++) direct(d, o);
  assert.equal(d.phase, "relax");
  for (let i = 0; i < 6; i++) direct(d, o);
  assert.equal(d.phase, "build");
});
test("standard pacing bypasses adaptive changes", () => {
  const d = createDirector();
  d.enabled = false;
  assert.deepEqual(direct(d, { pressure: 100 }), {
    spawn: 4,
    engaged: true,
    changed: false,
  });
  assert.equal(d.intensity, 0);
});
function front() {
  let now = 100000;
  const w = new War(null, { now: () => now });
  w.enlist("a", "Alpha");
  w.enlist("b", "Bravo");
  w.command("a", "launch");
  w.s.operation.intel = 3;
  w.command("a", "detour");
  return {
    w,
    tick() {
      now += 6000;
      for (const [i, role] of [
        "scout",
        "escort",
        "escort",
        "fortify",
        "fortify",
        "assault",
      ].entries())
        w.act(i % 2 ? "a" : "b", "u" + i, "user_" + i, "!" + role);
      w.tick();
    },
    idle() {
      now += 60000;
      w.tick();
    },
  };
}
test("host offers one costed rescue during recovery; choice survives reload and awards only once", () => {
  const { w, tick } = front();
  for (let i = 0; i < 35 && !w.s.operation.director.choice; i++) tick();
  const d = w.s.operation.director;
  assert.ok(d.choice);
  assert.throws(() => w.command("b", "rescue"));
  w.command("a", "rescue");
  assert.equal(w.s.supplies, 50);
  assert.throws(() => w.command("a", "rescue"));
  const progress = w.s.operation.progress;
  tick();
  assert.equal(w.s.operation.progress, progress);
  tick();
  assert.equal(w.s.operation.progress, progress);
  assert.equal(w.s.integrity, 85);
  assert.equal(d.rescued, true);
  tick();
  assert.equal(w.s.integrity, 85);
  const restored = new War(structuredClone(w.s));
  assert.equal(restored.s.operation.director.rescued, true);
  assert.ok(w.s.events.some((e) => e.kind === "rescue"));
});
test("silence is not treated as boredom or offline danger", () => {
  const { w, idle } = front();
  const before = structuredClone(w.s.operation);
  idle();
  assert.deepEqual(w.s.operation, before);
});
test("unanswered rescue defaults to continuing without charging, commander tuning cannot spend supplies", () => {
  const { w, tick } = front();
  for (let i = 0; i < 35 && !w.s.operation.director.choice; i++) tick();
  assert.ok(w.s.operation.director.choice);
  for (let i = 0; i < 5; i++) tick();
  assert.equal(w.s.operation.director.choice, null);
  assert.equal(w.s.supplies, 60);
  assert.throws(() => w.command("b", "director-off"));
  w.command("a", "director-off");
  assert.equal(w.s.operation.director.enabled, false);
  assert.equal(w.s.supplies, 60);
});
test("old persisted convoys migrate without resetting world or progress", () => {
  const { w } = front();
  w.s.operation.progress = 42;
  delete w.s.operation.director;
  const restored = new War(structuredClone(w.s));
  assert.equal(restored.s.operation.progress, 42);
  assert.equal(restored.s.operation.director.enabled, true);
});
