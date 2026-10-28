(() => {
  const canvas = document.getElementById("battlefield"),
    ctx = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let state,
    lastId = null,
    round = null,
    effects = [],
    clock = 0,
    previous = performance.now(),
    w = 1000,
    h = 260;
  const color = { red: "#ff6179", blue: "#65b9ff" };
  new ResizeObserver(() => {
    const r = canvas.getBoundingClientRect(),
      d = Math.min(devicePixelRatio || 1, 2);
    w = r.width;
    h = r.height;
    canvas.width = w * d;
    canvas.height = h * d;
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }).observe(canvas);
  window.addEventListener("battle-state", ({ detail: s }) => {
    if (lastId === null || round !== s.round || s.cleared) {
      effects = [];
      lastId = Math.max(0, ...(s.effects || []).map((e) => e.id));
    } else
      for (const e of s.effects || [])
        if (e.id > lastId) {
          effects.push({ ...e, start: clock });
          lastId = e.id;
        }
    round = s.round;
    state = s;
  });
  const line = (x, y, x2, y2, c, width = 2) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  function text(s, x, y, size, c, align = "center") {
    ctx.fillStyle = c;
    ctx.font = `800 ${size}px system-ui`;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
  }
  function squad(t) {
    const left = t === "red",
      dir = left ? 1 : -1,
      base = left ? w * 0.12 : w * 0.88,
      ground = h * 0.76;
    const count = state?.counts[t] || 0,
      lineStrength = state?.teams[t].line ?? 100;
    ctx.save();
    ctx.translate(base, ground);
    ctx.scale(dir, 1);
    ctx.fillStyle = "#1a2940";
    ctx.fillRect(-25, -h * 0.35, 50, h * 0.35);
    ctx.fillStyle = color[t];
    ctx.fillRect(-25, -h * 0.35, 50, 5);
    ctx.fillRect(-6, -h * 0.47, 4, h * 0.12);
    ctx.beginPath();
    ctx.moveTo(-2, -h * 0.47);
    ctx.lineTo(30, -h * 0.42);
    ctx.lineTo(-2, -h * 0.38);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = "#546883";
      ctx.fillRect(-18 + i * 14, -h * 0.29, 8, 12);
    }
    ctx.globalAlpha = 0.3 + (0.7 * lineStrength) / 100;
    for (let i = 0; i < Math.min(count, 8); i++) {
      const x = 43 + (i % 4) * 24,
        y = i < 4 ? 0 : -34;
      ctx.fillStyle = color[t];
      ctx.beginPath();
      ctx.arc(x, y - 23, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 6, y - 16, 13, 14);
      line(x - 3, y - 2, x - 5, y + 6, color[t], 3);
      line(x + 4, y - 2, x + 6, y + 6, color[t], 3);
      line(x + 6, y - 12, x + 17, y - 14, "#e9f1ff", 3);
    }
    ctx.globalAlpha = 1;
    if (state?.teams[t].shield) {
      ctx.strokeStyle = "#b4f3ff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(150, -22, 15, 50, 0, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    }
    if (state?.teams[t].power) {
      text("⚡", 0, -h * 0.53, 24, "#e7ff8a");
    }
    ctx.restore();
    text(
      count ? "SQUAD READY" : "JOIN " + (left ? "!RED" : "!BLUE"),
      base,
      ground + 27,
      11,
      color[t],
    );
  }
  function effect(e) {
    const age = (clock - e.start) / 1000,
      left = e.team === "red",
      x = left ? w * 0.26 : w * 0.74,
      target = left ? w * 0.78 : w * 0.22,
      y = h * 0.58,
      c = color[e.team] || "#d9fb7b";
    if (e.kind === "attack" || e.kind === "barrage") {
      const p = Math.min(1, age / 0.65),
        xx = reduced.matches ? target : x + (target - x) * p,
        yy = y - (reduced.matches ? 0 : Math.sin(p * Math.PI) * h * 0.2);
      if (p < 1) {
        ctx.shadowColor = c;
        ctx.shadowBlur = 18;
        line(
          xx - (left ? 25 : -25),
          yy,
          xx,
          yy,
          c,
          e.kind === "barrage" ? 6 : 3,
        );
        ctx.shadowBlur = 0;
      } else {
        const a = Math.min(1, (age - 0.65) / 0.65);
        ctx.globalAlpha = 1 - a;
        ctx.strokeStyle = c;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(target, y, 10 + a * 28, 0, Math.PI * 2);
        ctx.stroke();
        text("−" + e.damage, target, y - 25 - a * 15, 22, "#fff");
        ctx.globalAlpha = 1;
      }
      if (e.kind === "barrage")
        text("BARRAGE · " + e.name, w / 2, 38, Math.min(18, w / 45), "#e6ff95");
    } else if (e.kind === "victory") {
      text(
        e.team === "draw" ? "DRAW" : e.team.toUpperCase() + " VICTORY",
        w / 2,
        h * 0.42,
        Math.min(38, w / 20),
        c,
      );
    } else {
      const label =
        {
          heal: "+ HEAL",
          defend: "SHIELD",
          surge: "SURGE",
          supply: "+ SUPPLY",
        }[e.kind] || e.kind.toUpperCase();
      ctx.globalAlpha = Math.max(0, 1 - age / 1.5);
      text(label, x, y - 25 - (reduced.matches ? 0 : age * 15), 20, c);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 20 + age * 20, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  function draw(now) {
    const dt = Math.min(50, now - previous);
    previous = now;
    if (state?.status !== "paused") clock += dt;
    ctx.clearRect(0, 0, w, h);
    if (!state?.cleared) {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, "#281c30");
      g.addColorStop(0.5, "#101b2a");
      g.addColorStop(1, "#152e46");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 50)
        line(x, h * 0.78, x + w * 0.03, h, "#25344a", 1);
      line(0, h * 0.78, w, h * 0.78, "#42536e", 2);
      line(w / 2, h * 0.2, w / 2, h * 0.88, "#45526a", 1);
      squad("red");
      squad("blue");
      effects = effects.filter(
        (e) => clock - e.start < (e.kind === "victory" ? 4000 : 1500),
      );
      effects.forEach(effect);
      if (state?.freeze)
        text("FROZEN · " + state.freeze + "s", w / 2, h * 0.87, 14, "#b4f3ff");
      if (state?.status === "paused")
        text("PAUSED", w / 2, h * 0.4, 25, "#dce6fa");
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
