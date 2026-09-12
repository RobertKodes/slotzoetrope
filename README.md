# Slotzoetrope

Live Solana mainnet as a **Victorian zoetrope**.

**LIVE:** https://robertkodes.github.io/slotzoetrope/

The drum ticks with the slot clock. Figures glimpsed through the slits are recent transactions — costume color by program family. Lamp heat and shutter flicker are fee pressure / a crowded wire. Torn paper and jammed slits are failed txs. Hold the crank, or close the shutter, to freeze the current strip.

Not an explorer. Not a dashboard. Not a newspaper. No wallet.

## Run

```bash
npm i && npm run dev
```

Then open the Vite URL at `/slotzoetrope/` (the Pages base path). Preview the production build with `npm run build && npm run preview`.

## Design tokens

Named hex — parlor cabinet, not a SaaS theme:

| Token | Hex | Use |
| --- | --- | --- |
| Soot | `#140E09` | parlor dark, unknown costumes |
| Walnut | `#3D2416` | cabinet wood, System ink |
| Brass | `#C9A15B` | fittings, Token costumes |
| Lampglow | `#F3C56B` | oil lamp, Jup/DEX-ish costumes |
| Parchment | `#E6D3B0` | paper figures |
| Vermilion | `#B83320` | torn paper, NFT-ish costumes |

Fonts: **Fraunces** (display), **EB Garamond** (body), **Special Elite** (stamps and slot plate).

## Mapping

| On the drum | On the wire |
| --- | --- |
| Crank tick / drum rotation | Confirmed Solana slot |
| Paper figure + 4-letter callsign | A recent signature (prefix of the sig) |
| Costume tint | Program family sampled from that program's recent signatures |
| Lamp heat, spin blur, shutter flicker | `getRecentPerformanceSamples` traffic and any non-zero priority fees |
| Torn figure, jammed slit | Signature `err` is set |
| Hold crank / close shutter | Freeze the strip (and the peephole) |
| `prefers-reduced-motion` | No spin — a stepped paper strip instead |

Families, sampled from mainnet program ids:

- **System** — `11111111111111111111111111111111`
- **Token** — `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
- **Jup/DEX-ish** — `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`
- **NFT-ish** — `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`

Public RPCs (`api.mainnet-beta.solana.com`, `solana-rpc.publicnode.com`) with backoff and a cached last-good sample when the wire 429s.

## Deploy

GitHub Actions builds on every PR and deploys **GitHub Pages** from `main` (`actions/deploy-pages`). After merge the toy should be at the LIVE URL above.
