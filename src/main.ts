import "@fontsource/fraunces/700.css";
import "@fontsource/eb-garamond/500.css";
import "@fontsource/eb-garamond/500-italic.css";
import "@fontsource/special-elite/400.css";
import "./styles.css";
import { drawDrum } from "./drum";
import { BAY_COUNT, pullSample, type Figure, type Sample } from "./solana";
import { familyWord, figureMarkup } from "./figures";

const parlor = document.querySelector("#parlor")!;
const canvas = document.querySelector<HTMLCanvasElement>("#drum")!;
const peek = document.querySelector("#peek")!;
const peephole = document.querySelector("#peephole")!;
const caption = document.querySelector("#caption")!;
const slotStamp = document.querySelector("#slot-stamp")!;
const gem = document.querySelector("#gem")!;
const lamp = document.querySelector("#lamp")!;
const lampCaption = document.querySelector("#lamp-caption")!;
const crank = document.querySelector<HTMLButtonElement>("#crank")!;
const shutter = document.querySelector<HTMLButtonElement>("#shutter")!;
const stripWrap = document.querySelector<HTMLElement>("#strip-wrap")!;
const strip = document.querySelector("#strip")!;
const stripLabel = document.querySelector("#strip-label")!;

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reduced) parlor.classList.add("stepped");

let sample: Sample | null = null;
let displaySlot = 0;
let crankHeld = false;
let shutterClosed = false;
let crankAngle = 22;
let lastSkip = 1;

function frozen(): boolean {
  return crankHeld || shutterClosed;
}

function bayIndex(slot: number): number {
  return ((slot % BAY_COUNT) + BAY_COUNT) % BAY_COUNT;
}

function lampWords(heat: number): string {
  if (heat > 0.72) return "lamp hot";
  if (heat > 0.38) return "lamp warm";
  return "lamp mild";
}

function writeCaption(next: Sample, held: boolean): void {
  const slot = next.slot.toLocaleString("en-US");
  const heat = lampWords(next.heat);
  const torn =
    next.torn === 0
      ? "Every figure held together."
      : next.torn === 1
        ? "One torn figure this strip."
        : `${next.torn} torn figures this strip.`;

  if (held) {
    caption.innerHTML = `The strip is held at slot <strong>${slot}</strong>. ${torn} The ${heat.replace("lamp ", "lamp stays ")}.`;
    return;
  }

  if (next.stale) {
    caption.innerHTML = `The wire stuttered. Last good strip is slot <strong>${slot}</strong>. ${torn}`;
    return;
  }

  const busy =
    next.heat > 0.72
      ? "The lamp is running hot — the shutter flickers."
      : next.heat > 0.38
        ? "The lamp is warm; the wire is busy."
        : "The lamp is mild.";

  caption.innerHTML = `The drum ticked to slot <strong>${slot}</strong>. ${busy} ${torn}`;
}

function paintFigure(el: Element, fig: Figure | undefined): void {
  if (!fig) {
    el.innerHTML = `<span class="callsign">—</span>`;
    return;
  }
  el.innerHTML = figureMarkup(fig.family, fig.pose, fig.failed, fig.callsign);
}

function paintCanvas(next: Sample, slot: number, skip: number): void {
  const angle = reduced ? 14 : bayIndex(slot) * 30;
  drawDrum(canvas, {
    angleDeg: angle,
    figures: next.figures,
    heat: next.heat,
    frozen: frozen(),
    blur: !reduced && !frozen() && (skip > 2 || next.heat > 0.7),
  });
}

function paintStrip(next: Sample, current: number): void {
  strip.replaceChildren();
  next.figures.forEach((fig, i) => {
    const card = document.createElement("article");
    card.className = `strip-card${fig.failed ? " torn" : ""}${i === current ? " current" : ""}`;
    card.title = `${familyWord(fig.family)} · ${fig.callsign}`;
    card.innerHTML = figureMarkup(fig.family, fig.pose, fig.failed, fig.callsign);
    strip.append(card);
  });
}

function showStrip(why: string): void {
  stripWrap.hidden = false;
  stripLabel.textContent = why;
}

function hideStripIfIdle(): void {
  if (!reduced && !frozen()) stripWrap.hidden = true;
}

function applyHeat(heat: number): void {
  document.documentElement.style.setProperty("--heat", heat.toFixed(3));
  lamp.classList.toggle("hot", heat > 0.72);
  lampCaption.textContent = lampWords(heat);
  peephole.classList.toggle("flicker", heat > 0.62 && !frozen() && !reduced);
}

function turnCrank(skip: number): void {
  if (frozen()) return;
  crankAngle = (crankAngle + 17 + skip * 7) % 360;
  crank.style.setProperty("--crank", `${crankAngle}deg`);
}

function revealPeek(next: Sample, slot: number): void {
  const fig = next.figures[bayIndex(slot)];
  paintFigure(peek, fig);
  peephole.classList.toggle("closed", shutterClosed);
}

function render(next: Sample, slot: number, skip = 1): void {
  lastSkip = skip;
  slotStamp.textContent = `slot ${slot.toLocaleString("en-US")}`;
  gem.className = `gem${next.stale ? " stale" : ""}`;
  applyHeat(next.heat);
  paintCanvas(next, slot, skip);
  revealPeek(next, slot);
  if (!frozen()) turnCrank(skip);

  if (reduced || frozen()) {
    showStrip(shutterClosed ? "Shutter closed — the strip" : crankHeld ? "Crank held — the strip" : "Stepped strip");
    paintStrip(next, bayIndex(slot));
  } else {
    hideStripIfIdle();
  }

  writeCaption({ ...next, slot }, frozen());
  window.setTimeout(() => {
    if (sample) paintCanvas(sample, displaySlot, lastSkip);
  }, 90);
}

function hold(on: boolean, via: "crank" | "shutter"): void {
  if (via === "crank") crankHeld = on;
  if (via === "shutter") shutterClosed = on;
  crank.setAttribute("aria-pressed", String(crankHeld));
  shutter.setAttribute("aria-pressed", String(shutterClosed));
  parlor.classList.toggle("held", frozen());
  if (sample) render(sample, displaySlot, 0);
}

crank.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  try {
    if (event.pointerId >= 0) crank.setPointerCapture(event.pointerId);
  } catch {
    /* synthetic events have no capture */
  }
  hold(true, "crank");
});
crank.addEventListener("pointerup", () => hold(false, "crank"));
crank.addEventListener("pointercancel", () => hold(false, "crank"));
crank.addEventListener("lostpointercapture", () => hold(false, "crank"));

shutter.addEventListener("click", () => hold(!shutterClosed, "shutter"));

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" && !event.repeat && event.target === document.body) {
    event.preventDefault();
    hold(true, "crank");
  }
});
window.addEventListener("keyup", (event) => {
  if (event.code === "Space") hold(false, "crank");
});

async function refresh(): Promise<void> {
  try {
    const next = await pullSample();
    sample = next;
    if (!frozen()) {
      const skip = displaySlot ? Math.max(1, next.slot - displaySlot) : 1;
      displaySlot = next.slot;
      render(next, displaySlot, skip);
    } else {
      gem.className = next.stale ? "gem stale" : "gem";
    }
  } catch {
    gem.className = "gem dead";
    if (!sample) {
      caption.textContent = "The wire is quiet. The last strip never arrived.";
    }
  }
}

function localTick(): void {
  if (!sample || frozen() || reduced) return;
  const age = Date.now() - sample.fetchedAt;
  const guessed = sample.slot + Math.min(5, Math.floor(age / 400));
  if (guessed === displaySlot) return;
  const skip = guessed - displaySlot;
  displaySlot = guessed;
  render(sample, displaySlot, skip);
}

if (reduced) showStrip("Stepped strip");

void document.fonts.ready.then(() => {
  if (sample) render(sample, displaySlot, 0);
});
void refresh();
window.setInterval(() => void refresh(), 8000);
window.setInterval(localTick, 400);
