import { writeFile, rename } from "node:fs/promises";
import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import pg from "pg";

export async function openStorage({ databaseUrl, dataDir }) {
  if (databaseUrl) {
    const pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 1,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 15000,
    });
    pool.on("error", () => console.error("Database connection interrupted"));
    await pool.query(
      "CREATE TABLE IF NOT EXISTS frenemies_rooms (id text PRIMARY KEY, payload jsonb NOT NULL)",
    );
    const result = await pool.query("SELECT id, payload FROM frenemies_rooms");
    await pool.query(
      "CREATE TABLE IF NOT EXISTS frenemies_follow_claims (channel_id text NOT NULL, user_id text NOT NULL, PRIMARY KEY(channel_id,user_id))",
    );
    return {
      mode: "PostgreSQL",
      data: Object.fromEntries(result.rows.map((r) => [r.id, r.payload])),
      async claimFollow(channelId, userId) {
        const result = await pool.query(
          "INSERT INTO frenemies_follow_claims(channel_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING user_id",
          [channelId, userId],
        );
        return result.rowCount === 1;
      },
      async put(id, record) {
        await pool.query(
          "INSERT INTO frenemies_rooms (id,payload) VALUES ($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload",
          [id, JSON.stringify(record)],
        );
      },
      close: () => pool.end(),
    };
  }
  mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "scores.json");
  let data = {};
  const claimsFile = path.join(dataDir, "follow-claims.json");
  let claims = new Set();
  try {
    claims = new Set(JSON.parse(readFileSync(claimsFile, "utf8")));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const diskData = structuredClone(data);
  let localWrites = Promise.resolve();
  return {
    mode: "local JSON",
    data,
    async claimFollow(channelId, userId) {
      const key = JSON.stringify([channelId, userId]);
      if (claims.has(key)) return false;
      const next = new Set(claims);
      next.add(key);
      writeFileSync(claimsFile + ".tmp", JSON.stringify([...next]));
      renameSync(claimsFile + ".tmp", claimsFile);
      claims = next;
      return true;
    },
    async put(id, record) {
      const run = localWrites
        .catch(() => {})
        .then(async () => {
          diskData[id] = record;
          await writeFile(file + ".tmp", JSON.stringify(diskData));
          await rename(file + ".tmp", file);
        });
      localWrites = run;
      await run;
    },
    close: async () => {},
  };
}
