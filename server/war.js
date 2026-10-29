import { bridgeStep, bridgeCommand } from "./bridge.js";
import { createDirector, direct } from "./director.js";
import { createHash } from "node:crypto";
export const WAR_KEY = "__shared_war_v1";
const roles = ["escort", "fortify", "scout", "assault"];
export class War {
  constructor(data, { simulated = false, now = () => Date.now() } = {}) {
    this.now = now;
    this.simulated = simulated;
    this.s = data || {
      version: 1,
      sequence: 0,
      supplies: 60,
      integrity: 80,
      crossing: 50,
      deliveries: 0,
      losses: 0,
      communities: {},
      players: {},
      events: [],
      operation: null,
      accepted: 0,
      decisions: 0,
    };
    if (this.s.operation && !this.s.operation.director)
      this.s.operation.director = createDirector();
    if (this.s.operation)
      this.s.operation.visual ||= { actions: {}, decisions: {} };
    this.intents = new Map();
    this.lastTick = now();
    this.dirty = false;
  }
  event(kind, text, extra = {}) {
    this.s.events.push({
      sequence: ++this.s.sequence,
      at: this.now(),
      kind,
      text,
      ...extra,
    });
    this.s.events = this.s.events.slice(-2000);
    this.dirty = true;
  }
  enlist(id, name) {
    if (!this.s.communities[id])
      this.s.communities[id] = {
        name,
        joined: this.now(),
        actions: 0,
        decisions: 0,
      };
    this.s.communities[id].active = true;
    this.dirty = true;
  }
  command(channel, action) {
    if (
      !this.s.communities[channel] ||
      this.s.communities[channel].active === false
    )
      throw Error("Join the shared war first.");
    const s = this.s,
      c = s.communities[channel],
      o = s.operation;
    if (action === "launch") {
      if (o?.status === "active")
        throw Error("A convoy is already underway. Join its effort.");
      if (o && this.now() - o.ended < 15000)
        throw Error("Allow 15 seconds to read the result.");
      s.operation = {
        id: (o?.id || 0) + 1,
        status: "active",
        progress: 0,
        hull: Math.min(100, 60 + s.integrity * 0.5),
        pressure: 30,
        steps: 0,
        route: null,
        commander: channel,
        commandAt: this.now(),
        choices: {},
        contributions: {},
        started: this.now(),
        intel: 0,
        director: createDirector(),
        visual: { actions: {}, decisions: {} },
      };
      this.intents.clear();
      this.lastTick = this.now();
      this.event(
        "launch",
        `${c.name} dispatched convoy ${s.operation.id}. Scout the route before committing.`,
        { channel, operation: s.operation.id },
      );
      return;
    }
    if (!o || o.status !== "active") throw Error("Dispatch a convoy first.");
    if (action.startsWith("bridge-")) {
      bridgeCommand(this, channel, action);
    } else if (
      ["director-on", "director-off", "rescue", "press-on"].includes(action)
    ) {
      if (o.commander !== channel)
        throw Error(
          "Only the current commander can adjust the host or resolve its choice.",
        );
      const d = o.director;
      if (action.startsWith("director-")) {
        d.enabled = action === "director-on";
        d.phase = "build";
        d.ticks = 0;
        d.intensity = 0;
        if (!d.enabled) d.choice = null;
        d.cue = d.enabled
          ? "The host is watching the battlefield."
          : "The convoy follows the standard threat schedule.";
        d.cueId++;
      } else {
        if (!d.choice) throw Error("There is no pending rescue decision.");
        if (action === "rescue") {
          if (s.supplies < 10)
            throw Error("Rescue requires 10 shared reserves.");
          s.supplies -= 10;
          d.rescueTicks = 2;
          d.cue =
            "Rescue committed. The convoy holds for 12 active seconds while the crew boards.";
        } else
          d.cue =
            "The commander keeps the convoy moving. The supply mission comes first.";
        d.choice = null;
        d.cueId++;
      }
    } else if (action === "take-command") {
      if (
        this.s.communities[o.commander]?.active !== false &&
        this.now() - (o.commandAt || o.started) < 120000
      )
        throw Error(
          "Command handoff opens after 2 minutes without a commander decision, or when the commander leaves.",
        );
      o.commander = channel;
    } else if (action === "direct" || action === "detour") {
      if (o.commander !== channel)
        throw Error("The dispatching commander chooses the route.");
      if (o.route) throw Error("The route is already committed.");
      if (o.intel < 3)
        throw Error(
          "Viewers must scout until route intel reaches 3 before the route decision.",
        );
      o.route = action;
      o.director.cue =
        action === "direct"
          ? "The convoy takes the exposed road. Escort it quickly and protect its flank."
          : "The convoy takes the longer route. Keep the crossing defended while it advances.";
      o.director.cueId++;
    } else if (action === "reserves") {
      if (o.choices[channel])
        throw Error(
          "This community already committed its reserves for this convoy.",
        );
      if (s.supplies < 15) throw Error("The shared reserve needs 15 supplies.");
      s.supplies -= 15;
      o.choices[channel] = true;
      o.hull = Math.min(100, o.hull + 25);
      o.pressure = Math.max(0, o.pressure - 20);
    } else if (action === "evacuate") {
      if (o.commander !== channel)
        throw Error("Only the dispatching commander can order evacuation.");
      s.integrity = Math.max(0, s.integrity - 5);
      this.finish("evacuated");
    } else throw Error("Unknown command.");
    if (o.commander === channel) o.commandAt = this.now();
    o.visual.decisions[action] = (o.visual.decisions[action] || 0) + 1;
    c.decisions++;
    s.decisions++;
    this.event("decision", `${c.name}: ${action}.`, {
      channel,
      action,
      operation: o.id,
      supplies: s.supplies,
      integrity: s.integrity,
    });
  }
  act(channel, userId, name, message) {
    const role = message.replace(/^!/, "");
    if (
      !/^[a-zA-Z0-9_]{1,25}$/.test(name) ||
      !userId ||
      !roles.includes(role) ||
      !this.s.communities[channel] ||
      this.s.communities[channel].active === false ||
      this.s.operation?.status !== "active"
    )
      return false;
    const key = createHash("sha256")
      .update("frenemies-war:" + userId)
      .digest("hex");
    const now = this.now(),
      old = this.s.players[key];
    if (old && now - old.last < 6000) return false;
    const day = new Date(now).toISOString().slice(0, 10);
    const p = old || {
      first: now,
      last: 0,
      actions: 0,
      channels: [],
      days: [],
    };
    p.last = now;
    p.actions++;
    if (!p.channels.includes(channel)) p.channels.push(channel);
    if (!p.days.includes(day)) p.days.push(day);
    this.s.players[key] = p;
    const counts = this.s.operation.visual.actions;
    counts[role] = (counts[role] || 0) + 1;
    this.s.accepted++;
    this.s.communities[channel].actions++;
    this.intents.set(key, {
      channel,
      role,
      name: String(name).slice(0, 25),
      at: now,
    });
    this.event("action", `${name}: ${role}`, {
      channel,
      participant: key,
      role,
      operation: this.s.operation.id,
    });
    return true;
  }
  tick() {
    const now = this.now(),
      o = this.s.operation;
    if (now - this.lastTick < 6000 || o?.status !== "active") return;
    this.lastTick = now;
    const intents = [...this.intents.values()].filter(
      (x) =>
        now - x.at <= 20000 && this.s.communities[x.channel]?.active !== false,
    );
    if (!intents.length) return; // An unattended front holds; no offline damage or catch-up ticks.
    const n = Object.fromEntries(
      roles.map((r) => [
        r,
        Math.min(12, Math.sqrt(intents.filter((x) => x.role === r).length) * 3),
      ]),
    );
    o.intel = Math.min(100, o.intel + n.scout);
    if (o.route) o.steps++;
    const before = {
      hull: o.hull,
      progress: o.progress,
      pressure: o.pressure,
      crossing: this.s.crossing,
    };
    // Scouting earns a decision without suffering a hidden pre-route attack.
    if (o.route) {
      const bridgeHeld = bridgeStep(this, n, intents);
      if (!bridgeHeld) {
        const d = o.director,
          pacing = direct(d, o);
        if (pacing.changed)
          this.event("host", d.cue, {
            operation: o.id,
            phase: d.phase,
            intensity: d.intensity,
          });
        if (
          d.enabled &&
          o.bridge?.phase !== "defend" &&
          !d.offered &&
          o.progress >= 25 &&
          o.progress < 80 &&
          o.hull >= 35 &&
          d.phase === "relax"
        ) {
          d.offered = true;
          d.choice = { remaining: 5 };
          d.cue =
            "Stranded crew spotted. Rescue: spend 10 reserves and stop for 12 active seconds to restore 5 settlement integrity. Or keep moving. Default: continue.";
          d.cueId++;
          this.event("host", d.cue, {
            operation: o.id,
            choice: "rescue",
            cost: 10,
            holdTicks: 2,
            benefit: 5,
          });
        } else if (d.choice && --d.choice.remaining <= 0) {
          d.choice = null;
          d.cue = "No diversion ordered. The convoy stays on its route.";
          d.cueId++;
          this.event("host", d.cue, { operation: o.id, default: "press-on" });
        }
        const held = d.rescueTicks > 0;
        if (held && --d.rescueTicks === 0) {
          d.rescued = true;
          this.s.integrity = Math.min(100, this.s.integrity + 5);
          d.cue =
            "Crew aboard. Settlement integrity restored by 5. The convoy resumes.";
          d.cueId++;
          this.event("rescue", d.cue, {
            operation: o.id,
            integrity: this.s.integrity,
          });
        }
        const exposed = o.route === "direct";
        o.pressure = Math.max(
          0,
          Math.min(
            100,
            o.pressure + pacing.spawn - n.assault * 0.9 - n.scout * 0.3,
          ),
        );
        this.s.crossing = Math.max(
          0,
          Math.min(100, this.s.crossing + n.fortify * 0.8 - 3),
        );
        const damage = Math.max(
          0,
          (pacing.engaged ? (exposed ? 6 : 3) : 0) +
            o.pressure / 15 -
            n.fortify * 0.6,
        );
        o.hull = Math.max(0, o.hull - damage);
        d.damage = damage;
        o.progress = Math.min(
          100,
          o.progress +
            (held
              ? 0
              : n.escort * (exposed ? 1.5 : 1) +
                (this.s.crossing >= 60 ? 3 : 0)),
        );
      }
    }
    if (
      o.bridge?.phase !== "defend" &&
      before.crossing < 60 &&
      this.s.crossing >= 60
    ) {
      const names = [
        ...new Set(
          intents
            .filter((x) => x.role === "fortify")
            .map((x) => this.s.communities[x.channel]?.name),
        ),
      ].filter(Boolean);
      this.event(
        "breakthrough",
        `${names.join(" + ")} secured the crossing. The convoy can move faster.`,
        { operation: o.id, crossing: this.s.crossing },
      );
    }
    for (const x of intents) {
      o.contributions[x.channel] = (o.contributions[x.channel] || 0) + 1;
    }
    this.event(
      "resolution",
      o.route
        ? `Convoy ${Math.round(o.progress)}% · hull ${Math.round(o.hull)} · pressure ${Math.round(o.pressure)}`
        : "Scouts are mapping the route. Commander: choose direct or detour.",
      {
        operation: o.id,
        before,
        after: {
          hull: o.hull,
          progress: o.progress,
          pressure: o.pressure,
          crossing: this.s.crossing,
        },
        roles: n,
        communities: Object.keys(o.contributions),
      },
    );
    if (o.route && (o.hull <= 0 || o.progress >= 100 || o.steps >= 90))
      this.finish(o.hull > 0 && o.progress >= 100 ? "delivered" : "lost");
  }
  finish(status) {
    const s = this.s,
      o = s.operation;
    o.status = status;
    o.ended = this.now();
    if (status === "delivered") {
      s.deliveries++;
      s.supplies = Math.min(300, s.supplies + 30);
      s.integrity = Math.min(100, s.integrity + 10);
    }
    if (status === "lost") {
      s.losses++;
      s.integrity = Math.max(0, s.integrity - 10);
      s.crossing = Math.max(0, s.crossing - 10);
    }
    this.event(
      "outcome",
      status === "delivered"
        ? "Supply route secured: +30 reserves, +10 settlement integrity."
        : status === "lost"
          ? "Convoy lost: −10 settlement integrity, −10 crossing control."
          : "Evacuation complete: settlement loses 5 integrity; remaining reserves preserved.",
      {
        operation: o.id,
        status,
        contributions: o.contributions,
        supplies: s.supplies,
        integrity: s.integrity,
        crossing: s.crossing,
      },
    );
    this.intents.clear();
  }
  report() {
    const players = Object.values(this.s.players);
    return {
      simulated: this.simulated,
      uniqueAccounts: players.length,
      acceptedActions: this.s.accepted,
      returningOnAnotherDay: players.filter((p) => p.days.length > 1).length,
      crossCommunityAccounts: players.filter((p) => p.channels.length > 1)
        .length,
      decisions: this.s.decisions,
      deliveries: this.s.deliveries,
      losses: this.s.losses,
      historicalParticipationBenchmark: 1165140,
      benchmarkLabel:
        "2014 TPP participation benchmark; not a Guinness qualification or unique-human count",
      evidenceFromSequence: this.s.events[0]?.sequence || 0,
      evidenceThroughSequence: this.s.sequence,
      limitations:
        "Accounts are deduplicated across channels; multiple accounts can belong to one person. Latest 2,000 events retained. No causal ROI, audience watch-time, or record certification inferred.",
    };
  }
  snapshot() {
    const { players, events, ...world } = this.s;
    return {
      ...world,
      operation: world.operation
        ? {
            ...world.operation,
            bridge: world.operation.bridge
              ? (({ seen, ...publicBridge }) => publicBridge)(
                  world.operation.bridge,
                )
              : undefined,
          }
        : null,
      visualRoles: Object.fromEntries(
        roles.map((role) => [
          role,
          this.s.operation?.status === "active"
            ? [...this.intents.values()].filter(
                (x) =>
                  x.role === role &&
                  this.now() - x.at <= 20000 &&
                  this.s.communities[x.channel]?.active !== false,
              ).length
            : 0,
        ]),
      ),
      simulated: this.simulated,
      events: events
        .filter((e) => e.kind !== "action" && e.kind !== "resolution")
        .slice(-15)
        .reverse(),
      recentActions: events
        .filter((e) => e.kind === "action")
        .slice(-8)
        .map(({ participant, ...e }) => e),
      metrics: this.report(),
    };
  }
}
