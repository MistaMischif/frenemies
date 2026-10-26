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
    this.last = "Pick a team: !red or !blue";
    this.events = [];
    this.fogUntil = 0;
    this.freezeUntil = 0;
    this.cleared = false;
    this.winner = null;
    this.simulated = false;
  }
  say(text) {
    this.last = text;
    this.events.unshift(text);
    this.events = this.events.slice(0, 5);
  }
  start() {
    if (this.status === "running" || this.status === "paused") return false;
    this.round++;
    this.elapsed = 0;
    this.nextTick = 2000;
    this.teams = { red: team(), blue: team() };
    this.active.clear();
    this.votes.clear();
    this.status = "running";
    this.cleared = false;
    this.winner = null;
    this.fogUntil = 0;
    this.freezeUntil = 0;
    this.events = [];
    this.say("Battle started. Vote now!");
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
    const cmd = text.slice(1);
    if (!text.startsWith("!")) return false;
    if (TEAMS.includes(cmd)) {
      if (
        (this.status === "running" || this.status === "paused") &&
        this.players.has(name)
      )
        return false;
      this.players.set(name, cmd);
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
    return true;
  }
  totals() {
    const totals = {
      red: { attack: 0, defend: 0, heal: 0, surge: 0 },
      blue: { attack: 0, defend: 0, heal: 0, surge: 0 },
    };
    for (const [name, cmd] of this.votes) {
      const t = this.players.get(name);
      totals[t][cmd] += this.teams[t].frenzyUntil > this.elapsed ? 2 : 1;
    }
    return totals;
  }
  advance(ms) {
    if (this.status !== "running") return;
    this.elapsed = Math.min(180000, this.elapsed + ms);
    if (this.elapsed >= this.nextTick) {
      this.nextTick = Math.floor(this.elapsed / 2000 + 1) * 2000;
      if (this.elapsed >= this.freezeUntil) this.tick();
      else this.votes.clear();
    }
    if (this.status === "running" && this.elapsed >= 180000) this.finish();
  }
  tick() {
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
        s.shield = true;
        messages.push(`${t} defends`);
      }
      if (cmd === "heal") {
        const gain = Math.min(15, 3 + Math.floor(counts[t] / 2));
        s.line = Math.min(100, s.line + gain);
        messages.push(`${t} heals +${gain}`);
      }
      if (cmd === "surge" && this.elapsed - s.surgeAt >= 30000) {
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
        Math.min(25, (5 + counts[t]) * (s.power ? 2 : 1)) *
        (target.shield ? 0.5 : 1);
      s.power = false;
      target.shield = false;
      messages.push(`${t} attacks −${damage[other]}`);
    }
    for (const t of TEAMS)
      this.teams[t].line = Math.max(0, this.teams[t].line - damage[t]);
    if (messages.length) this.say(messages.join(" · "));
    if (TEAMS.some((t) => this.teams[t].line === 0)) this.finish();
  }
  finish() {
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
          : n.red !== n.blue
            ? n.red > n.blue
              ? "red"
              : "blue"
            : "draw";
    this.status = "finished";
    this.votes.clear();
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
        : `${this.winner.toUpperCase()} WINS · Team picking is open`,
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
    else if (kind === "hype") s.frenzyUntil = this.elapsed + 60000;
    else return false;
    this.say(
      `${kind.toUpperCase()} · ${name} reinforces ${t.toUpperCase()}${kind === "hype" ? " · FRENZY 60s" : ""}`,
    );
    return true;
  }
  snapshot() {
    return {
      status: this.status,
      round: this.round,
      remaining: Math.ceil((180000 - this.elapsed) / 1000),
      teams: this.teams,
      counts: this.counts(),
      totals: this.elapsed < this.fogUntil ? null : this.totals(),
      last: this.last,
      events: this.events,
      stream: this.stream,
      season: this.season,
      winner: this.winner,
      cleared: this.cleared,
      simulated: this.simulated,
      elapsed: this.elapsed,
      fog: Math.max(0, Math.ceil((this.fogUntil - this.elapsed) / 1000)),
      freeze: Math.max(0, Math.ceil((this.freezeUntil - this.elapsed) / 1000)),
    };
  }
}
