import { test } from "node:test";
import assert from "node:assert/strict";
import { War } from "../server/war.js";
import {
  changes,
  BattleReactions,
  ROLE_STYLE,
} from "../public/war-reactions.js";
function setup() {
  let now = 100000;
  const w = new War(null, { now: () => now });
  w.enlist("a", "Alpha");
  w.enlist("b", "Bravo");
  w.command("a", "launch");
  return { w, advance: (n) => (now += n) };
}
test("all four accepted actions advance durable visual counters; rejected orders do not", () => {
  const { w } = setup();
  for (const [i, role] of Object.keys(ROLE_STYLE).entries()) {
    assert.equal(w.act("a", "u" + i, "viewer" + i, "!" + role), true);
    assert.equal(w.act("b", "u" + i, "viewer" + i, "!" + role), false);
    assert.equal(w.s.operation.visual.actions[role], 1);
    assert.equal(w.snapshot().visualRoles[role], 1);
  }
  assert.deepEqual(
    new War(structuredClone(w.s)).s.operation.visual,
    w.s.operation.visual,
  );
});
test("crowd bursts are fully counted even when recent named actions are truncated", () => {
  const { w } = setup(),
    before = structuredClone(w.s.operation);
  for (let i = 0; i < 250; i++) w.act("a", "u" + i, "viewer" + i, "!fortify");
  assert.equal(w.snapshot().recentActions.length, 8);
  assert.deepEqual(changes(before, w.s.operation), [
    { kind: "fortify", count: 250 },
  ]);
  assert.equal(w.snapshot().visualRoles.fortify, 250);
});
test("active visual groups expire or leave without destroying crossing state", () => {
  const { w, advance } = setup();
  w.act("a", "u", "viewer", "!fortify");
  w.s.crossing = 75;
  w.s.communities.a.active = false;
  assert.equal(w.snapshot().visualRoles.fortify, 0);
  w.s.communities.a.active = true;
  advance(21000);
  assert.equal(w.snapshot().visualRoles.fortify, 0);
  assert.equal(w.snapshot().crossing, 75);
});
test("reactions suppress history on load/reconnect, repeat snapshots and operation reset", () => {
  const { w } = setup(),
    v = new BattleReactions();
  v.accept(w.snapshot(), 0);
  assert.equal(v.effects.length, 0);
  w.act("a", "u", "viewer", "!scout");
  v.accept(w.snapshot(), 100);
  assert.equal(v.effects.length, 1);
  v.accept(w.snapshot(), 200);
  assert.equal(v.effects.length, 1);
  w.s.operation.id++;
  v.accept(w.snapshot(), 300);
  assert.equal(v.effects.length, 0);
});
test("commander repairs, damage, rescue and result all produce distinct reactions", () => {
  const { w } = setup();
  w.s.operation.hull = 50;
  let before = structuredClone(w.s.operation);
  w.command("a", "reserves");
  assert.ok(changes(before, w.s.operation).some((x) => x.kind === "reserves"));
  before = structuredClone(w.s.operation);
  w.s.operation.hull -= 5;
  w.s.operation.director.rescued = true;
  w.finish("delivered");
  const kinds = changes(before, w.s.operation).map((x) => x.kind);
  assert.ok(kinds.includes("damage"));
  assert.ok(kinds.includes("rescued"));
  assert.ok(kinds.includes("delivered"));
});
test("render complexity stays bounded with thousands of viewers and reduced motion works", () => {
  const { w } = setup();
  const s = w.snapshot();
  s.visualRoles = {
    fortify: 10000,
    scout: 10000,
    escort: 10000,
    assault: 10000,
  };
  s.operation.route = "detour";
  let calls = 0;
  const c = new Proxy(
    {},
    {
      get: () => () => {
        calls++;
      },
      set: () => true,
    },
  );
  const v = new BattleReactions();
  v.draw(c, s, 1000, 500, true);
  assert.ok(calls < 1000);
});
