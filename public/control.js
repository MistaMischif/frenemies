let csrf;
const el = (id) => document.getElementById(id);
async function update() {
  try {
    const r = await fetch("/api/control");
    if (!r.ok)
      throw new Error(
        "Sign in with Twitch or start a simulated demo from the home page.",
      );
    const d = await r.json();
    csrf = d.csrf;
    el("demo-barrage").hidden = !d.state.simulated;
    el("mode").textContent = d.state.simulated ? "SIMULATED CHAT" : "";
    el("channel").textContent = `Channel: ${d.channel}`;
    el("overlay").value = d.overlay;
    el("preview").href = d.overlay;
    el("state").textContent =
      `${d.state.status.toUpperCase()} · ${d.state.remaining}s · ${d.state.last}`;
    el("integration").textContent =
      `Chat: ${d.integration.chat}\nScores: ${d.integration.storage}\nBarrage: ${d.barrage}\n` +
      d.integration.subscriptions
        .map((s) => `${s.type}: ${s.status}`)
        .join("\n");
  } catch (e) {
    el("state").textContent = e.message;
  }
}
document.querySelectorAll("[data-action]").forEach((b) =>
  b.addEventListener("click", async () => {
    b.disabled = true;
    try {
      const r = await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ action: b.dataset.action }),
      });
      if (!r.ok) throw new Error("Action failed. Refresh and sign in again.");
      await update();
    } catch (e) {
      el("state").textContent = e.message;
    } finally {
      b.disabled = false;
    }
  }),
);
update();
setInterval(update, 1000);
