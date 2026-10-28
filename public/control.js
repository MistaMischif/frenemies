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
    el("demo-convoy").hidden = !d.state.simulated;
    const campaign = d.state.campaign;
    if (campaign) {
      el("campaign-summary").textContent = `Chapter ${campaign.chapter} · Refuge ${campaign.settlement}/100 · ${campaign.supplies} supplies · ${campaign.population} characters · ${campaign.objective?.title || "No active convoy"}`;
      el("chronicle").replaceChildren(...campaign.chronicle.slice(0, 10).map((entry) => {
        const item = document.createElement("li"); item.textContent = entry.text; return item;
      }));
    }
    el("mode").textContent = d.state.simulated ? "SIMULATED CHAT" : "";
    el("channel").textContent = `Channel: ${d.channel}`;
    el("overlay").value = d.overlay;
    el("preview").href = d.overlay;
    if (el("battle-preview").getAttribute("src") !== d.overlay)
      el("battle-preview").src = d.overlay;
    el("battle-events").replaceChildren(...(d.state.events || []).map((event) => {
      const item = document.createElement("li");
      item.textContent = event;
      return item;
    }));
    document.querySelector('[data-action="pause"]').textContent =
      d.state.status === "paused" ? "Resume battle" : "Pause battle";
    document.querySelector('[data-action="pause"]').disabled =
      !["running", "paused"].includes(d.state.status);
    for (const action of ["start", "next"]) {
      document.querySelector(`[data-action="${action}"]`).hidden =
        action === "start" ? d.state.round > 0 : d.state.round === 0;
      document.querySelector(`[data-action="${action}"]`).disabled =
        ["running", "paused"].includes(d.state.status);
    }
    el("demo-barrage").disabled = d.state.status !== "running" || !!d.state.freeze;
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
      await update();
    }
  }),
);
update();
setInterval(update, 1000);

function resizePreview() {
  const width = el("preview-stage").clientWidth;
  el("battle-preview").style.transform = `scale(${width / 1280})`;
}
new ResizeObserver(resizePreview).observe(el("preview-stage"));
async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const label = button.textContent;
    button.textContent = "Copied!";
    setTimeout(() => { button.textContent = label; }, 1800);
    el("copy-status").textContent = "Copied to clipboard.";
  } catch {
    el("copy-status").textContent = "Select the text above and copy it manually.";
  }
}
el("copy-overlay").addEventListener("click", (e) => copyText(el("overlay").value, e.currentTarget));
el("copy-instructions").addEventListener("click", (e) => copyText(el("chat-instructions").textContent, e.currentTarget));

