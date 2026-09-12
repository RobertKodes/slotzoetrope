import type { Family } from "./solana";

const POSES = [
  // Gentleman — top hat and coat-tails
  `<path d="M18 4h12v5H18z"/><path d="M14 9h20v2H14z"/><circle cx="24" cy="16" r="4.2"/><path d="M16 21h16l3 18H13z"/><path d="M15 39h6v12h-6z"/><path d="M27 39h6v12h-6z"/><path d="M13 24h-6l-1 8h6z"/><path d="M35 24h6l1 8h-6z"/>`,
  // Walking horse
  `<path d="M10 24c2-8 8-12 16-11l6-7 3 1-2 7c6 1 9 6 9 11l-5 1-1 12h-5l1-10-6 2-1 8h-5l1-8-7 1-2 9H9l2-15z"/>`,
  // Bird in flight
  `<path d="M24 18c4-2 14-8 18-6-6 4-10 8-12 12 8 0 16 3 18 7-8-1-16-1-22 2-6-3-14-3-22-2 2-4 10-7 18-7-2-4-6-8-12-12 4-2 14 4 18 6z"/>`,
  // Hoop dancer
  `<circle cx="24" cy="12" r="3.6"/><path d="M20 16h8l2 10-6 4 2 14h-5l-1-12-5 3 2-19z"/><circle cx="24" cy="28" r="13" fill="none" stroke="currentColor" stroke-width="2.4"/>`,
  // Cat, seated
  `<path d="M14 14l4 8h12l4-8-5 4-5-6-5 6z"/><circle cx="24" cy="26" r="9"/><path d="M16 32c0 8 4 14 8 14s8-6 8-14"/><path d="M31 36c5 2 9 1 11-2"/>`,
  // Carriage
  `<path d="M8 24h8l4-8h16l4 8h4v8H8z"/><circle cx="16" cy="36" r="5"/><circle cx="36" cy="36" r="5"/><path d="M20 16h8v8h-8z"/>`,
] as const;

const FAMILY_TINT: Record<Family, string> = {
  system: "var(--walnut)",
  token: "var(--brass)",
  dex: "var(--lampglow)",
  nft: "var(--vermilion)",
  unknown: "var(--soot)",
};

export function figureMarkup(family: Family, pose: number, failed: boolean, callsign: string): string {
  const body = POSES[pose % POSES.length];
  const tint = FAMILY_TINT[family];
  const tear = failed
    ? `clip-path: polygon(0% 0%, 92% 4%, 100% 22%, 86% 41%, 100% 63%, 78% 82%, 94% 100%, 0% 100%)`
    : "";
  return `
    <svg class="cutout" viewBox="0 0 48 48" aria-hidden="true" style="color:${tint};${tear}">
      <g fill="currentColor">${body}</g>
    </svg>
    <span class="callsign">${callsign}</span>
  `;
}

export function familyWord(family: Family): string {
  switch (family) {
    case "system":
      return "walnut ink";
    case "token":
      return "brass";
    case "dex":
      return "lampglow";
    case "nft":
      return "vermilion";
    default:
      return "soot";
  }
}
