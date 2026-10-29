let csrf,
  overlayBase = "";
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
    updateEnvironments(d);
    el("auto-show").textContent = d.state.show?.auto
      ? "Disable automatic battles"
      : "Enable automatic battles";
    const episode = d.state.show?.episode;
    el("show-state").textContent =
      (d.state.show?.auto ? "Automatic battles ON. " : "Manual battles. ") +
      (d.state.show?.nextAt
        ? "Next starts in " +
          Math.max(0, Math.ceil((d.state.show.nextAt - Date.now()) / 1000)) +
          "s. "
        : "") +
      (episode
        ? episode.title +
          " · " +
          episode.progress +
          "/" +
          episode.target +
          " · " +
          episode.status
        : "");
    el("demo-barrage").hidden = !d.state.simulated;
    el("demo-convoy").hidden = !d.state.simulated;
    const campaign = d.state.campaign;
    if (campaign) {
      el("outbreak-help").hidden = campaign.mode !== "outbreak";
      el("campaign-summary").textContent =
        campaign.mode !== "outbreak"
          ? `${campaign.population} community characters · ${campaign.chapter - 1} completed chapters`
          : `Chapter ${campaign.chapter} · Refuge ${campaign.settlement}/100 · ${campaign.supplies} supplies · ${campaign.population} characters · ${campaign.objective?.title || "No active convoy"}`;
      el("chronicle").replaceChildren(
        ...campaign.chronicle.slice(0, 10).map((entry) => {
          const item = document.createElement("li");
          item.textContent = entry.text;
          return item;
        }),
      );
    }
    el("mode").textContent = d.state.simulated ? "SIMULATED CHAT" : "";
    el("channel").textContent = `Channel: ${d.channel}`;
    overlayBase = d.overlay;
    applyLayout();
    el("legacy-mode").hidden = !(
      d.state.territory?.status === "active" || d.state.tabletop?.enabled
    );
    const recap = d.state.recap;
    el("battle-recap").textContent = recap
      ? `Battle ${recap.round}: ${recap.winner === "draw" ? "Draw" : (d.state.creator?.factions?.[recap.winner] || recap.winner) + " win"} · ${recap.participants} participants · ${recap.acceptedVotes} accepted chat votes · ${recap.duration}s. Most accepted votes: ${recap.contributors.map((c) => c.name + " (" + c.votes + ")").join(", ") || "none"}.`
      : "Finish a battle to see participation and results.";
    el("copy-recap").disabled = !recap;
    el("battle-events").replaceChildren(
      ...(d.state.events || []).map((event) => {
        const item = document.createElement("li");
        item.textContent = event;
        return item;
      }),
    );
    document.querySelector('[data-action="pause"]').textContent =
      d.state.status === "paused" ? "Resume battle" : "Pause battle";
    document.querySelector('[data-action="pause"]').disabled = ![
      "running",
      "paused",
    ].includes(d.state.status);
    for (const action of ["start", "next"]) {
      document.querySelector(`[data-action="${action}"]`).hidden =
        action === "start" ? d.state.round > 0 : d.state.round === 0;
      document.querySelector(`[data-action="${action}"]`).disabled = [
        "running",
        "paused",
      ].includes(d.state.status);
    }
    el("demo-barrage").disabled =
      d.state.status !== "running" || !!d.state.freeze;
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
    setTimeout(() => {
      button.textContent = label;
    }, 1800);
    el("copy-status").textContent = "Copied to clipboard.";
  } catch {
    el("copy-status").textContent =
      "Select the text above and copy it manually.";
  }
}
el("copy-overlay").addEventListener("click", (e) =>
  copyText(el("overlay").value, e.currentTarget),
);
el("copy-instructions").addEventListener("click", (e) =>
  copyText(el("chat-instructions").textContent, e.currentTarget),
);

let environmentCatalog = [],
  environmentSignature = "";
function environmentPreview() {
  const choice = environmentCatalog.find(
    (e) => e.id === el("environment-choice").value,
  );
  const scenic = window.FrenemiesScenes.has(choice?.id);
  const canvas = el("scene-preview");
  canvas.hidden = !scenic;
  if (scenic)
    window.FrenemiesScenes.ready.then(() => {
      if (el("environment-choice").value !== choice.id) return;
      const ctx = canvas.getContext("2d");
      window.FrenemiesScenes.background(
        ctx,
        canvas.width,
        canvas.height,
        choice.id,
      );
      window.FrenemiesScenes.foreground(
        ctx,
        canvas.width,
        canvas.height,
        choice.id,
      );
    });
  el("environment-preview").hidden = scenic || !choice?.url;
  if (choice?.url) el("environment-preview").src = choice.url;
}
function updateEnvironments(d) {
  environmentCatalog = d.environments || [];
  const signature = JSON.stringify(environmentCatalog);
  if (signature !== environmentSignature) {
    const previous = el("environment-choice").value;
    el("environment-choice").replaceChildren(
      ...environmentCatalog.map((e) => {
        const option = document.createElement("option");
        option.value = e.id;
        option.textContent = window.FrenemiesScenes.has(e.id)
          ? window.FrenemiesScenes.title(e.id)
          : e.name;
        return option;
      }),
    );
    el("environment-choice").value = environmentCatalog.some(
      (e) => e.id === previous,
    )
      ? previous
      : d.nextEnvironment;
    environmentSignature = signature;
    environmentPreview();
  }
  el("environment-current").textContent =
    `Current battle: ${window.FrenemiesScenes.has(d.state.environment?.id) ? window.FrenemiesScenes.title(d.state.environment.id) : d.state.environment?.name || "Neon battlefield"} · Next battle: ${window.FrenemiesScenes.has(d.nextEnvironment) ? window.FrenemiesScenes.title(d.nextEnvironment) : environmentCatalog.find((e) => e.id === d.nextEnvironment)?.name || "Neon battlefield"}`;
}
async function saveEnvironment(body) {
  const response = await fetch("/api/environments", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Could not save environment.");
  await update();
  el("environment-choice").value = result.nextEnvironment;
  environmentPreview();
  el("environment-status").textContent =
    "Saved for the next battle. The current battle is unchanged.";
}
el("environment-choice").addEventListener("change", environmentPreview);
el("assign-environment").addEventListener("click", async () => {
  const button = el("assign-environment");
  button.disabled = true;
  try {
    await saveEnvironment({
      action: "select",
      id: el("environment-choice").value,
    });
  } catch (error) {
    el("environment-status").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
el("environment-upload").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = el("upload-environment");
  button.disabled = true;
  let bitmap;
  try {
    const file = el("environment-file").files[0];
    if (
      !file ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    )
      throw new Error("Choose a PNG, JPEG or WebP under 10 MB.");
    bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > 40000000)
      throw new Error("Image dimensions are too large (40 megapixel limit).");
    const scale = Math.min(1, 1600 / bitmap.width, 900 / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#101b2a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let image = canvas.toDataURL("image/jpeg", 0.85);
    if (image.length > 690000) image = canvas.toDataURL("image/jpeg", 0.6);
    if (image.length > 690000)
      throw new Error(
        "Image remains too large. Use smaller or simpler artwork.",
      );
    await saveEnvironment({
      action: "upload",
      name: el("environment-name").value,
      image,
    });
    el("environment-upload").reset();
  } catch (error) {
    el("environment-status").textContent = error.message;
  } finally {
    bitmap?.close();
    button.disabled = false;
  }
});

function applyLayout() {
  if (!overlayBase) return;
  const url =
    overlayBase +
    (el("overlay-layout").value === "compact" ? "?layout=compact" : "");
  el("overlay").value = url;
  el("preview").href = url;
  if (el("battle-preview").getAttribute("src") !== url)
    el("battle-preview").src = url;
}
el("overlay-layout").addEventListener("change", applyLayout);
el("copy-recap").addEventListener("click", (e) =>
  copyText(el("battle-recap").textContent, e.currentTarget),
);
