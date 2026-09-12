import "./styles.css";
import { BAY_COUNT, pullSample, type Figure, type Sample } from "./solana";
import { familyWord, figureMarkup } from "./figures";

const parlor = document.querySelector("#parlor")!;
const drum = document.querySelector<HTMLElement>("#drum")!;
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
let crankAngle = 18;

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

function ensureBays(): HTMLElement[] {
  const existing = [...drum.querySelectorAll<HTMLElement>(".bay")];
  if (existing.length === BAY_COUNT) return existing;

  for (let i = 0; i < BAY_COUNT; i++) {
    const bay = document.createElement("div");
    bay.className = "bay";
    bay.style.setProperty("--i", String(i));
    bay.innerHTML = `
      <div class="wall"><i class="slit"></i></div>
      <article class="paper"></article>
    `;
    drum.append(bay);
  }
  return [...drum.querySelectorAll<HTMLElement>(".bay")];
}

function paintDrum(next: Sample): void {
  const bays = ensureBays();
  bays.forEach((bay, i) => {
    const fig = next.figures[i];
    const wall = bay.querySelector(".wall")!;
    const paper = bay.querySelector(".paper")!;
    wall.classList.toggle("jammed", Boolean(fig?.failed));
    paper.classList.toggle("torn", Boolean(fig?.failed));
    paper.setAttribute("data-family", fig?.family ?? "unknown");
    paintFigure(paper, fig);
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
  drum.classList.toggle("blurry", heat > 0.7 && !frozen() && !reduced);
}

function turnDrum(slot: number, skip: number): void {
  if (reduced) {
    drum.style.setProperty("--angle", "12deg");
    return;
  }
  const angle = bayIndex(slot) * 30;
  drum.classList.toggle("blurry", skip > 2 || (sample?.heat ?? 0) > 0.7);
  drum.style.setProperty("--angle", `${angle}deg`);
  crankAngle = (crankAngle + 17 + skip * 7) % 360;
  crank.style.setProperty("--crank", `${crankAngle}deg`);
}

function revealPeek(next: Sample, slot: number): void {
  const fig = next.figures[bayIndex(slot)];
  paintFigure(peek, fig);
  peephole.classList.toggle("closed", shutterClosed);
}

function render(next: Sample, slot: number, skip = 1): void {
  slotStamp.textContent = `slot ${slot.toLocaleString("en-US")}`;
  gem.className = `gem${next.stale ? " stale" : ""}`;
  applyHeat(next.heat);
  paintDrum(next);
  revealPeek(next, slot);
  if (!frozen()) turnDrum(slot, skip);

  if (reduced || frozen()) {
    showStrip(shutterClosed ? "Shutter closed — the strip" : crankHeld ? "Crank held — the strip" : "Stepped strip");
    paintStrip(next, bayIndex(slot));
  } else {
    hideStripIfIdle();
  }

  writeCaption({ ...next, slot }, frozen());
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
  crank.setPointerCapture(event.pointerId);
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
  // Solana slots are ~400ms; we only increment while waiting on the next pull.
  const age = Date.now() - sample.fetchedAt;
  const guessed = sample.slot + Math.min(5, Math.floor(age / 400));
  if (guessed === displaySlot) return;
  const skip = guessed - displaySlot;
  displaySlot = guessed;
  render(sample, displaySlot, skip);
}

ensureBays();
if (reduced) showStrip("Stepped strip");

void refresh();
window.setInterval(() => void refresh(), 8000);
window.setInterval(localTick, 400);
