export class BridgeScene {
  constructor() {
    this.tick = null;
    this.at = 0;
    this.positions = new Map();
    this.actions = {};
    this.pulses = {};
    this.operation = null;
  }
  draw(c, s, t, image, reduced) {
    const b = s.operation?.bridge;
    if (!b) return;
    if (this.tick !== `${s.operation.id}:${b.tick}`) {
      this.tick = `${s.operation.id}:${b.tick}`;
      this.at = t;
    }
    const age = t - this.at,
      p = reduced ? 1 : Math.min(1, age / 4500);
    if (this.operation !== s.operation.id) {
      this.operation = s.operation.id;
      this.actions = { ...s.operation.visual.actions };
      this.positions.clear();
      this.pulses = {};
    }
    for (const [role, total] of Object.entries(s.operation.visual.actions)) {
      const count = total - (this.actions[role] || 0);
      if (count > 0) this.pulses[role] = { count, at: t };
      this.actions[role] = total;
    }
    c.save();
    const text = (v, x, y, size = 18, color = "#f4efcd") => {
      c.font = `bold ${size}px Segoe UI`;
      c.textAlign = "center";
      c.fillStyle = color;
      c.fillText(v, x, y);
    };
    const line = (x, y, xx, yy, color, width) => {
      c.strokeStyle = color;
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(xx, yy);
      c.stroke();
    };
    // The river, deck and barricade share one physical choke point.
    c.fillStyle = "#112e3a";
    c.beginPath();
    c.moveTo(850, 200);
    c.lineTo(1020, 200);
    c.lineTo(1050, 560);
    c.lineTo(800, 560);
    c.fill();
    for (let i = 0; i < 9; i++)
      line(
        850 + (i % 3) * 42,
        290 + i * 27,
        890 + (i % 3) * 42,
        290 + i * 27,
        "#739da255",
        3,
      );
    for (let i = 0; i < 12; i++) {
      c.fillStyle = i / 12 > b.health / 100 ? "#4c4f46" : "#c4a775";
      c.fillRect(770 + i * 23, 402, 21, 38);
    }
    line(770, 398, 1045, 398, "#e1c28c", 5);
    const bags = Math.ceil((b.health / 100) * 18);
    for (let i = 0; i < 18; i++) {
      c.fillStyle = i < bags ? "#c5be91" : "#514a3e";
      c.beginPath();
      c.roundRect(930 + (i % 6) * 19, 393 - Math.floor(i / 6) * 15, 18, 13, 4);
      c.fill();
    }
    c.fillStyle = "#bbcaa0";
    c.fillRect(390, 355, 130, 58);
    c.fillStyle = "#718b7b";
    c.fillRect(510, 371, 42, 42);
    c.fillStyle = "#163340";
    c.fillRect(522, 376, 23, 20);
    for (const x of [415, 525]) {
      c.fillStyle = "#17252b";
      c.beginPath();
      c.arc(x, 417, 19, 0, Math.PI * 2);
      c.fill();
    }
    const roster = s.roster || [],
      fallback = s.encounterArt?.red?.length
        ? s.encounterArt.red
        : [
            "/characters/char01V01.png",
            "/characters/char02V01.png",
            "/characters/char03V01.png",
          ];
    const sprite = (url, x, y, h, flip = false, alpha = 1) => {
      const im = image(url);
      if (!im.complete || !im.naturalWidth) return;
      c.save();
      c.globalAlpha = alpha;
      c.translate(x, y);
      if (flip) c.scale(-1, 1);
      c.drawImage(
        im,
        (-h * im.naturalWidth) / im.naturalHeight / 2,
        -h,
        (h * im.naturalWidth) / im.naturalHeight,
        h,
      );
      c.restore();
    };
    ["escort", "assault", "fortify", "scout"].forEach((role, i) => {
      const count = s.visualRoles?.[role] || 0;
      if (!count) return;
      const x = [330, 640, 885, 720][i],
        y = [425, 430, 425, 330][i];
      for (let j = 0; j < Math.min(3, Math.ceil(Math.sqrt(count))); j++)
        sprite(
          roster[i + j]?.asset || fallback[(i + j) % fallback.length],
          x - j * 28,
          y,
          92,
        );
      text(role.toUpperCase() + " ×" + count, x, y + 24, 13);
      const pulse = this.pulses[role];
      if (pulse && t - pulse.at < 2000)
        text("+" + pulse.count, x, y - 110, 20, "#e9f7b5");
      if (role === "fortify" && b.repairs.length) {
        line(886, 355, 914, 333, "#d9eea5", 5);
        if (age < 2000)
          text("+" + Math.round(b.repairs[0].amount), 900, 300, 24, "#d2f1a0");
      }
      if (role === "scout" && b.revealed) {
        c.strokeStyle = "#ecd17b";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(
          1200,
          345,
          60 + (reduced ? 0 : (age % 1500) / 45),
          Math.PI,
          Math.PI * 2,
        );
        c.stroke();
      }
    });
    for (const e of b.enemies) {
      const old = this.positions.get(e.id) ?? Math.min(1430, e.x + 80);
      const x = old + (e.x - old) * p;
      if (p === 1) this.positions.set(e.id, e.x);
      sprite(
        s.encounterArt?.blue?.[e.id % s.encounterArt.blue.length] ||
          "/characters/zmb01V0" + ((e.id % 4) + 1) + ".png",
        x,
        425,
        105,
        false,
        e.hp > 0 ? 1 : Math.max(0, 1 - age / 1800),
      );
      if (e.hp > 0) {
        c.fillStyle = "#26191b";
        c.fillRect(x - 24, 303, 48, 6);
        c.fillStyle = "#ed987c";
        c.fillRect(x - 24, 303, (48 * e.hp) / e.maxHp, 6);
      }
      if (b.shots.some((h) => h.id === e.id) && age < 1700) {
        line(665, 365, x, 365, "#ffe6a0", 3);
        c.strokeStyle = "#ffc291";
        c.beginPath();
        c.arc(x, 365, 12 + (reduced ? 0 : age / 90), 0, Math.PI * 2);
        c.stroke();
      }
    }
    if (b.impact && age < 2000) {
      c.fillStyle = "#f2946355";
      c.fillRect(925, 345, 130, 85);
      text("-" + b.impact, 1020, 320, 25, "#ffb595");
    }
    const result =
      b.phase === "secured"
        ? "CROSSING SAVED"
        : b.phase === "breached"
          ? "LINE BROKEN"
          : b.phase === "abandoned"
            ? "CROSSING ABANDONED"
            : "HOLD THE CROSSING";
    text(result, 720, 52, 22);
    text(
      b.phase === "defend" ? "CONVOY WAITING" : "CONVOY RELEASED",
      470,
      465,
      16,
    );
    text("BARRICADE " + Math.ceil(b.health) + "%", 980, 465, 16);
    text(
      b.spotlight || "Your communities are holding this line together",
      720,
      515,
      22,
    );
    if (b.revealed && b.nextWave && b.phase === "defend")
      text("SCOUTS: MORE RAIDERS APPROACHING", 1190, 250, 16, "#ecd17b");
    c.restore();
  }
}
