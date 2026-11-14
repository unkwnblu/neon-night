/** Canvas-drawn textures, so the scene ships no image or font downloads. */

export function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

/** A tileable brick wall: colour plus a matching height map for relief. */
export function brickCanvases() {
  const S = 512;
  const ROWS = 16;
  const BW = 64;
  const BH = S / ROWS;
  const GAP = 3;
  const rand = seeded(7);
  const [color, c] = canvas(S, S);
  const [bump, b] = canvas(S, S);
  c.fillStyle = "#0c0d0c";
  c.fillRect(0, 0, S, S);
  b.fillStyle = "#000";
  b.fillRect(0, 0, S, S);
  for (let row = 0; row < ROWS; row++) {
    const offset = row % 2 ? BW / 2 : 0;
    for (let i = -1; i < S / BW; i++) {
      // Greyish brown rather than red, so green light still has something to bounce off.
      const l = 70 + rand() * 60;
      const fill = `rgb(${l + 18}, ${l}, ${l - 10})`;
      const height = 150 + rand() * 90;
      for (const wrap of [0, S]) {
        const x = i * BW + offset + GAP / 2 + (i === -1 ? wrap : 0);
        if (i === -1 && wrap === 0 && offset === 0) continue;
        const y = row * BH + GAP / 2;
        c.fillStyle = fill;
        c.fillRect(x, y, BW - GAP, BH - GAP);
        b.fillStyle = `rgb(${height}, ${height}, ${height})`;
        b.fillRect(x, y, BW - GAP, BH - GAP);
        if (i !== -1) break;
      }
    }
  }
  // Grime and pitting.
  for (let i = 0; i < 5000; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = rand() * 1.6;
    c.fillStyle = `rgba(0, 0, 0, ${rand() * 0.35})`;
    c.fillRect(x, y, r, r);
    b.fillStyle = `rgba(0, 0, 0, ${rand() * 0.5})`;
    b.fillRect(x, y, r, r);
  }
  return { color, bump };
}

/** Outlined "neon tube" lettering on a transparent background. */
export function signCanvas(text: string, family: string) {
  const H = 288;
  const font = `200px ${family}`;
  const [probe, p] = canvas(8, 8);
  p.font = font;
  const width = Math.ceil(p.measureText(text).width) + 140;
  probe.width = 0;
  const [c, ctx] = canvas(width, H);
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.shadowColor = "#39ff14";
  ctx.shadowBlur = 36;
  ctx.strokeStyle = "#4dff2a";
  ctx.lineWidth = 11;
  ctx.strokeText(text, width / 2, H / 2 + 8);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#eaffe2";
  ctx.lineWidth = 3.5;
  ctx.strokeText(text, width / 2, H / 2 + 8);
  return { canvas: c, aspect: width / H };
}

/** The battered "RAVE" licence plate from the poster. */
export function plateCanvas(family: string) {
  const W = 512;
  const H = 256;
  const rand = seeded(21);
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = "#e4d9bb";
  ctx.beginPath();
  ctx.roundRect(4, 4, W - 8, H - 8, 26);
  ctx.fill();
  ctx.strokeStyle = "#a8231c";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.roundRect(20, 20, W - 40, H - 40, 16);
  ctx.stroke();
  ctx.fillStyle = "#2b1b14";
  ctx.font = `176px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("RAVE", W / 2, H / 2 + 10);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${90 + rand() * 60}, ${40 + rand() * 30}, 20, ${rand() * 0.35})`;
    const r = rand() * 3;
    ctx.fillRect(rand() * W, rand() * H, r, r);
  }
  ctx.fillStyle = "#5a4a3a";
  for (const [x, y] of [[44, 44], [W - 44, 44], [44, H - 44], [W - 44, H - 44]]) {
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

/** A soft round speck for dust; without it, points render as squares. */
export function dotCanvas() {
  const [c, ctx] = canvas(32, 32);
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "#fff");
  g.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return c;
}
