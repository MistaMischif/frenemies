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
    return {
      mode: "PostgreSQL",
      data: Object.fromEntries(result.rows.map((r) => [r.id, r.payload])),
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
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  return {
    mode: "local JSON",
    data,
    async put(id, record) {
      data[id] = record;
      writeFileSync(file + ".tmp", JSON.stringify(data, null, 2));
      renameSync(file + ".tmp", file);
    },
    close: async () => {},
  };
}
