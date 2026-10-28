const el = (id) => document.getElementById(id);
let socket;
function render(s) {
  window.dispatchEvent(new CustomEvent("battle-state", { detail: s }));
  document.body.classList.toggle("killed", s.cleared);
  el("arena").classList.toggle("cleared", s.cleared);
  el("connection").hidden = s.cleared;
  el("mode").textContent = s.simulated ? "SIMULATED CHAT" : "TWITCH CHAT";
  el("round").textContent = `BATTLE ${s.round || "—"}`;
  el("status").textContent = s.status.toUpperCase();
  el("timer").textContent =
    `${Math.floor(s.remaining / 60)}:${String(s.remaining % 60).padStart(2, "0")}`;
  el("effect").textContent = s.freeze
    ? `VOTING FROZEN · ${s.freeze}s`
    : s.fog
      ? `FOG · ${s.fog}s`
      : "";
  for (const t of ["red", "blue"]) {
    const a = s.teams[t];
    el(t + "-count").textContent = s.counts[t];
    el(t + "-line").textContent = a.line;
    el(t + "-bar").style.width = a.line + "%";
    el(t + "-flags").textContent = [
      a.shield ? "SHIELD READY" : "",
      a.power ? "POWER-UP READY" : "",
      a.frenzyUntil > s.elapsed
        ? `FRENZY ${Math.ceil((a.frenzyUntil - s.elapsed) / 1000)}s`
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
    el(t + "-votes").textContent = s.totals
      ? Object.entries(s.totals[t])
          .map(([k, v]) => `${k} ${v}`)
          .join(" / ")
      : "VOTE TOTALS HIDDEN";
  }
  el("event").textContent = s.last;
  el("stream").textContent =
    `${s.simulated ? "SIMULATED SESSION" : "THIS STREAM"} · RED ${s.stream.red} : ${s.stream.blue} BLUE`;
  el("season").textContent =
    `SEASON · RED ${s.season.red} : ${s.season.blue} BLUE`;
}
function connect() {
  socket = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/?overlay=${encodeURIComponent(location.pathname.split("/").pop())}`,
  );
  socket.onmessage = (e) => {
    render(JSON.parse(e.data));
    el("connection").textContent = "CONNECTED";
  };
  socket.onclose = () => {
    el("connection").textContent = "DISCONNECTED · reconnecting";
    setTimeout(connect, 2000);
  };
  socket.onerror = () => socket.close();
}
connect();
