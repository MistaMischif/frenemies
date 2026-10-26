import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../server/game.js";
function game() {
  const g = new Game({ host: "host" });
  g.chat("r", "!red");
  g.chat("b", "!blue");
  g.start();
  return g;
}
test("first vote counts once and switching is locked; host excluded", () => {
  const g = game();
  assert.equal(g.chat("r", "!attack"), true);
  assert.equal(g.chat("r", "!heal"), false);
  assert.equal(g.chat("r", "!blue"), false);
  assert.equal(g.chat("host", "!red"), false);
  g.advance(2000);
  assert.equal(g.teams.blue.line, 94);
  assert.equal(g.chat("r", "!heal"), true);
});
test("active counts reset each battle and do not decay", () => {
  const g = game();
  g.chat("r", "!defend");
  g.advance(40000);
  assert.equal(g.counts().red, 1);
  g.finish();
  g.start();
  assert.equal(g.counts().red, 0);
});
test("attacks resolve simultaneously and mutual knockout draws", () => {
  const g = game();
  g.teams.red.line = 6;
  g.teams.blue.line = 6;
  g.chat("r", "!attack");
  g.chat("b", "!attack");
  g.advance(2000);
  assert.equal(g.winner, "draw");
});
test("defense halves next attack only", () => {
  const g = game();
  g.chat("r", "!attack");
  g.chat("b", "!defend");
  g.advance(2000);
  assert.equal(g.teams.blue.line, 97);
  g.chat("r", "!attack");
  g.advance(2000);
  assert.equal(g.teams.blue.line, 91);
});
test("surge doubles, consumes power and enforces 30 second cooldown", () => {
  const g = game();
  g.chat("r", "!surge");
  g.advance(2000);
  g.chat("r", "!attack");
  g.advance(2000);
  assert.equal(g.teams.blue.line, 88);
  g.chat("r", "!surge");
  g.advance(2000);
  assert.equal(g.teams.red.power, false);
  g.advance(26000);
  g.chat("r", "!surge");
  g.advance(2000);
  assert.equal(g.teams.red.power, true);
});
test("damage cap includes powered attacks; heal cap and maximum line", () => {
  const g = game();
  for (let i = 0; i < 40; i++) {
    g.chat("p" + i, "!red");
    g.chat("p" + i, "!attack");
  }
  g.teams.red.power = true;
  g.advance(2000);
  assert.equal(g.teams.blue.line, 75);
  g.teams.red.line = 50;
  g.chat("r", "!heal");
  g.advance(2000);
  assert.equal(g.teams.red.line, 65);
  g.teams.red.line = 99;
  g.chat("r", "!heal");
  g.advance(2000);
  assert.equal(g.teams.red.line, 100);
});
test("pause stops timer; kill clears and rejects votes; resume restores", () => {
  const g = game();
  g.kill();
  g.advance(10000);
  assert.equal(g.elapsed, 0);
  assert.equal(g.cleared, true);
  assert.equal(g.chat("r", "!attack"), false);
  g.pause();
  assert.equal(g.cleared, false);
  assert.equal(g.status, "running");
});
test("freeze clears votes; fog hides totals server-side", () => {
  const g = game();
  g.chat("r", "!attack");
  g.battlefield("freeze");
  assert.equal(g.votes.size, 0);
  assert.equal(g.chat("r", "!attack"), false);
  g.battlefield("fog");
  assert.equal(g.snapshot().totals, null);
  g.advance(10000);
  assert.ok(g.snapshot().totals);
  assert.equal(g.chat("r", "!attack"), true);
});
test("timer decides strength, then active players, then draw; records once", () => {
  let saved;
  const g = new Game({ save: (s) => (saved = { ...s }) });
  g.chat("r", "!red");
  g.start();
  g.chat("r", "!defend");
  g.advance(180000);
  assert.equal(g.winner, "red");
  assert.equal(saved.red, 1);
  g.advance(2000);
  assert.equal(g.season.red, 1);
  const d = game();
  d.advance(180000);
  assert.equal(d.winner, "draw");
});
test("EventSub activates only joined players and applies visible bonus", () => {
  const g = game();
  g.teams.red.line = 50;
  assert.equal(g.moment("follow", "unknown"), false);
  g.moment("follow", "r");
  assert.equal(g.teams.red.line, 52);
  assert.equal(g.counts().red, 1);
  assert.match(g.last, /r/);
  g.moment("raid", "r");
  assert.equal(g.teams.red.line, 57);
  g.moment("hype", "r");
  g.chat("r", "!attack");
  assert.equal(g.totals().red.attack, 2);
});
test("blocklists enforced and simulated scores do not persist", () => {
  const g = new Game({
    blockedNames: ["bad"],
    blockedCommands: ["!attack"],
    save: () => assert.fail("demo must not save"),
  });
  assert.equal(g.chat("bad", "!red"), false);
  g.chat("ok", "!red");
  g.simulated = true;
  g.start();
  assert.equal(g.chat("ok", "!attack"), false);
  g.teams.blue.line = 0;
  g.finish();
  assert.equal(g.stream.red, 1);
  assert.equal(g.season.red, 0);
});
