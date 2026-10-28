import { readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";

// A reservation survives a crash and is returned on startup. Run one server process.
export async function openBarrageLedger({ databaseUrl, dataDir }) {
  const pool = databaseUrl
    ? new pg.Pool({
        connectionString: databaseUrl,
        max: 1,
        idleTimeoutMillis: 1000,
      })
    : null;
  const file = path.join(dataDir, "barrage.json");
  let rows = {};
  if (pool) {
    pool.on("error", () =>
      console.error("Barrage database connection interrupted"),
    );
    await pool.query(
      "CREATE TABLE IF NOT EXISTS frenemies_barrage (id text PRIMARY KEY, channel_id text NOT NULL, user_id text NOT NULL, remaining integer NOT NULL, reservation text)",
    );
    await pool.query(
      "UPDATE frenemies_barrage SET remaining=remaining+1,reservation=NULL WHERE reservation IS NOT NULL",
    );
  } else {
    try {
      rows = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    for (const r of Object.values(rows))
      if (r.reservation) {
        r.remaining++;
        r.reservation = null;
      }
    persist(rows);
  }
  function persist(next) {
    writeFileSync(file + ".tmp", JSON.stringify(next));
    renameSync(file + ".tmp", file);
    rows = next;
  }
  return {
    async grant(id, channel, user) {
      if (pool)
        return (
          (
            await pool.query(
              "INSERT INTO frenemies_barrage VALUES ($1,$2,$3,3,NULL) ON CONFLICT DO NOTHING RETURNING id",
              [id, channel, user],
            )
          ).rowCount === 1
        );
      if (Object.hasOwn(rows, id)) return false;
      persist({
        ...rows,
        [id]: { channel, user, remaining: 3, reservation: null },
      });
      return true;
    },
    async balance(channel, user) {
      if (pool)
        return Number(
          (
            await pool.query(
              "SELECT COALESCE(SUM(remaining),0) AS n FROM frenemies_barrage WHERE channel_id=$1 AND user_id=$2",
              [channel, user],
            )
          ).rows[0].n,
        );
      return Object.values(rows)
        .filter((r) => r.channel === channel && r.user === user)
        .reduce((n, r) => n + r.remaining, 0);
    },
    async reserve(channel, user) {
      const token = randomUUID();
      if (pool) {
        const r = await pool.query(
          "UPDATE frenemies_barrage SET remaining=remaining-1,reservation=$3 WHERE id=(SELECT id FROM frenemies_barrage WHERE channel_id=$1 AND user_id=$2 AND remaining>0 AND reservation IS NULL ORDER BY id LIMIT 1) AND remaining>0 AND reservation IS NULL RETURNING id",
          [channel, user, token],
        );
        return r.rowCount ? token : null;
      }
      const next = structuredClone(rows),
        r = Object.values(next).find(
          (r) =>
            r.channel === channel &&
            r.user === user &&
            r.remaining > 0 &&
            !r.reservation,
        );
      if (!r) return null;
      r.remaining--;
      r.reservation = token;
      persist(next);
      return token;
    },
    async settle(token, delivered) {
      if (pool) {
        await pool.query(
          "UPDATE frenemies_barrage SET remaining=remaining+$2,reservation=NULL WHERE reservation=$1",
          [token, delivered ? 0 : 1],
        );
        return;
      }
      const next = structuredClone(rows),
        r = Object.values(next).find((r) => r.reservation === token);
      if (r) {
        r.remaining += delivered ? 0 : 1;
        r.reservation = null;
        persist(next);
      }
    },
    close: () => (pool ? pool.end() : Promise.resolve()),
  };
}

export class BarrageRunner {
  constructor(ledger) {
    this.ledger = ledger;
    this.active = new Map();
    this.busy = false;
    this.error = null;
  }
  async activate(room, user, name) {
    const g = room.game,
      t = g.players.get(name),
      key = room.id + ":" + t;
    if (this.error || !g.canBarrage(name) || this.active.has(key)) return false;
    const item = {
      room,
      user,
      name,
      round: g.round,
      left: 3,
      next: g.elapsed + 2000,
      ready: false,
    };
    this.active.set(key, item);
    try {
      if (
        (await this.ledger.balance(room.id, user)) < 1 ||
        g.round !== item.round ||
        !g.canBarrage(name)
      ) {
        this.active.delete(key);
        return false;
      }
      g.barrageReady[t] = g.elapsed + 30000;
      item.ready = true;
      g.say(`BARRAGE READY · ${name} · up to 3 shots`);
      return true;
    } catch (e) {
      this.active.delete(key);
      throw e;
    }
  }
  async pump() {
    if (this.busy || this.error) return;
    this.busy = true;
    try {
      for (const [key, a] of this.active) {
        const g = a.room.game;
        if (
          g.round !== a.round ||
          g.status === "finished" ||
          g.status === "lobby"
        ) {
          this.active.delete(key);
          continue;
        }
        if (
          !a.ready ||
          g.status !== "running" ||
          g.elapsed < g.freezeUntil ||
          g.elapsed < a.next
        )
          continue;
        const token = await this.ledger.reserve(a.room.id, a.user);
        if (!token) {
          this.active.delete(key);
          continue;
        }
        const delivered = g.round === a.round && g.barrageShot(a.name);
        await this.ledger.settle(token, delivered);
        if (delivered) a.left--;
        a.next = g.elapsed + 2000;
        if (!a.left) this.active.delete(key);
      }
    } catch (e) {
      this.error =
        "Barrage paused: storage needs attention. Unused shots are saved.";
      console.error("Barrage ledger failure");
    } finally {
      this.busy = false;
    }
  }
}
