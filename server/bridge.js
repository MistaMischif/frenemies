export function bridgeStep(w, n, intents) {
  const s = w.s,
    o = s.operation;
  if (!o.bridge && o.progress >= 30 && !o.director.rescueTicks) {
    o.bridge = {
      phase: "defend",
      tick: 0,
      health: Math.max(0, s.crossing),
      enemies: [],
      nextId: 1,
      kills: 0,
      decision: null,
      choiceTicks: 5,
      shots: [],
      repairs: [],
      impact: 0,
      spotlight: "",
      seen: {},
    };
    o.director.choice = null;
    w.event(
      "bridge",
      "Raiders are closing on the crossing. Hold and repair, or abandon the bridge to save time.",
      { operation: o.id },
    );
  }
  const b = o.bridge;
  if (!b || b.phase !== "defend") return false;
  b.tick++;
  b.shots = [];
  b.repairs = [];
  b.impact = 0;
  const credit = (role) => {
    const eligible = intents
      .filter((x) => x.role === role)
      .sort((a, z) => (b.seen[a.name] || 0) - (b.seen[z.name] || 0));
    const x = eligible[0];
    if (!x) return "The community";
    b.seen[x.name] = (b.seen[x.name] || 0) + 1;
    return x.name;
  };
  if (!b.decision && --b.choiceTicks <= 0) {
    b.decision = "hold";
    w.event("bridge", "No override: the community holds the bridge.", {
      operation: o.id,
    });
  }
  // The visible raid is the only damage source during this encounter.
  if ([1, 3, 5, 7].includes(b.tick)) {
    for (let i = 0; i < 2; i++)
      b.enemies.push({ id: b.nextId++, x: 1320 + i * 65, hp: 8, maxHp: 8 });
  }
  b.revealed = n.scout > 0;
  b.nextWave = b.tick < 7 ? Math.max(1, 2 - (b.tick % 2)) : 0;
  for (const e of b.enemies)
    if (e.hp > 0) e.x = Math.max(995, e.x - (b.revealed ? 110 : 145));
  let fire = n.assault * 1.5;
  for (const e of b.enemies.filter((e) => e.hp > 0).sort((a, z) => a.x - z.x)) {
    if (fire <= 0) break;
    const hit = Math.min(e.hp, fire);
    e.hp -= hit;
    fire -= hit;
    b.shots.push({ id: e.id, x: e.x, damage: hit });
    if (e.hp <= 0) {
      b.kills++;
      b.spotlight = credit("assault") + " stopped a raider";
    }
  }
  const repair = Math.min(
    100 - b.health,
    n.fortify * 1.1 + (b.repairTicks > 0 ? 12 : 0),
  );
  if (b.repairTicks > 0) b.repairTicks--;
  if (repair > 0) {
    b.health += repair;
    b.repairs.push({ amount: repair, name: credit("fortify") });
    if (!b.shots.length)
      b.spotlight = b.repairs[0].name + " rebuilt the barricade";
  }
  const attackers = b.enemies.filter((e) => e.hp > 0 && e.x <= 995);
  b.impact = attackers.length * 7;
  b.health = Math.max(0, b.health - b.impact);
  if (b.health === 0) {
    o.hull = Math.max(0, o.hull - attackers.length * 8);
  }
  o.director.damage = b.health === 0 ? attackers.length * 8 : 0;
  o.pressure = b.enemies.filter((e) => e.hp > 0).length * 10;
  s.crossing = b.health;
  if (
    b.health === 0 ||
    b.tick >= 18 ||
    (b.tick >= 7 && b.enemies.every((e) => e.hp <= 0))
  ) {
    b.phase =
      b.health > 0 && b.enemies.every((e) => e.hp <= 0)
        ? "secured"
        : "breached";
    if (b.phase === "breached") {
      o.hull = Math.max(0, o.hull - 15);
      s.crossing = Math.max(0, b.health - 15);
    }
    s.bridgeLegacy = {
      condition: b.phase,
      operation: o.id,
      community: s.communities[o.commander]?.name,
    };
    w.event(
      "bridge",
      b.phase === "secured"
        ? "The crossing stands. Its repaired defenses remain for the next convoy."
        : "The line broke. The convoy escapes with hull damage; the damaged crossing remains.",
      { operation: o.id, crossing: s.crossing, kills: b.kills },
    );
  }
  b.enemies = b.enemies.filter(
    (e) => e.hp > 0 || b.shots.some((x) => x.id === e.id),
  );
  o.director.cue =
    b.phase === "defend"
      ? b.decision
        ? "Hold the line: assault stops raiders; fortify rebuilds the barricade; scouts slow their approach."
        : "The bridge is under attack. Spend 10 reserves on emergency repairs, hold with the community, or rush through and leave it damaged."
      : b.phase === "secured"
        ? "The raiders fall. Escorts, bring the convoy home."
        : "The crossing is damaged. Bring the survivors home.";
  return true;
}
export function bridgeCommand(w, channel, action) {
  const s = w.s,
    o = s.operation,
    b = o?.bridge;
  if (o?.commander !== channel)
    throw Error(
      "Only the current commander can decide the fate of the crossing.",
    );
  if (b?.phase !== "defend" || b.decision)
    throw Error("There is no open bridge decision.");
  if (action === "bridge-repair") {
    if (s.supplies < 10)
      throw Error("Emergency repairs cost 10 shared reserves.");
    s.supplies -= 10;
    b.repairTicks = 2;
    b.decision = "repair";
  } else if (action === "bridge-rush") {
    b.decision = "rush";
    b.phase = "abandoned";
    s.crossing = Math.max(0, b.health - 25);
    b.health = s.crossing;
    o.progress = Math.min(99, o.progress + 18);
    o.hull = Math.max(0, o.hull - 8);
    s.bridgeLegacy = {
      condition: "abandoned",
      operation: o.id,
      community: s.communities[channel].name,
    };
  } else if (action === "bridge-hold") b.decision = "hold";
  else throw Error("Unknown bridge decision");
  o.director.cue =
    action === "bridge-repair"
      ? "Emergency repairs committed. Keep the raiders away while the builders reinforce the line."
      : action === "bridge-rush"
        ? "The commander abandons the crossing. The damaged bridge remains for the next convoy."
        : "The commander trusts the community to hold the crossing.";
}
