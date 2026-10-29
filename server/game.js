import { randomUUID } from "node:crypto";
export const TEAMS = ["red", "blue"];
export const COMMANDS = ["attack", "defend", "heal", "surge"];
const team = () => ({
  line: 100,
  shield: false,
  power: false,
  surgeAt: -30000,
  frenzyUntil: 0,
});
export class Game {
  constructor({
    host = "",
    save = () => {},
    season = { red: 0, blue: 0 },
    blockedNames = [],
    blockedCommands = [],
  } = {}) {
    this.host = host.toLowerCase();
    this.save = save;
    this.season = { ...season };
    this.stream = { red: 0, blue: 0 };
    this.blockedNames = new Set(blockedNames.map((x) => x.toLowerCase()));
    this.blockedCommands = new Set(blockedCommands);
    this.players = new Map();
    this.status = "lobby";
    this.round = 0;
    this.elapsed = 0;
    this.teams = { red: team(), blue: team() };
    this.votes = new Map();
    this.active = new Set();
    this.last = "Pick a team: !human or !zombie";
    this.events = [];
    this.fogUntil = 0;
    this.freezeUntil = 0;
    this.cleared = false;
    this.winner = null;
    this.simulated = false;
    this.fxSequence = 0;
    this.effects = [];
    this.barrageReady = { red: 0, blue: 0 };
    this.participation = new Map();
    this.actionCounts = new Map();
    this.recap = null;
    this.intents = new Map();
    this.resolvedActions = new Map();
  }
  get cadence() {
    return this.economy && !this.tabletop?.enabled ? 6000 : 2000;
  }
  effect(kind, team, extra = {}) {
    this.effects.push({ id: ++this.fxSequence, kind, team, ...extra });
    this.effects = this.effects.slice(-32);
  }
  canBarrage(name) {
    if (this.economyBusy) return false;
    const t = this.players.get(name);
    return (
      !this.tabletop?.enabled &&
      this.territory?.s.status !== "active" &&
      this.status === "running" &&
      this.elapsed >= this.freezeUntil &&
      t &&
      name !== this.host &&
      !this.blockedNames.has(name) &&
      !this.blockedCommands.has("!barrage") &&
      this.elapsed >= this.barrageReady[t]
    );
  }
  barrageShot(name) {
    if (this.economyBusy) return false;
    if (this.tabletop?.enabled || this.territory?.s.status === "active")
      return false;
    const t = this.players.get(name);
    if (
      this.status !== "running" ||
      this.elapsed < this.freezeUntil ||
      !t ||
      name === this.host ||
      this.blockedNames.has(name) ||
      this.blockedCommands.has("!barrage")
    )
      return false;
    const other = t === "red" ? "blue" : "red";
    const damage = this.teams[other].shield ? 1.5 : 3;
    this.teams[other].shield = false;
    this.teams[other].line = Math.max(0, this.teams[other].line - damage);
    this.active.add(name);
    this.effect("barrage", t, { name, damage });
    this.say(`BARRAGE · ${name} · ${t.toUpperCase()} fires −${damage}`);
    if (this.teams[other].line === 0) this.finish();
    return true;
  }
  say(text) {
    text = text
      .replace(/\bred\b/gi, "HUMANS")
      .replace(/\bblue\b/gi, "ZOMBIES")
      .replace(
        /(HUMANS|ZOMBIES) (attacks|defends|heals|surges)/g,
        (_, team, verb) => `${team} ${verb.slice(0, -1)}`,
      );
    if (this.economy?.d.factions)
      text = text
        .replace(/\bHUMANS\b/g, this.economy.d.factions.red)
        .replace(/\bZOMBIES\b/g, this.economy.d.factions.blue);
    this.last = text;
    this.events.unshift(text);
    this.events = this.events.slice(0, 5);
  }
  start() {
    if (this.status === "running" || this.status === "paused") return false;
    for (const [name] of this.players) {
      const character =
        this.campaign?.data.characters[this.campaign.names.get(name)];
      if (character?.infected && (!this.economy || this.economy.d.outbreak)) {
        this.players.set(name, "blue");
        character.faction = "blue";
      }
    }
    this.round++;
    this.battleId = randomUUID();
    this.actionCounts.clear();
    this.elapsed = 0;
    this.nextTick = this.cadence;
    this.intents.clear();
    this.resolvedActions.clear();
    this.teams = { red: team(), blue: team() };
    this.active.clear();
    this.participation.clear();
    this.recap = null;
    this.votes.clear();
    this.status = "running";
    this.cleared = false;
    this.winner = null;
    this.fogUntil = 0;
    this.freezeUntil = 0;
    this.events = [];
    this.say("Battle started. Vote now!");
    this.barrageReady = { red: 0, blue: 0 };
    this.effects = [];
    return true;
  }
  pause() {
    if (this.status === "running") {
      this.status = "paused";
      this.votes.clear();
      this.say("Battle paused");
    } else if (this.status === "paused") {
      this.status = "running";
      this.cleared = false;
      this.say("Battle resumed");
    }
  }
  kill() {
    if (this.status === "running") this.status = "paused";
    this.votes.clear();
    this.intents.clear();
    if (this.show) this.show.auto = false;
    this.cleared = true;
  }
  counts() {
    const n = { red: 0, blue: 0 };
    for (const name of this.active) {
      const t = this.players.get(name);
      if (t) n[t]++;
    }
    return n;
  }
  chat(name, text) {
    name = String(name).toLowerCase();
    text = String(text).trim().toLowerCase();
    if (
      !/^[a-z0-9_]{1,25}$/.test(name) ||
      name === this.host ||
      this.blockedNames.has(name) ||
      this.blockedCommands.has(text)
    )
      return false;
    if (text === "!join") {
      if (this.players.has(name)) return false;
      const character =
        this.campaign?.data.characters[this.campaign.names.get(name)];
      const roster = { red: 0, blue: 0 };
      for (const side of this.players.values()) roster[side]++;
      const side =
        character?.infected && (!this.economy || this.economy.d.outbreak)
          ? "blue"
          : character?.faction || (roster.red <= roster.blue ? "red" : "blue");
      this.players.set(name, side);
      this.effect("join", side, { name });
      return true;
    }
    const raw = text.slice(1);
    const cmd = raw === "human" ? "red" : raw === "zombie" ? "blue" : raw;
    if (!text.startsWith("!")) return false;
    if (["human", "zombie"].includes(raw)) {
      if (
        (this.status === "running" || this.status === "paused") &&
        this.players.has(name)
      )
        return false;
      this.players.set(name, cmd);
      this.effect("join", cmd, { name });
      return true;
    }
    if (
      this.status !== "running" ||
      this.elapsed < this.freezeUntil ||
      !COMMANDS.includes(cmd) ||
      !this.players.has(name) ||
      this.votes.has(name)
    )
      return false;
    this.active.add(name);
    this.votes.set(name, cmd);
    if (this.economy) this.intents.set(name, cmd);
    this.participation.set(name, (this.participation.get(name) || 0) + 1);
    const actions = this.actionCounts.get(name) || {};
    actions[cmd] = (actions[cmd] || 0) + 1;
    this.actionCounts.set(name, actions);
    return true;
  }
  totals() {
    const totals = {
      red: { attack: 0, defend: 0, heal: 0, surge: 0 },
      blue: { attack: 0, defend: 0, heal: 0, surge: 0 },
    };
    for (const [name, cmd] of this.economy ? this.intents : this.votes) {
      const t = this.players.get(name);
      totals[t][cmd] += this.teams[t].frenzyUntil > this.elapsed ? 2 : 1;
    }
    return totals;
  }
  advance(ms) {
    if (this.tabletop?.enabled || this.territory?.s.status === "active") return;
    if (this.status !== "running") return;
    this.elapsed = Math.min(180000, this.elapsed + ms);
    if (this.elapsed >= this.nextTick) {
      this.nextTick =
        Math.floor(this.elapsed / this.cadence + 1) * this.cadence;
      if (this.elapsed >= this.freezeUntil) this.tick();
      else this.votes.clear();
    }
    if (this.status === "running" && this.elapsed >= 180000) this.finish();
  }
  tick() {
    for (const name of this.intents.keys())
      this.resolvedActions.set(name, (this.resolvedActions.get(name) || 0) + 1);
    const totals = this.totals(),
      counts = this.counts(),
      selected = {};
    for (const t of TEAMS) {
      const max = Math.max(...Object.values(totals[t]));
      selected[t] = max ? COMMANDS.find((c) => totals[t][c] === max) : null;
    }
    this.votes.clear();
    const messages = [];
    // Resolve preparation/healing before simultaneous attacks, without team order advantage.
    for (const t of TEAMS) {
      const s = this.teams[t],
        cmd = selected[t];
      if (cmd === "defend") {
        this.effect("defend", t);
        s.shield = true;
        messages.push(`${t} defends`);
      }
      if (cmd === "heal") {
        this.effect("heal", t);
        const gain = this.economy
          ? 5
          : Math.min(15, 3 + Math.floor(counts[t] / 2));
        s.line = Math.min(100, s.line + gain);
        messages.push(`${t} heals +${gain}`);
      }
      if (cmd === "surge" && this.elapsed - s.surgeAt >= 30000) {
        this.effect("surge", t);
        s.power = true;
        s.surgeAt = this.elapsed;
        messages.push(`${t} charges a surge`);
      }
    }
    const damage = { red: 0, blue: 0 };
    for (const t of TEAMS) {
      if (selected[t] !== "attack") continue;
      const other = t === "red" ? "blue" : "red",
        s = this.teams[t],
        target = this.teams[other];
      damage[other] =
        (this.tabletop?.enabled
          ? this.tabletop.damage(t, (5 + counts[t]) * (s.power ? 2 : 1))
          : this.economy
            ? 8 * (s.power ? 2 : 1)
            : Math.min(25, (5 + counts[t]) * (s.power ? 2 : 1))) *
        (target.shield ? 0.5 : 1);
      s.power = false;
      target.shield = false;
      messages.push(`${t} attacks −${damage[other]}`);
      this.effect("attack", t, { damage: damage[other] });
    }
    for (const t of TEAMS)
      this.teams[t].line = Math.max(0, this.teams[t].line - damage[t]);
    if (messages.length) this.say(messages.join(" · "));
    if (TEAMS.some((t) => this.teams[t].line === 0)) this.finish();
  }
  finish() {
    if (this.status === "finished") return;
    const a = this.teams.red.line,
      b = this.teams.blue.line,
      n = this.counts();
    this.winner =
      a === 0 && b === 0
        ? "draw"
        : a !== b
          ? a > b
            ? "red"
            : "blue"
          : !this.economy && n.red !== n.blue
            ? n.red > n.blue
              ? "red"
              : "blue"
            : "draw";
    this.status = "finished";
    const leaders = [...this.participation]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3);
    this.recap = {
      round: this.round,
      winner: this.winner,
      participants: this.active.size,
      acceptedVotes: [...this.participation.values()].reduce(
        (a, b) => a + b,
        0,
      ),
      duration: Math.round(this.elapsed / 1000),
      contributors: leaders.map(([name, votes]) => ({ name, votes })),
      line: { red: a, blue: b },
    };
    this.effect("victory", this.winner);
    this.votes.clear();
    this.tabletop?.finish();
    this.campaign?.finish(this);
    this.show?.finished(this);
    if (this.winner !== "draw") {
      this.stream[this.winner]++;
      if (!this.simulated) {
        this.season[this.winner]++;
        this.save(this.season);
      }
    }
    this.say(
      this.winner === "draw"
        ? "Draw. Pick teams for the next battle."
        : `${this.winner.toUpperCase()} WIN · Team picking is open`,
    );
  }
  battlefield(kind) {
    if (this.status !== "running") return false;
    if (kind === "supply") {
      for (const t of TEAMS)
        this.teams[t].line = Math.min(100, this.teams[t].line + 5);
      this.say("SUPPLY DROP · +5 to both teams");
    } else if (kind === "fog") {
      this.fogUntil = this.elapsed + 10000;
      this.say("FOG · Vote totals hidden for 10 seconds");
    } else if (kind === "freeze") {
      this.freezeUntil = this.elapsed + 10000;
      this.votes.clear();
      this.say("FREEZE · Voting frozen for 10 seconds");
    } else return false;
    return true;
  }
  moment(kind, name) {
    name = String(name || "").toLowerCase();
    const t = this.players.get(name);
    if (
      this.status !== "running" ||
      !t ||
      name === this.host ||
      this.blockedNames.has(name)
    )
      return false;
    this.active.add(name);
    const s = this.teams[t];
    if (kind === "follow") s.line = Math.min(100, s.line + 2);
    else if (kind === "sub") s.power = true;
    else if (kind === "raid") s.line = Math.min(100, s.line + 5);
    else if (kind === "hype") {
      if (this.tabletop?.enabled) this.tabletop.frenzy[t] = true;
      else s.frenzyUntil = this.elapsed + 60000;
    } else return false;
    this.say(
      `${kind.toUpperCase()} · ${name} reinforces ${t.toUpperCase()}${kind === "hype" ? (this.tabletop?.enabled ? " · FRENZY +3 next Attack" : " · FRENZY 60s") : ""}`,
    );
    return true;
  }
  snapshot() {
    return {
      creator: this.economy
        ? {
            title: this.economy.d.title,
            currency: this.economy.d.currency,
            factions: this.economy.d.factions,
          }
        : null,
      roster: this.economy?.roster(this, this.overlayKey),
      notice: this.notice?.until > Date.now() ? this.notice.text : null,
      show: this.show?.snapshot(),
      cadence: this.cadence,
      choiceRemaining: Math.max(
        0,
        Math.ceil(((this.nextTick || this.cadence) - this.elapsed) / 1000),
      ),
      recap: this.recap,
      territory: this.territory?.snapshot(),
      tabletop: this.tabletop?.snapshot(),
      environment: this.environment || {
        id: "default",
        name: "Neon battlefield",
        url: null,
      },
      campaign: this.campaign?.snapshot(),
      status: this.status,
      round: this.round,
      remaining: Math.ceil((180000 - this.elapsed) / 1000),
      teams: this.teams,
      counts: this.counts(),
      totals:
        this.tabletop?.enabled || this.elapsed < this.fogUntil
          ? null
          : this.totals(),
      last: this.last,
      events: this.events,
      stream: this.stream,
      season: this.season,
      winner: this.winner,
      cleared: this.cleared,
      simulated: this.simulated,
      effects: this.effects,
      barrageReady: this.barrageReady,
      elapsed: this.elapsed,
      fog: Math.max(0, Math.ceil((this.fogUntil - this.elapsed) / 1000)),
      freeze: Math.max(0, Math.ceil((this.freezeUntil - this.elapsed) / 1000)),
    };
  }
}
