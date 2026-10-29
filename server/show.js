import { randomUUID } from "node:crypto";
const validText = (s, n) =>
  typeof s === "string" &&
  s.trim().length > 0 &&
  s.trim().length <= n &&
  !/[\x00-\x1f]/.test(s);
const objectives = ["play", "attack", "defend", "heal", "surge"];
export class Show {
  constructor(campaign, changed = () => {}) {
    this.campaign = campaign;
    this.changed = changed;
    this.auto = false;
    this.nextAt = null;
    this.emptyRounds = 0;
    campaign.data.show ||= { episodes: [], active: null, sessions: [] };
    // A restarted process must not silently resume a broadcast or autoplay.
    for (const s of this.d.sessions)
      if (!s.ended) {
        s.ended = Date.now();
        s.interrupted = true;
      }
  }
  get d() {
    return this.campaign.data.show;
  }
  get session() {
    return this.d.sessions.findLast((s) => !s.ended);
  }
  author(b) {
    if (b.action === "episode") {
      if (
        !validText(b.title, 60) ||
        !validText(b.intro, 240) ||
        !validText(b.success, 240) ||
        !validText(b.failure, 240) ||
        !objectives.includes(b.objective) ||
        !Number.isInteger(b.target) ||
        b.target < 1 ||
        b.target > 10000 ||
        !Number.isInteger(b.rounds) ||
        b.rounds < 1 ||
        b.rounds > 20
      )
        throw Error(
          "Complete episode text, objective, target 1-10000 and 1-20 battles.",
        );
      if (this.d.episodes.length >= 100 && !b.id)
        throw Error("Maximum 100 episodes.");
      const old = b.id ? this.d.episodes.find((e) => e.id === b.id) : null;
      if (b.id && !old) throw Error("Episode not found.");
      if (
        b.unlock &&
        !this.campaign.data.economy?.items.some(
          (i) => i.id === b.unlock && i.published,
        )
      )
        throw Error("Choose a published cosmetic reward.");
      const episode = {
        unlock: b.unlock || null,
        id: old?.id || randomUUID(),
        title: b.title.trim(),
        intro: b.intro.trim(),
        success: b.success.trim(),
        failure: b.failure.trim(),
        objective: b.objective,
        target: b.target,
        rounds: b.rounds,
        revision: (old?.revision || 0) + 1,
      };
      if (old) Object.assign(old, episode);
      else this.d.episodes.push(episode);
    } else if (b.action === "launch-episode") {
      const e = this.d.episodes.find((e) => e.id === b.id);
      if (!e) throw Error("Choose an episode.");
      if (this.d.active?.status === "active")
        throw Error("Finish or cancel the current episode first.");
      this.d.active = {
        ...structuredClone(e),
        runId: randomUUID(),
        members: [],
        progress: 0,
        played: 0,
        status: "active",
        receipts: [],
        events: [],
      };
      this.campaign.note(e.intro);
    } else if (b.action === "cancel-episode") {
      if (this.d.active?.status === "active") {
        this.d.active.status = "cancelled";
        this.campaign.note(
          "Creator ended the episode without a completion reward.",
        );
      }
    } else throw Error("Unknown show action.");
  }
  begin(
    { label = "Community show", kind = "game", pair = "" },
    now = Date.now(),
  ) {
    if (this.session) throw Error("End the current broadcast sample first.");
    if (
      !validText(label, 60) ||
      !["game", "control"].includes(kind) ||
      typeof pair !== "string" ||
      pair.length > 40
    )
      throw Error(
        "Use a label, game/control type and optional comparison key.",
      );
    this.d.sessions.push({
      id: randomUUID(),
      label,
      kind,
      pair,
      started: now,
      ended: null,
      joins: [],
      eligible: [],
      redemptions: [],
      subscriptionSupporters: [],
      battles: 0,
      events: {},
      operatorActions: 0,
    });
    this.d.sessions = this.d.sessions.slice(-100);
    this.changed();
  }
  end(b, now = Date.now()) {
    const s = this.session;
    if (!s) throw Error("No active broadcast sample.");
    const amounts = {};
    for (const k of ["receipts", "costs", "minutes", "hourlyRate"]) {
      const v = b[k];
      if (v === undefined || v === null || v === "") amounts[k] = null;
      else if (
        !Number.isFinite(Number(v)) ||
        Number(v) < 0 ||
        Number(v) > 1000000
      )
        throw Error("Use non-negative amounts up to 1,000,000.");
      else amounts[k] = Number(v);
    }
    Object.assign(s, amounts, { ended: now });
    this.auto = false;
    this.nextAt = null;
    this.changed();
  }
  joined(id) {
    const s = this.session;
    if (s && !s.joins.includes(id)) s.joins.push(id);
  }
  eligible(id) {
    const s = this.session;
    if (s && !s.eligible.includes(id)) s.eligible.push(id);
  }
  redeemed(id) {
    const s = this.session;
    if (s && !s.redemptions.includes(id)) s.redemptions.push(id);
  }
  event(type, receipt, event = {}) {
    const s = this.session;
    if (s) {
      s.events[type] = (s.events[type] || 0) + 1;
      if (
        ["channel.subscribe", "channel.subscription.gift"].includes(type) &&
        event.user_id
      ) {
        s.subscriptionSupporters ||= [];
        if (!s.subscriptionSupporters.includes(event.user_id))
          s.subscriptionSupporters.push(event.user_id);
      }
    }
    const a = this.d.active;
    if (a?.status === "active" && !a.events.includes(receipt)) {
      a.events.push(receipt);
      a.events = a.events.slice(-100);
      a.lastEvent =
        type === "channel.raid"
          ? "A visiting community joined the episode."
          : "Community support arrived.";
    }
  }
  finished(g, now = Date.now()) {
    if (this.session) this.session.battles++;
    this.emptyRounds = g.active.size ? 0 : this.emptyRounds + 1;
    if (this.emptyRounds >= 2) this.auto = false;
    this.nextAt = this.auto ? now + 30000 : null;
    const a = this.d.active;
    if (a?.status === "active" && !a.receipts.includes(g.battleId)) {
      a.receipts.push(g.battleId);
      a.played++;
      for (const [name, votes] of g.participation) {
        if (
          Math.max(votes, g.resolvedActions.get(name) || 0) < 2 ||
          !g.counts().red ||
          !g.counts().blue
        )
          continue;
        const id = this.campaign.names.get(name);
        if (id && !a.members.includes(id)) a.members.push(id);
        if (a.objective === "play" || g.actionCounts.get(name)?.[a.objective])
          a.progress = Math.min(a.target, a.progress + 1);
      }
      if (a.progress >= a.target || a.played >= a.rounds) {
        a.status = a.progress >= a.target ? "complete" : "missed";
        this.campaign.note(a.status === "complete" ? a.success : a.failure);
        if (a.status === "complete" && a.unlock) {
          for (const id of a.members) {
            const account = g.economy.account(id);
            if (!account.owned.includes(a.unlock)) account.owned.push(a.unlock);
          }
        }
      }
    }
    this.changed();
  }
  advance(g, start, now = Date.now()) {
    if (
      !this.auto ||
      !this.nextAt ||
      g.status !== "finished" ||
      g.cleared ||
      g.economyBusy
    )
      return;
    if (now >= this.nextAt) {
      this.nextAt = null;
      start();
    }
  }
  snapshot() {
    const a = this.d.active;
    return {
      auto: this.auto,
      nextAt: this.nextAt,
      session: this.session
        ? { label: this.session.label, kind: this.session.kind }
        : null,
      episode: a
        ? {
            title: a.title,
            intro: a.intro,
            objective: a.objective,
            target: a.target,
            progress: a.progress,
            played: a.played,
            rounds: a.rounds,
            status: a.status,
            ending:
              a.status === "complete"
                ? a.success
                : a.status === "missed"
                  ? a.failure
                  : null,
            lastEvent: a.lastEvent,
          }
        : null,
    };
  }
  analytics() {
    const closed = this.d.sessions.filter((s) => s.ended && !s.interrupted),
      games = closed.filter((s) => s.kind === "game");
    const retention = (n) => {
      let eligible = 0,
        returned = 0;
      for (let i = 0; i + n < games.length; i++) {
        const next = new Set(
          games.slice(i + 1, i + n + 1).flatMap((s) => s.eligible),
        );
        eligible += games[i].eligible.length;
        returned += games[i].eligible.filter((id) => next.has(id)).length;
      }
      return {
        eligible,
        returned,
        rate: eligible ? returned / eligible : null,
      };
    };
    const rows = this.d.sessions.map((s) => {
      const hours = ((s.ended || Date.now()) - s.started) / 3600000;
      const complete = ["receipts", "costs", "minutes", "hourlyRate"].every(
        (k) => Number.isFinite(s[k]),
      );
      return {
        id: s.id,
        label: s.label,
        kind: s.kind,
        pair: s.pair,
        started: s.started,
        ended: s.ended,
        interrupted: !!s.interrupted,
        hours,
        joins: s.joins.length,
        players: s.eligible.length,
        redeemers: s.redemptions.length,
        battles: s.battles,
        events: s.events,
        observedSubscriptionSupporters: (s.subscriptionSupporters || []).length,
        playersWithObservedSubscription: s.eligible.filter((id) =>
          (s.subscriptionSupporters || []).includes(id),
        ).length,
        playersWithoutObservedSubscription: s.eligible.filter(
          (id) => !(s.subscriptionSupporters || []).includes(id),
        ).length,
        operatorActions: s.operatorActions,
        receipts: s.receipts ?? null,
        costs: s.costs ?? null,
        minutes: s.minutes ?? null,
        hourlyRate: s.hourlyRate ?? null,
        contribution: complete
          ? s.receipts - s.costs - (s.minutes / 60) * s.hourlyRate
          : null,
      };
    });
    const pairs = [];
    for (const key of new Set(rows.filter((s) => s.pair).map((s) => s.pair))) {
      const members = rows.filter(
        (s) =>
          s.pair === key &&
          s.ended &&
          !s.interrupted &&
          s.hours > 0 &&
          s.contribution !== null,
      );
      const game = members.filter((s) => s.kind === "game"),
        control = members.filter((s) => s.kind === "control");
      if (game.length && control.length) {
        const perHour = (a) =>
          a.reduce((n, s) => n + s.contribution, 0) /
          a.reduce((n, s) => n + s.hours, 0);
        pairs.push({
          key,
          gameSamples: game.length,
          controlSamples: control.length,
          contributionLiftPerHour: perHour(game) - perHour(control),
        });
      }
    }
    return {
      definition:
        "Creator-marked broadcast samples, not verified Twitch live time. Return rates count player-session opportunities across subsequent game samples. Self-reported contribution is receipts minus costs and operator time; paired hourly differences are observational, not causal ROI.",
      nextBroadcast: retention(1),
      nextThree: retention(3),
      sessions: rows,
      pairs,
    };
  }
}
