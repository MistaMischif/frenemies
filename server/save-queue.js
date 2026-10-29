// Coalesce bursts into one latest snapshot per channel. No game loop awaits I/O.
export class SaveQueue {
  constructor(write, status = () => {}) {
    this.write = write;
    this.status = status;
    this.states = new Map();
  }
  put(id, record) {
    let s = this.states.get(id);
    if (!s) {
      s = { running: false, pending: null, waiters: [] };
      this.states.set(id, s);
    }
    s.pending = record;
    const promise = new Promise((resolve, reject) =>
      s.waiters.push({ resolve, reject }),
    );
    this.drain(id, s);
    return promise;
  }
  async drain(id, s) {
    if (s.running) return;
    s.running = true;
    while (s.pending) {
      const record = s.pending,
        waiters = s.waiters;
      s.pending = null;
      s.waiters = [];
      this.status(id, "saving");
      try {
        await this.write(id, typeof record === "function" ? record() : record);
        for (const w of waiters) w.resolve();
        this.status(id, s.pending ? "saving" : "saved");
      } catch (e) {
        for (const w of waiters) w.reject(e);
        this.status(
          id,
          "SAVE FAILED — changes remain in memory; retry pending",
        );
      }
    }
    s.running = false;
  }
}
