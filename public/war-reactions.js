export const ROLE_STYLE = {
  fortify: { color: "#a6dfec", label: "FORTIFY", x: 880, y: 370 },
  scout: { color: "#dfc87e", label: "SCOUT", x: 700, y: 340 },
  assault: { color: "#ffab88", label: "ASSAULT", x: 1120, y: 330 },
  escort: { color: "#b9e992", label: "ESCORT", x: 400, y: 410 },
};
export function changes(previous, next) {
  if (!previous || previous.id !== next?.id) return [];
  const events = [];
  for (const group of ["actions", "decisions"])
    for (const [kind, total] of Object.entries(next.visual?.[group] || {})) {
      const count = total - (previous.visual?.[group]?.[kind] || 0);
      if (count > 0) events.push({ kind, count });
    }
  if (next.hull < previous.hull)
    events.push({
      kind: "damage",
      count: Math.round((previous.hull - next.hull) * 10) / 10,
    });
  if (next.status !== previous.status)
    events.push({ kind: next.status, count: 1 });
  if (next.director?.rescued && !previous.director?.rescued)
    events.push({ kind: "rescued", count: 1 });
  return events;
}
export class BattleReactions {
  constructor() {
    this.previous = null;
    this.effects = [];
  }
  accept(state, now) {
    const o = state.operation;
    if (!o) return;
    if (this.previous?.id !== o.id) this.effects = [];
    this.effects = this.effects.filter((e) => now - e.at < 3500);
    for (const e of changes(this.previous, o))
      this.effects.push({ ...e, at: now });
    this.effects = this.effects.slice(-48);
    this.previous = structuredClone(o);
  }
  draw(c, s, t, convoy, reduced) {
    if (!s?.operation) return;
    const o = s.operation,
      n = s.visualRoles || {};
    c.save();
    c.lineCap = "round";
    const text = (str, x, y, color = "#eef2dd", size = 16) => {
      c.fillStyle = color;
      c.font = `bold ${size}px Segoe UI`;
      c.textAlign = "center";
      c.fillText(str, x, y);
    };
    const line = (x, y, xx, yy, color, width = 3) => {
      c.strokeStyle = color;
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(xx, yy);
      c.stroke();
    };
    // Persistent structures reflect actual crossing condition; builder detail scales sublinearly.
    const tiers = Math.ceil(s.crossing / 25),
      builders = Math.min(8, Math.ceil(Math.sqrt(n.fortify || 0)));
    for (let row = 0; row < tiers; row++)
      for (let j = 0; j < 5; j++) {
        c.fillStyle = row % 2 ? "#9b9f79" : "#b3b28a";
        c.strokeStyle = "#4e5c4e";
        c.lineWidth = 2;
        c.beginPath();
        c.roundRect(820 + j * 29 + (row % 2) * 12, 438 - row * 15, 27, 13, 5);
        c.fill();
        c.stroke();
      }
    for (let i = 0; i < builders; i++) {
      const xx = 817 + i * 24;
      line(xx, 370, xx, 390, "#a6dfec", 3);
      line(xx - 6, 375, xx + 6, 375, "#a6dfec", 3);
    }
    if (n.fortify) {
      c.strokeStyle = "#a6dfec88";
      c.lineWidth = 2 + Math.min(6, Math.sqrt(n.fortify));
      c.beginPath();
      c.ellipse(895, 395, 110, 70, 0, Math.PI, Math.PI * 2);
      c.stroke();
    }
    if (n.scout) {
      const zones = Math.min(5, Math.ceil(Math.sqrt(n.scout)));
      for (let i = 0; i < zones; i++) {
        const xx = 500 + i * 145;
        line(xx, 370, xx, 340, "#dfc87e", 2);
        c.fillStyle = "#dfc87e";
        c.beginPath();
        c.moveTo(xx, 340);
        c.lineTo(xx + 22, 348);
        c.lineTo(xx, 355);
        c.fill();
        c.strokeStyle = "#dfc87e55";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(
          xx,
          385,
          35 + (reduced ? 12 : (t / 25 + i * 8) % 25),
          Math.PI,
          Math.PI * 2,
        );
        c.stroke();
      }
    }
    if (n.assault && o.status === "active" && o.route) {
      const guns = Math.min(8, Math.ceil(Math.sqrt(n.assault)));
      for (let i = 0; i < guns; i++) {
        const start = Math.min(1050, convoy + 100 + i * 20),
          end = 1260 + i * 8,
          p = reduced ? 0.6 : ((t + i * 170) % 1100) / 1100;
        line(start, 397, start + 20, 385, "#ffab88", 5);
        line(
          start + (end - start) * p,
          385,
          start + (end - start) * p + 22,
          380,
          "#ffe9b1",
          3,
        );
        if (p > 0.8) {
          c.strokeStyle = "#ffab8899";
          c.beginPath();
          c.arc(end, 380, 10 + p * 8, 0, Math.PI * 2);
          c.stroke();
        }
      }
    }
    // Compact role indicators show true headcounts, not one sprite per viewer.
    for (const [i, [role, style]] of Object.entries(ROLE_STYLE).entries()) {
      const xx = 220 + i * 330;
      c.fillStyle = "#10221ddd";
      c.beginPath();
      c.roundRect(xx - 125, 485, 250, 30, 8);
      c.fill();
      text(`${style.label}  ${n[role] || 0}`, xx, 506, style.color, 15);
    }
    let bannerRow = 0;
    for (const e of this.effects) {
      const age = t - e.at;
      if (age < 0 || age > 3500) continue;
      const p = reduced ? 0.5 : age / 3500;
      const style = ROLE_STYLE[e.kind];
      c.globalAlpha = Math.min(1, (1 - p) * 2);
      if (style) {
        const xx = e.kind === "escort" ? convoy : style.x,
          yy = style.y;
        c.strokeStyle = style.color;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(xx, yy, 20 + p * 65, 0, Math.PI * 2);
        c.stroke();
        text(
          `+${e.count} ${style.label}`,
          xx,
          yy - 25 - p * 35,
          style.color,
          21,
        );
        if (e.kind === "fortify") {
          for (
            let j = 0;
            j < Math.min(10, 2 + Math.ceil(Math.sqrt(e.count)));
            j++
          ) {
            c.fillStyle = style.color;
            c.fillRect(825 + j * 14, 400 - p * 30, 7, 7);
          }
        }
        if (e.kind === "escort") {
          line(
            Math.max(25, convoy - 60),
            448,
            convoy + 65,
            448,
            style.color,
            4,
          );
        }
      } else {
        const labels = {
          direct: "EXPOSED ROUTE COMMITTED",
          detour: "SAFER ROUTE COMMITTED",
          reserves: "REINFORCEMENTS ARRIVING",
          rescue: "RESCUE TEAM DEPLOYED",
          "press-on": "CONVOY STAYS THE COURSE",
          "take-command": "COMMAND HANDOFF",
          "director-on": "HOST RESUMED",
          "director-off": "STANDARD PACING",
          delivered: "DELIVERY COMPLETE",
          lost: "CONVOY LOST",
          evacuated: "EVACUATION ORDERED",
          rescued: "CREW SAFE",
        };
        if (e.kind === "damage") {
          text(`−${e.count} HULL`, convoy, 335 - p * 35, "#ffb299", 22);
          c.strokeStyle = "#ff876655";
          c.lineWidth = 6;
          c.strokeRect(convoy - 65, 355, 140, 80);
        } else {
          text(
            labels[e.kind] || e.kind.toUpperCase(),
            720,
            200 + (bannerRow++ % 3) * 32 - p * 15,
            e.kind === "lost" ? "#ffab88" : "#e3edb7",
            24,
          );
          if (e.kind === "reserves" || e.kind === "rescued") {
            for (let i = 0; i < 6; i++)
              line(
                convoy - 80 + i * 32,
                435,
                convoy - 80 + i * 32,
                410 - p * 60,
                "#bae7bd",
                4,
              );
          }
        }
      }
      c.globalAlpha = 1;
    }
    const beat =
      o.status === "delivered"
        ? "ARRIVAL"
        : o.status === "lost"
          ? "AFTERMATH"
          : o.status === "evacuated"
            ? "WITHDRAWAL"
            : !o.route
              ? "DEPARTURE"
              : o.progress >= 80
                ? "FINAL APPROACH"
                : o.director?.choice
                  ? "THE COMMANDER’S CHOICE"
                  : o.director?.phase === "relax"
                    ? "A MOMENT TO BREATHE"
                    : o.director?.phase === "peak"
                      ? "UNDER FIRE"
                      : "ON THE ROAD";
    text(beat, 720, 52, "#eff2d7", 17);
    c.restore();
  }
}
