const API = "https://frenemies-u3n4.onrender.com/api/extension";
const $ = (id) => document.getElementById(id);
const twitch = window.Twitch?.ext;
let auth,
  product,
  state,
  pending = false,
  requested = false;
async function request(path, body) {
  const r = await fetch(API + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + auth.token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json();
  if (!r.ok)
    throw new Error(
      d.error || "Connection unavailable. Your saved shots remain safe.",
    );
  return d;
}
function buttons() {
  $("bits").disabled =
    pending ||
    !state?.canActivate ||
    state.shots > 0 ||
    !product ||
    !twitch.features.isBitsEnabled;
  $("fire").disabled = pending || !state?.canActivate || state.shots < 1;
}
async function refresh() {
  if (!auth) return;
  try {
    state = await request("/status");
    $("identify").hidden = true;
    $("balance").textContent =
      `${state.shots} saved shots · ${state.team ? state.team.toUpperCase() : "Choose a team in chat"}`;
    $("message").textContent = state.cooldown
      ? `Team Barrage ready in ${state.cooldown}s`
      : state.status === "running"
        ? "Battle running."
        : `Battle: ${state.status}. Shots stay saved.`;
    if (!product) {
      const products = await twitch.bits.getProducts();
      product = products.find(
        (p) =>
          p.sku === state.sku &&
          p.cost.type === "bits" &&
          p.cost.amount === state.price &&
          p.inDevelopment === false,
      );
    }
    if (!twitch.features.isBitsEnabled)
      $("message").textContent =
        "Bits actions are unavailable here. Free chat play is ready.";
    else if (!product)
      $("message").textContent =
        "Barrage is awaiting Twitch setup. Free chat play is ready.";
    buttons();
  } catch (e) {
    state = null;
    buttons();
    $("message").textContent = e.message;
    $("identify").hidden = !e.message.includes("identity");
  }
}
if (twitch) {
  twitch.onAuthorized((a) => {
    auth = a;
    refresh();
  });
  twitch.features.onChanged(() => refresh());
  twitch.bits.onTransactionCancelled(() => {
    pending = false;
    requested = false;
    refresh();
  });
  twitch.bits.onTransactionComplete(async (t) => {
    if (t.initiator !== "current_user") return;
    pending = true;
    buttons();
    try {
      await request("/transaction", { id: t.transactionID });
      if (requested) await request("/activate", {});
      $("message").textContent = "Barrage verified. Remaining shots are saved.";
    } catch (e) {
      $("message").textContent =
        e.message +
        " Verification will retry automatically; do not activate again.";
    } finally {
      pending = false;
      requested = false;
      await refresh();
    }
  });
  $("identify").onclick = () => twitch.actions.requestIdShare();
  $("bits").onclick = () => {
    if ($("bits").disabled) return;
    pending = true;
    requested = true;
    buttons();
    try {
      twitch.bits.useBits(product.sku);
    } catch (e) {
      pending = false;
      requested = false;
      buttons();
      $("message").textContent =
        "Twitch could not open the confirmation. Try again.";
    }
  };
  $("fire").onclick = async () => {
    pending = true;
    buttons();
    try {
      await request("/activate", {});
    } catch (e) {
      $("message").textContent = e.message;
    } finally {
      pending = false;
      refresh();
    }
  };
  setInterval(() => {
    if (!pending) refresh();
  }, 5000);
} else {
  $("balance").textContent =
    "Open this panel on Twitch when the Extension is enabled.";
}
