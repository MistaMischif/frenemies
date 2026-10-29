const $ = (id) => document.getElementById(id);
let csrf, data;
const node = (tag, text) => {
  const n = document.createElement(tag);
  n.textContent = text;
  return n;
};
async function load(initial = false) {
  const r = await fetch("/api/creator");
  if (!r.ok) throw Error("Open controls and sign in or start a demo first.");
  data = await r.json();
  csrf = data.csrf;
  $("mode").textContent = data.simulated
    ? "SIMULATED CHANNEL: temporary inventory and analytics"
    : "LIVE CHANNEL: content and inventory saved with this channel";
  $("demo-box").hidden = !data.simulated;
  if (initial) {
    $("settings").elements.title.value = data.title;
    $("settings").elements.currency.value = data.currency;
    $("settings").elements.humanName.value = data.factions.red;
    $("settings").elements.zombieName.value = data.factions.blue;
    $("settings").elements.outbreak.checked = data.outbreak;
  }
  for (const team of ["red", "blue"]) {
    const select = $(team + "-starter");
    select.replaceChildren(
      ...data.items
        .filter((i) => i.published && i.price === 0 && i.team === team)
        .map((i) => {
          const o = node("option", i.name);
          o.value = i.id;
          return o;
        }),
    );
    select.value = data.starters[team];
  }
  $("shop-link").href = data.shop;
  $("items").replaceChildren(
    ...data.items.map((i) => {
      const c = node("article", "");
      c.className = "panel";
      const img = document.createElement("img");
      img.src = i.asset;
      img.alt = i.name;
      img.width = 100;
      img.height = 130;
      img.style.objectFit = "contain";
      c.append(
        img,
        node("h3", i.name),
        node("p", i.id + " / " + i.price + " " + data.currency),
      );
      c.append(toggle(i), editItem(i));
      return c;
    }),
  );
  $("missions").replaceChildren(
    ...data.missions.map((m) => {
      const c = node("article", "");
      c.append(
        node("h3", m.title),
        node(
          "p",
          m.objective +
            " in " +
            m.target +
            " eligible battles / " +
            m.reward +
            " " +
            data.currency,
        ),
        node("p", m.story),
        toggle(m),
        editMission(m),
        duplicate(m),
      );
      return c;
    }),
  );
  const cohort = (x) =>
    x.rate === null
      ? "Not enough mature players"
      : `${x.returned}/${x.eligible} (${Math.round(x.rate * 100)}%)`;
  $("retention").textContent =
    "D1: " + cohort(data.analytics.d1) + " / D7: " + cohort(data.analytics.d7);
  $("days").replaceChildren(
    ...data.analytics.days.slice(0, 14).map((d) =>
      node(
        "p",
        `${d.date}: ${d.players} eligible players / ${d.battles} completed battles / ${d.issued} issued / ${d.redeemed} redeemed / ${(d.observedMs / 3600000).toFixed(2)} connected-chat hours / ${
          Object.entries(d.events)
            .map(([k, v]) => k + ": " + v)
            .join(", ") || "no tracked events"
        }`,
      ),
    ),
  );
  renderShow();
  selectView();
  $("notice").textContent =
    "Loaded. Drafts stay private to the creator catalog until published.";
}
function toggle(item) {
  const b = node("button", item.published ? "Retire" : "Publish");
  b.onclick = () =>
    run(b, () =>
      post({ action: "publish", id: item.id, published: !item.published }),
    );
  return b;
}
async function post(body) {
  const r = await fetch("/api/creator", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Save failed");
  await load();
  $("notice").textContent = "Saved.";
}
async function run(button, fn) {
  button.disabled = true;
  try {
    await fn();
  } catch (e) {
    $("notice").textContent = e.message;
  } finally {
    button.disabled = false;
  }
}
for (const id of ["settings", "mission"])
  $(id).onsubmit = (e) => {
    e.preventDefault();
    const f = e.currentTarget,
      b = f.querySelector("button");
    run(b, async () => {
      const body = Object.fromEntries(new FormData(f));
      body.action = id;
      if (id === "settings") body.outbreak = f.elements.outbreak.checked;
      if (id === "mission") {
        body.target = Number(body.target);
        body.reward = Number(body.reward);
      }
      await post(body);
      if (id === "mission") f.reset();
    });
  };
$("skin").onsubmit = (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  run(f.querySelector("button"), async () => {
    const body = Object.fromEntries(new FormData(f)),
      file = body.image;
    if (file.type !== "image/png" || file.size > 5 * 1024 * 1024)
      throw Error("Choose a PNG under 5 MB.");
    const img = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 512 / img.width, 512 / img.height),
        c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      body.image = c.toDataURL("image/png");
      body.price = Number(body.price);
      body.action = "item";
      await post(body);
      f.reset();
    } finally {
      img.close();
    }
  });
};
$("demo").onsubmit = (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  run(f.querySelector("button"), async () => {
    const r = await fetch("/api/demo-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      body: JSON.stringify(Object.fromEntries(new FormData(f))),
    });
    if (!r.ok) throw Error("Demo command rejected.");
    await new Promise((r) => setTimeout(r, 300));
    const state = await (await fetch("/api/control")).json();
    $("demo-result").textContent = state.state.last;
    await load();
  });
};
$("export").onclick = () => {
  if (!data) return;
  const url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          {
            simulated: data.simulated,
            daily: data.analytics,
            broadcasts: data.broadcastAnalytics,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "frenemies-aggregate-analytics.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
load(true).catch((e) => ($("notice").textContent = e.message));

function actionButton(label, fn) {
  const b = node("button", label);
  b.type = "button";
  b.onclick = () => run(b, fn);
  return b;
}
function editItem(i) {
  return actionButton("Edit name / price", async () => {
    const form = document.createElement("form");
    form.className = "panel";
    const name = document.createElement("input");
    name.value = i.name;
    name.maxLength = 40;
    name.required = true;
    name.setAttribute("aria-label", "Item name");
    const price = document.createElement("input");
    price.type = "number";
    price.min = 0;
    price.max = 500;
    price.value = i.price;
    price.required = true;
    price.setAttribute("aria-label", "Price");
    const b = node("button", "Save item");
    form.append(name, price, b);
    form.onsubmit = (e) => {
      e.preventDefault();
      run(b, () =>
        post({
          action: "edit",
          id: i.id,
          name: name.value,
          price: Number(price.value),
        }),
      );
    };
    $("items").prepend(form);
    name.focus();
  });
}
function editMission(m) {
  return actionButton("Edit mission", async () => {
    const f = $("mission");
    for (const k of ["title", "story", "objective", "target", "reward"])
      f.elements[k].value = m[k];
    f.dataset.edit = m.id;
    for (const k of ["objective", "target", "reward"])
      f.elements[k].disabled = !!(m.published || m.everPublished);
    f.querySelector("button").textContent = "Save mission changes";
    f.scrollIntoView({ block: "center" });
  });
}
function duplicate(m) {
  return actionButton("New edition", () =>
    post({ action: "duplicate", id: m.id }),
  );
}
$("mission").onsubmit = (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  run(f.querySelector("button"), async () => {
    const body = {
      action: f.dataset.edit ? "edit" : "mission",
      id: f.dataset.edit,
    };
    for (const k of ["title", "story", "objective", "target", "reward"])
      body[k] = f.elements[k].value;
    body.target = Number(body.target);
    body.reward = Number(body.reward);
    await post(body);
    delete f.dataset.edit;
    f.reset();
    for (const k of ["objective", "target", "reward"])
      f.elements[k].disabled = false;
    f.querySelector("button").textContent = "Create draft mission";
  });
};
for (const id of ["episode", "session-start", "session-end"])
  $(id).onsubmit = (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    run(f.querySelector("button"), async () => {
      const body = { ...Object.fromEntries(new FormData(f)), action: id };
      if (id === "episode") {
        body.target = Number(body.target);
        body.rounds = Number(body.rounds);
      }
      await post(body);
      f.reset();
      if (id === "episode") f.elements.id.value = "";
    });
  };
$("new-episode").onclick = () => {
  $("episode").reset();
  $("episode").elements.id.value = "";
};
$("cancel-episode").onclick = (e) =>
  run(e.currentTarget, () => post({ action: "cancel-episode" }));
function renderShow() {
  const selected = $("episode-reward").value;
  $("episode-reward").replaceChildren(
    ...[
      { id: "", name: "Story outcome only" },
      ...data.items.filter((i) => i.published),
    ].map((i) => {
      const o = node("option", i.name);
      o.value = i.id;
      return o;
    }),
  );
  $("episode-reward").value = selected;

  const live = data.show.session,
    a = data.show.episode;
  $("session-state").textContent = live
    ? live.label + " / " + live.kind + " sample running"
    : "No sample running. Mark the start before measuring.";
  $("session-start").hidden = !!live;
  $("session-end").hidden = !live;
  $("active-episode").textContent = a
    ? `${a.title}: ${a.progress}/${a.target} contributions · ${a.played}/${a.rounds} battles · ${a.status}. ${a.ending || a.intro}`
    : "No active episode. Build a story your community can change.";
  $("cancel-episode").hidden = a?.status !== "active";
  $("episodes").replaceChildren(
    ...data.episodes.map((e) => {
      const c = node("article", "");
      c.className = "panel";
      c.append(
        node("h3", e.title),
        node("p", e.intro),
        node(
          "p",
          e.objective +
            " / " +
            e.target +
            " contributions / " +
            e.rounds +
            " battles / revision " +
            e.revision,
        ),
        actionButton("Edit template", async () => {
          for (const k of [
            "id",
            "title",
            "intro",
            "success",
            "failure",
            "objective",
            "target",
            "rounds",
            "unlock",
          ])
            $("episode").elements[k].value = e[k] || "";
          $("episode").scrollIntoView({ block: "center" });
        }),
        actionButton("Launch episode", () =>
          post({ action: "launch-episode", id: e.id }),
        ),
      );
      return c;
    }),
  );
  const b = data.broadcastAnalytics,
    rate = (x) =>
      x.rate === null
        ? "Awaiting mature samples"
        : `${x.returned}/${x.eligible} (${Math.round(x.rate * 100)}%)`;
  $("broadcast-retention").textContent =
    "Next game broadcast: " +
    rate(b.nextBroadcast) +
    " · Within next three: " +
    rate(b.nextThree) +
    ". Denominators are player-session opportunities, not unique channel viewers.";
  $("broadcast-results").replaceChildren(
    ...b.sessions
      .slice()
      .reverse()
      .slice(0, 12)
      .map((s) => {
        const c = node("article", "");
        c.className = "panel";
        c.append(
          node(
            "h3",
            s.label + " · " + s.kind + (s.interrupted ? " · interrupted" : ""),
          ),
          node(
            "p",
            `${s.joins} joins · ${s.players} eligible players · ${s.redeemers} redeemers · ${s.battles} battles · ${s.operatorActions} control actions · ${s.playersWithObservedSubscription} players with observed subscription support / ${s.playersWithoutObservedSubscription} without (not proof of no spending)`,
          ),
          node(
            "p",
            s.contribution === null
              ? "Contribution unknown: financial inputs incomplete."
              : `Recorded contribution: ${s.contribution.toFixed(2)} after direct costs and operator time. This is not incremental ROI.`,
          ),
        );
        return c;
      }),
  );
  $("comparison").textContent = b.pairs.length
    ? b.pairs
        .map(
          (p) =>
            `${p.key}: ${p.contributionLiftPerHour.toFixed(2)} contribution/hour difference (${p.gameSamples} game / ${p.controlSamples} control samples). Observational; stream category, guests and seasonality can confound.`,
        )
        .join(" ")
    : "No complete matched comparison yet. Record game and control samples with the same key and complete costs to compare contribution per hour.";
}

$("starter-episode").onclick = () => {
  const f = $("episode");
  f.reset();
  const starter = {
    id: "",
    title: "Save the signal",
    intro:
      "Two rival crews share one broadcast relay. Defend together before the signal fades.",
    objective: "defend",
    target: 20,
    rounds: 3,
    success:
      "The relay is restored. Both crews earn their place in the next transmission.",
    failure: "The signal fades. The crews return next time with a new plan.",
  };
  for (const [k, v] of Object.entries(starter)) f.elements[k].value = v;
};

function selectView() {
  const key = location.hash.slice(1) || "broadcast",
    groups = {
      broadcast: ["broadcast", ...(data?.simulated ? ["demo-box"] : [])],
      world: ["world"],
      "episodes-panel": ["episodes-panel", "missions-panel"],
      "skins-panel": ["skins-panel", "economy-panel"],
      "analytics-panel": ["analytics-panel"],
    };
  const visible = groups[key] || groups.broadcast;
  document
    .querySelectorAll("main > section")
    .forEach((s) => (s.hidden = !visible.includes(s.id)));
  document.querySelectorAll("nav a").forEach((a) => {
    if (a.hash === "#" + key) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}
window.addEventListener("hashchange", selectView);
