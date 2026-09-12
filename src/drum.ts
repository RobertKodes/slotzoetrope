import type { Figure } from "./solana";
import { FAMILY_HEX, poseSvg } from "./figures";

const W = 640;
const H = 460;
const CX = 338;
const TOP_CY = 136;
const BOT_CY = 318;
const TOP_RX = 198;
const TOP_RY = 56;
const BOT_RX = 216;
const BOT_RY = 64;

const images = new Map<string, HTMLImageElement>();

function figureKey(fig: Figure): string {
  return `${fig.family}-${fig.pose}-${fig.failed ? "1" : "0"}`;
}

function loadFigure(fig: Figure): HTMLImageElement {
  const key = figureKey(fig);
  const hit = images.get(key);
  if (hit) return hit;
  const img = new Image();
  img.src = `data:image/svg+xml;utf8,${encodeURIComponent(poseSvg(fig.pose, FAMILY_HEX[fig.family]))}`;
  images.set(key, img);
  return img;
}

function rim(rx: number, ry: number, cy: number, theta: number): { x: number; y: number } {
  return { x: CX + rx * Math.sin(theta), y: cy + ry * Math.cos(theta) };
}

function wallQuad(theta: number) {
  const d = Math.PI / 12;
  return {
    t1: rim(TOP_RX, TOP_RY, TOP_CY, theta - d),
    t2: rim(TOP_RX, TOP_RY, TOP_CY, theta + d),
    b1: rim(BOT_RX, BOT_RY, BOT_CY, theta - d),
    b2: rim(BOT_RX, BOT_RY, BOT_CY, theta + d),
  };
}

function lerp(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function fillQuad(
  ctx: CanvasRenderingContext2D,
  t1: { x: number; y: number },
  t2: { x: number; y: number },
  b2: { x: number; y: number },
  b1: { x: number; y: number },
  fill: string,
): void {
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.lineTo(b2.x, b2.y);
  ctx.lineTo(b1.x, b1.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  cy: number,
  rx: number,
  ry: number,
  fill?: string,
  stroke?: string,
  width = 8,
): void {
  ctx.beginPath();
  ctx.ellipse(CX, cy, rx, ry, 0, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  fig: Figure,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  if (fig.failed) ctx.rotate(-0.09);
  ctx.beginPath();
  if (fig.failed) {
    ctx.moveTo(0, 2);
    ctx.lineTo(w * 0.9, 0);
    ctx.lineTo(w, h * 0.24);
    ctx.lineTo(w * 0.84, h * 0.44);
    ctx.lineTo(w, h * 0.66);
    ctx.lineTo(w * 0.76, h * 0.84);
    ctx.lineTo(w * 0.93, h);
    ctx.lineTo(0, h);
  } else {
    ctx.rect(0, 0, w, h);
  }
  ctx.closePath();
  ctx.fillStyle = fig.failed ? "#edd0c2" : "#e6d3b0";
  ctx.fill();
  ctx.strokeStyle = fig.failed ? "#b83320" : "#c4ad86";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const img = loadFigure(fig);
  if (img.complete && img.naturalWidth) {
    ctx.drawImage(img, w * 0.06, h * 0.04, w * 0.88, h * 0.64);
  }

  ctx.fillStyle = fig.failed ? "#b83320" : "#3d2416";
  ctx.font = "12px 'Special Elite', monospace";
  ctx.textAlign = "center";
  ctx.fillText(fig.callsign, w / 2, h - 6);
  if (fig.failed) {
    ctx.beginPath();
    ctx.moveTo(6, h - 9);
    ctx.lineTo(w - 6, h - 9);
    ctx.strokeStyle = "#b83320";
    ctx.stroke();
  }
  ctx.restore();
}

function slitQuad(q: ReturnType<typeof wallQuad>, failed: boolean) {
  const inset = failed ? 0.28 : 0.36;
  return {
    s1: lerp(lerp(q.t1, q.t2, inset), lerp(q.b1, q.b2, inset), 0.08),
    s2: lerp(lerp(q.t1, q.t2, 1 - inset), lerp(q.b1, q.b2, 1 - inset), 0.08),
    s3: lerp(lerp(q.t1, q.t2, 1 - inset), lerp(q.b1, q.b2, 1 - inset), 0.62),
    s4: lerp(lerp(q.t1, q.t2, inset), lerp(q.b1, q.b2, inset), 0.62),
  };
}

export function drawDrum(
  canvas: HTMLCanvasElement,
  opts: { angleDeg: number; figures: Figure[]; heat: number; frozen: boolean; blur: boolean },
): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.filter = opts.blur && !opts.frozen ? "blur(1.05px)" : "none";

  ctx.fillStyle = "rgba(8,5,3,0.38)";
  ctx.beginPath();
  ctx.ellipse(CX, 404, 210, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  ellipse(ctx, BOT_CY, BOT_RX + 8, BOT_RY + 5, "#24160f", "#8d6a2e", 12);

  const bays = opts.figures.map((fig, i) => {
    const theta = ((opts.angleDeg + i * 30) * Math.PI) / 180;
    return { fig, i, theta, depth: Math.cos(theta) };
  });

  const back = [...bays].filter((b) => b.depth < 0.08).sort((a, b) => a.depth - b.depth);
  const front = [...bays].filter((b) => b.depth >= 0.08).sort((a, b) => a.depth - b.depth);

  const paintWall = (bay: (typeof bays)[number], withSlit: boolean) => {
    const q = wallQuad(bay.theta);
    const shade = 0.38 + bay.depth * 0.28;
    const walnut = `rgb(${Math.round(44 + shade * 36)}, ${Math.round(24 + shade * 16)}, ${Math.round(14 + shade * 8)})`;
    fillQuad(ctx, q.t1, q.t2, q.b2, q.b1, walnut);
    fillQuad(ctx, q.t1, q.t2, lerp(q.t2, q.b2, 0.08), lerp(q.t1, q.b1, 0.08), "#c9a15b");
    fillQuad(ctx, lerp(q.t1, q.b1, 0.92), lerp(q.t2, q.b2, 0.92), q.b2, q.b1, "#b08a40");
    if (withSlit) {
      const s = slitQuad(q, Boolean(bay.fig?.failed));
      fillQuad(ctx, s.s1, s.s2, s.s3, s.s4, bay.fig?.failed ? "#b83320" : "#050302");
    }
    return q;
  };

  for (const bay of back) paintWall(bay, true);

  ellipse(ctx, TOP_CY + 18, TOP_RX - 22, TOP_RY + 8, "#1b120c");

  for (const bay of back) {
    if (!bay.fig) continue;
    const inner = rim(TOP_RX - 36, TOP_RY + 6, TOP_CY + 28, bay.theta);
    const scale = 0.72 + (1 + bay.depth) * 0.18;
    drawCard(ctx, bay.fig, inner.x - 22 * scale, inner.y - 6, 46 * scale, 68 * scale);
  }

  for (const bay of front) {
    const q = paintWall(bay, true);
    if (!bay.fig) continue;
    const s = slitQuad(q, Boolean(bay.fig.failed));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(s.s1.x, s.s1.y);
    ctx.lineTo(s.s2.x, s.s2.y);
    ctx.lineTo(s.s3.x, s.s3.y);
    ctx.lineTo(s.s4.x, s.s4.y);
    ctx.closePath();
    ctx.clip();
    const mid = lerp(s.s1, s.s4, 0.35);
    drawCard(ctx, bay.fig, mid.x - 18, mid.y, 42, 62);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.ellipse(CX, TOP_CY, TOP_RX, TOP_RY, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "#6d5224";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(CX, TOP_CY, TOP_RX + 5, TOP_RY + 4, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "#c9a15b";
  ctx.lineWidth = 10;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(CX, TOP_CY + 4, 6, 3.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#8d6a2e";
  ctx.fill();

  if (opts.heat > 0.55) {
    ctx.fillStyle = `rgba(243,197,107,${0.04 + opts.heat * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(CX - 48, 214, 128, 96, -0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.filter = "none";
}
