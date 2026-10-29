import { randomUUID } from "node:crypto";

export class Campaign {
  constructor(data = {}, changed = () => {}) {
    this.data = {
      chapter: 1,
      settlement: 70,
      supplies: 0,
      characters: {},
      chronicle: [],
      receipts: {},
      objective: null,
      ...structuredClone(data),
    };
    this.changed = changed;
    this.names = new Map();
    this.statusAt = new Map();
  }
  note(text) {
    this.data.chronicle.unshift({
      id: randomUUID(),
      chapter: this.data.chapter,
      text,
    });
    this.data.chronicle = this.data.chronicle.slice(0, 30);
  }
  identify(id, name) {
    if (!id) return;
    this.names.set(name, id);
    const c = this.data.characters[id];
    if (c && c.name !== name) {
      c.name = name;
      this.changed();
    }
  }
  join(id, name, faction) {
    if (!id) return;
    this.identify(id, name);
    let c = this.data.characters[id];
    if (!c) {
      c = this.data.characters[id] = {
        name,
        faction,
        stage: "Recruit",
        chapters: 0,
        wins: 0,
        infected: false,
        rescues: 0,
      };
      this.note(
        this.data.economy && !this.data.economy.outbreak
          ? `${name} joined the community.`
          : `${name} enters the outbreak as ${faction === "red" ? "Human" : "Zombie"}.`,
      );
    } else c.faction = faction;
    this.changed();
  }
  status(name, now = Date.now()) {
    const c = this.data.characters[this.names.get(name)];
    if (!c || now - (this.statusAt.get(name) || 0) < 15000) return null;
    this.statusAt.set(name, now);
    return `${c.name} · ${c.stage} · ${c.chapters} chapters · ${c.wins} wins${c.infected ? " · INFECTED — !rescue between battles" : ""}`;
  }
  rescue(name, game) {
    const c = this.data.characters[this.names.get(name)];
    if (
      !c?.infected ||
      !["lobby", "finished"].includes(game.status) ||
      this.data.supplies < 3
    )
      return false;
    this.data.supplies -= 3;
    c.infected = false;
    c.rescues++;
    this.note(
      `${name} recovered at the clinic. Three community supplies used.`,
    );
    this.changed();
    return true;
  }
  finish(game) {
    game.economy?.finish(game);
    const d = this.data;
    if (!game.active.size) {
      this.note("Quiet chapter: no participants, settlement unchanged.");
      d.chapter++;
      this.changed();
      return;
    }
    if (d.economy && !d.economy.outbreak && !game.tabletop?.enabled) {
      for (const name of game.active) {
        const c = d.characters[this.names.get(name)];
        if (c) {
          c.chapters++;
          if (game.players.get(name) === game.winner) c.wins++;
        }
      }
      this.note(
        `Battle ${game.round}: ${game.winner === "draw" ? "draw" : (d.economy.factions?.[game.winner] || game.winner) + " victory"}. ${game.active.size} participants.`,
      );
      d.chapter++;
      this.changed();
      return;
    }
    d.settlement = Math.max(
      0,
      Math.min(
        100,
        d.settlement +
          (game.winner === "red" ? 10 : game.winner === "blue" ? -10 : 0),
      ),
    );
    d.supplies = Math.min(99, d.supplies + 3); // Earned by free participation, every chapter.
    for (const name of game.active) {
      const c = d.characters[this.names.get(name)];
      if (!c) continue;
      c.chapters++;
      if (game.players.get(name) === game.winner) c.wins++;
      c.stage = c.chapters >= 5 ? "Veteran" : "Survivor";
      if (
        game.players.get(name) === "red" &&
        game.winner === "blue" &&
        !c.infected
      ) {
        c.infected = true;
        this.note(`${name} was infected in the breach. The clinic can help.`);
      }
    }
    if (d.objective) {
      this.note(
        `${d.objective.title}: ${game.winner === "red" ? "evacuation secured" : game.winner === "blue" ? "convoy overrun" : "stalemate; convoy withdrew"}.`,
      );
      if (game.winner === "red") d.supplies = Math.min(99, d.supplies + 3);
      d.objective = null;
    }
    this.note(
      `Chapter ${d.chapter}: ${game.winner === "draw" ? "stalemate" : game.winner === "red" ? "Humans held the settlement" : "Zombies breached the settlement"}. +3 community supplies.`,
    );
    if (!d.settlement) {
      this.note(
        "Settlement evacuated. Survivors establish a new refuge at 50 integrity.",
      );
      d.settlement = 50;
    }
    d.chapter++;
    this.changed();
  }
  event(type, event, receipt, now = Date.now()) {
    const d = this.data;
    if (!receipt || d.receipts[receipt]) return false;
    const supported = [
      "channel.raid",
      "channel.hype_train.begin",
      "channel.subscribe",
      "channel.subscription.gift",
    ];
    if (
      !supported.includes(type) ||
      (type === "channel.subscribe" && event.is_gift)
    )
      return false;
    d.receipts = Object.fromEntries(
      Object.entries(d.receipts).filter(([, at]) => now - at < 86400000),
    );
    d.receipts[receipt] = now;
    if (d.economy && !d.economy.outbreak) {
      this.note(
        type === "channel.raid"
          ? "A visiting community brought reinforcements."
          : "Community support joined the show.",
      );
      return true;
    }
    if (type === "channel.raid" || type === "channel.hype_train.begin") {
      if (!d.objective) {
        d.objective = {
          title:
            type === "channel.raid" ? "Raid rescue convoy" : "Hype evacuation",
          source: type,
        };
        this.note(
          `${d.objective.title} arrives. Next completed battle decides its fate; Human victory earns 3 supplies.`,
        );
      } else
        this.note(
          "Reinforcements reached the active convoy. Its reward remains capped.",
        );
    } else {
      d.supplies = Math.min(99, d.supplies + 1);
      this.note(
        "Community support stocked the clinic: +1 supply. Free battles also earn supplies.",
      );
    }
    return true;
  }
  snapshot() {
    const { chapter, settlement, supplies, chronicle, objective } = this.data;
    return {
      mode:
        this.data.economy && !this.data.economy.outbreak
          ? "creator"
          : "outbreak",
      chapter,
      settlement,
      supplies,
      chronicle,
      objective,
      population: Object.keys(this.data.characters).length,
    };
  }
}
