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
  const sprites = {};
  for (const [team, names] of Object.entries({
    red: ["char01V01", "char02V01", "char03V01"],
    blue: ["zmb01V01", "zmb01V02", "zmb01V03", "zmb01V04"],
  }))
    sprites[team] = names.map((name) => {
      const image = new Image();
      image.src = `/characters/${name}.png`;
      return image;
    });
  const equippedImages = new Map();
  let environmentImage, environmentUrl;
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
    if (environmentUrl !== s.environment?.url) {
      environmentUrl = s.environment?.url;
      environmentImage = null;
      if (environmentUrl) {
        environmentImage = new Image();
        environmentImage.src = environmentUrl;
      }
    }
    const label = document.querySelector(".field-label");
    if (label)
      label.textContent = window.FrenemiesScenes.has(s.environment?.id)
        ? window.FrenemiesScenes.title(s.environment.id)
        : s.environment?.name || "NEON BATTLEFIELD";
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
    ctx.globalAlpha = lineStrength > 0 ? 1 : 0.35;
    const roster = state?.roster?.[t] || [];
    const visible =
      roster.length ||
      Math.min(count || (state?.status === "lobby" ? 3 : 0), 6);
    for (let i = 0; i < visible; i++) {
      const player = roster[i];
      let image = sprites[t][i % sprites[t].length];
      if (player?.asset) {
        if (!equippedImages.has(player.asset)) {
          const img = new Image();
          img.src = player.asset;
          equippedImages.set(player.asset, img);
        }
        image = equippedImages.get(player.asset);
      }

      if (!image.complete || !image.naturalWidth) continue;
      const height = Math.min(h * 0.62, 120) * (i < 3 ? 0.88 : 1);
      const width = (height * image.naturalWidth) / image.naturalHeight;
      const x = 42 + (i % 3) * Math.min(42, w * 0.04);
      const bob =
        !reduced.matches && state?.status === "running"
          ? Math.sin(clock / 240 + i * 1.6) * 2
          : 0;
      ctx.save();
      // Contact shadows stay grounded when the actor bobs.
      ctx.fillStyle = "#101b1c55";
      ctx.beginPath();
      ctx.ellipse(
        x,
        i < 3 ? -12 : 5,
        width * 0.34,
        Math.max(2, height * 0.035),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.translate(x, (i < 3 ? -12 : 5) + bob);
      // Zombies already face left; cancel the squad's mirror for their artwork.
      if (!left) ctx.scale(-1, 1);
      if (player?.prestige) {
        ctx.strokeStyle = ["#9cbdff", "#bd91ff", "#f5d778"][
          Math.min(2, Math.floor((player.prestige - 1) / 4))
        ];
        ctx.lineWidth = 2 + player.prestige * 0.25;
        ctx.beginPath();
        ctx.ellipse(0, -4, width * 0.55, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.drawImage(image, -width / 2, -height, width, height);
      if (player) {
        text(
          player.name.length > 12
            ? player.name.slice(0, 11) + "…"
            : player.name,
          0,
          -height - 5,
          Math.max(9, Math.min(12, w / 95)),
          "#ffffff",
        );
      }
      if (player?.prestige)
        text("RANK " + player.prestige, 0, 12, 9, "#f5d778");
      ctx.restore();
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
      count ? "SQUAD READY" : "JOIN " + (left ? "!HUMAN" : "!ZOMBIE"),
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
        e.team === "draw"
          ? "DRAW"
          : (state?.creator?.factions?.[e.team] ||
              (e.team === "red" ? "HUMANS" : "ZOMBIES")) + " VICTORY",
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
        }[e.kind] ||
        (e.kind === "join" ? e.name + " JOINED" : e.kind.toUpperCase());
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
      const scenic = window.FrenemiesScenes.background(
        ctx,
        w,
        h,
        state?.environment?.id,
      );
      if (
        !scenic &&
        environmentImage?.complete &&
        environmentImage.naturalWidth
      ) {
        const scale = Math.max(
          w / environmentImage.naturalWidth,
          h / environmentImage.naturalHeight,
        );
        const width = environmentImage.naturalWidth * scale,
          height = environmentImage.naturalHeight * scale;
        ctx.drawImage(
          environmentImage,
          (w - width) / 2,
          (h - height) / 2,
          width,
          height,
        );
        ctx.fillStyle = "#09101a55";
        ctx.fillRect(0, 0, w, h);
      }
      if (!scenic) {
        for (let x = 0; x < w; x += 50)
          line(x, h * 0.78, x + w * 0.03, h, "#25344a", 1);
        line(0, h * 0.78, w, h * 0.78, "#42536e", 2);
        line(w / 2, h * 0.2, w / 2, h * 0.88, "#45526a", 1);
      }
      squad("red");
      squad("blue");
      window.FrenemiesScenes.foreground(ctx, w, h, state?.environment?.id);
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
