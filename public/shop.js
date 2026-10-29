const node = (tag, text) => {
  const n = document.createElement(tag);
  n.textContent = text;
  return n;
};
const $ = (id) => document.getElementById(id),
  key = encodeURIComponent(location.pathname.split("/").pop());
let catalog, player;
async function load() {
  const r = await fetch("/api/shop/" + key);
  if (!r.ok) throw Error("Shop unavailable.");
  catalog = await r.json();
  const p = await fetch("/api/player/" + key);
  player = p.ok ? await p.json() : null;
  if (player)
    for (const i of player.ownedItems || [])
      if (!catalog.items.some((x) => x.id === i.id)) catalog.items.push(i);
  $("title").textContent = catalog.title + " rewards";
  $("notice").textContent =
    (catalog.simulated ? "SIMULATED CHANNEL / " : "") +
    "Earn " +
    catalog.currency +
    " through play.";
  $("demo-player").hidden = !catalog.simulated;
  $("login").hidden = !!player || catalog.simulated;
  $("login").href = "/auth/twitch?shop=" + key;
  $("identity").textContent = player
    ? `${player.name} · ${player.balance} ${catalog.currency} · ${player.victories || 0} victories · ${player.battles || 0} eligible battles`
    : "Play free in chat. Connect your Twitch identity here for private inventory and one-click redeem/equip. No broadcaster permissions requested.";
  $("progress").textContent = player
    ? player.joined
      ? "Your account is linked to this community."
      : "Type !join in this channel chat before redeeming or equipping."
    : "The stream features a selection of players; your full character collection lives here.";
  $("loadout").replaceChildren(
    ...(player
      ? Object.entries(player.equipped).map(([team, id]) => {
          const item = catalog.items.find((i) => i.id === id);
          const c = node("article", "");
          c.append(
            node("h3", catalog.factions[team]),
            node("p", item?.name || "Owned retired item"),
          );
          if (item) c.append(art(item));
          return c;
        })
      : []),
  );
  $("upgrade").hidden = !player;
  $("upgrade").disabled =
    !player?.joined ||
    (player?.prestige || 0) >= 10 ||
    player.balance < ((player.prestige || 0) + 1) * 50;
  $("upgrade").textContent =
    (player?.prestige || 0) >= 10
      ? "Showcase rank 10 achieved"
      : `Showcase rank ${(player?.prestige || 0) + 1} · ${((player?.prestige || 0) + 1) * 50} ${catalog.currency}`;
  render();
}
function art(i) {
  const img = document.createElement("img");
  img.src = i.asset;
  img.alt = i.name;
  img.width = 120;
  img.height = 160;
  img.style.objectFit = "contain";
  return img;
}
function button(label, fn) {
  const b = node("button", label);
  b.onclick = async () => {
    b.disabled = true;
    try {
      await fn();
    } catch (e) {
      $("notice").textContent = e.message;
    } finally {
      b.disabled = false;
    }
  };
  return b;
}
async function act(action, id) {
  const r = await fetch("/api/player/" + key, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": player.csrf,
    },
    body: JSON.stringify({ action, id }),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Action failed.");
  await load();
  $("notice").textContent = d.message;
}
function render() {
  const filter = $("filter").value;
  $("items").replaceChildren(
    ...catalog.items
      .filter(
        (i) =>
          filter === "all" ||
          (filter === "owned"
            ? player?.owned.includes(i.id)
            : !player?.owned.includes(i.id)),
      )
      .map((i) => {
        const c = node("article", "");
        c.className = "panel reward-card";
        const owned = player?.owned.includes(i.id),
          equipped = player?.equipped[i.team] === i.id;
        c.append(
          art(i),
          node("h2", i.name),
          node(
            "p",
            i.price + " " + catalog.currency + " / " + catalog.factions[i.team],
          ),
        );
        if (player) {
          const b = button(
            equipped ? "Equipped" : owned ? "Equip" : "Unlock",
            () => act(owned ? "equip" : "redeem", i.id),
          );
          b.disabled =
            equipped || !player.joined || (!owned && player.balance < i.price);
          c.append(b);
        } else {
          const command = "!redeem " + (i.alias || i.id);
          c.append(
            node("p", command),
            button("Copy chat command", async () => {
              await navigator.clipboard.writeText(command);
              $("notice").textContent =
                "Copied. Paste in this channel’s Twitch chat.";
            }),
          );
        }
        return c;
      }),
  );
  $("missions").replaceChildren(
    ...catalog.missions.map((m) => {
      const c = node("article", "");
      c.className = "panel";
      c.append(
        node("h3", m.title),
        node(
          "p",
          `${m.objective} · ${player?.progress[m.id] || 0}/${m.target} · ${m.reward} ${catalog.currency}${player?.completed.includes(m.id) ? " · COMPLETE" : ""}`,
        ),
        node("p", m.story),
      );
      return c;
    }),
  );
}
$("filter").onchange = render;
$("upgrade").onclick = async () => {
  try {
    await act("upgrade");
  } catch (e) {
    $("notice").textContent = e.message;
  }
};
load().catch((e) => ($("notice").textContent = e.message));

$("demo-player").onsubmit = async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  try {
    const owner = await fetch("/api/creator");
    if (!owner.ok) throw Error("Start your own demo from the home page first.");
    const d = await owner.json();
    const r = await fetch("/api/demo-player", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": d.csrf },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    if (!r.ok) throw Error("Use the shop belonging to your own demo.");
    await load();
  } catch (e) {
    $("notice").textContent = e.message;
  }
};
