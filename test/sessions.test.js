import { test } from "node:test";
import assert from "node:assert/strict";
import { SessionStore } from "../server/sessions.js";
const call = (s, method, ...args) =>
  new Promise((resolve, reject) =>
    s[method](...args, (e, v) => (e ? reject(e) : resolve(v))),
  );
test("local sessions expire, enforce capacity, isolate mutation and never expose raw session IDs as keys", async () => {
  let now = 1000;
  const s = new SessionStore({}, { now: () => now, limit: 1 });
  try {
    const value = {
      cookie: { expires: new Date(2000).toISOString() },
      owner: "a",
    };
    await call(s, "set", "secret-id", value);
    value.owner = "other";
    assert.equal((await call(s, "get", "secret-id")).owner, "a");
    assert.equal(s.local.has("secret-id"), false);
    await assert.rejects(call(s, "set", "second", value), /capacity/);
    now = 2001;
    assert.equal(await call(s, "get", "secret-id"), null);
    await call(s, "set", "second", { cookie: {}, owner: "b" });
    await call(s, "destroy", "second");
    assert.equal(await call(s, "get", "second"), null);
  } finally {
    s.close();
  }
});
test("database session adapter persists through store recreation and handles revocation/errors", async () => {
  const rows = new Map(),
    storage = {
      sessions: {
        async get(id, now) {
          const r = rows.get(id);
          return r?.expires > now ? r.payload : null;
        },
        async set(id, payload, expires) {
          rows.set(id, { payload, expires });
        },
        async touch(id, expires) {
          rows.get(id).expires = expires;
        },
        async destroy(id) {
          rows.delete(id);
        },
        async prune(now) {
          for (const [id, r] of rows) if (r.expires <= now) rows.delete(id);
        },
      },
    };
  const a = new SessionStore(storage),
    b = new SessionStore(storage);
  try {
    await call(a, "set", "sid", { cookie: {}, viewer: { id: "viewer" } });
    assert.equal((await call(b, "get", "sid")).viewer.id, "viewer");
    await call(b, "destroy", "sid");
    assert.equal(await call(a, "get", "sid"), null);
    storage.sessions.get = async () => {
      throw Error("offline");
    };
    await assert.rejects(call(a, "get", "sid"), /offline/);
  } finally {
    a.close();
    b.close();
  }
});
