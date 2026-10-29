import session from "express-session";
import { createHash } from "node:crypto";
// PostgreSQL uses the established database; local operation keeps bounded, expiring sessions.
export class SessionStore extends session.Store {
  constructor(storage, { now = () => Date.now(), limit = 10000 } = {}) {
    super();
    this.storage = storage;
    this.now = now;
    this.limit = limit;
    this.local = new Map();
    this.lastDatabasePrune = 0;
    if (!storage.sessions) {
      this.timer = setInterval(() => this.prune().catch(() => {}), 60000);
      this.timer.unref();
    }
  }
  key(sid) {
    return createHash("sha256").update(sid).digest("hex");
  }
  expiry(value) {
    const parsed = Date.parse(value.cookie?.expires);
    return Number.isFinite(parsed) ? parsed : this.now() + 12 * 3600000;
  }
  get(sid, callback) {
    const key = this.key(sid);
    Promise.resolve()
      .then(async () => {
        if (this.storage.sessions)
          return this.storage.sessions.get(key, this.now());
        const row = this.local.get(key);
        if (!row || row.expires <= this.now()) {
          this.local.delete(key);
          return null;
        }
        return JSON.parse(row.payload);
      })
      .then((v) => callback(null, v), callback);
  }
  set(sid, value, callback = () => {}) {
    Promise.resolve()
      .then(async () => {
        const key = this.key(sid),
          expires = this.expiry(value),
          payload = JSON.stringify(value);
        if (Buffer.byteLength(payload) > 16384)
          throw Error("Session exceeds size limit");
        if (this.storage.sessions) {
          // Cleanup only with activity, so idle hosted databases can suspend.
          if (this.now() - this.lastDatabasePrune > 3600000) {
            await this.prune();
            this.lastDatabasePrune = this.now();
          }
          return this.storage.sessions.set(key, JSON.parse(payload), expires);
        }
        await this.prune();
        if (!this.local.has(key) && this.local.size >= this.limit)
          throw Error("Local session capacity reached");
        this.local.set(key, { payload, expires });
      })
      .then(() => callback(), callback);
  }
  touch(sid, value, callback = () => {}) {
    Promise.resolve()
      .then(async () => {
        const key = this.key(sid),
          expires = this.expiry(value);
        if (this.storage.sessions)
          return this.storage.sessions.touch(key, expires);
        const row = this.local.get(key);
        if (row) row.expires = expires;
      })
      .then(() => callback(), callback);
  }
  destroy(sid, callback = () => {}) {
    Promise.resolve()
      .then(() =>
        this.storage.sessions
          ? this.storage.sessions.destroy(this.key(sid))
          : this.local.delete(this.key(sid)),
      )
      .then(() => callback(), callback);
  }
  async prune() {
    if (this.storage.sessions) return this.storage.sessions.prune(this.now());
    for (const [id, row] of this.local)
      if (row.expires <= this.now()) this.local.delete(id);
  }
  close() {
    clearInterval(this.timer);
  }
}
