export type Family = "system" | "token" | "dex" | "nft" | "unknown";

export type Figure = {
  signature: string;
  callsign: string;
  family: Family;
  failed: boolean;
  slot: number;
  pose: number;
};

export type Sample = {
  slot: number;
  fetchedAt: number;
  figures: Figure[];
  heat: number;
  torn: number;
  nonVotePerSlot: number;
  stale: boolean;
  source: string;
};

const ENDPOINTS = [
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
];

const PROGRAMS: { id: string; family: Family }[] = [
  { id: "11111111111111111111111111111111", family: "system" },
  { id: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", family: "token" },
  { id: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", family: "dex" },
  { id: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s", family: "nft" },
];

const BAYS = 12;

type SigRow = {
  signature: string;
  slot: number;
  err: unknown;
};

let lastGood: Sample | null = null;
let endpointCursor = 0;
let backoffMs = 0;
let nextAllowedAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function callsign(signature: string): string {
  return signature.slice(0, 4);
}

function poseFrom(signature: string): number {
  let n = 0;
  for (let i = 0; i < 6; i++) n = (n * 33 + signature.charCodeAt(i)) >>> 0;
  return n % 6;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

async function rpc<T>(method: string, params: unknown[]): Promise<{ value: T; endpoint: string }> {
  if (Date.now() < nextAllowedAt) {
    await sleep(nextAllowedAt - Date.now());
  }

  let lastErr = "no endpoint answered";
  let delay = 500;

  for (let attempt = 0; attempt < 4; attempt++) {
    const endpoint = ENDPOINTS[(endpointCursor + attempt) % ENDPOINTS.length];
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });

      if (res.status === 429 || res.status === 503) {
        lastErr = `${endpoint} ${res.status}`;
        backoffMs = backoffMs === 0 ? 2000 : Math.min(backoffMs * 2, 16000);
        nextAllowedAt = Date.now() + backoffMs;
        await sleep(delay);
        delay *= 2;
        continue;
      }

      if (!res.ok) {
        lastErr = `${endpoint} ${res.status}`;
        continue;
      }

      const json: { result?: T; error?: { message?: string } } = await res.json();
      if (json.error) {
        lastErr = json.error.message ?? "rpc error";
        continue;
      }

      endpointCursor = (endpointCursor + attempt) % ENDPOINTS.length;
      backoffMs = 0;
      return { value: json.result as T, endpoint };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "fetch failed";
      await sleep(delay);
      delay *= 2;
    }
  }

  throw new Error(lastErr);
}

async function signaturesFor(program: string, limit: number): Promise<SigRow[]> {
  const { value } = await rpc<SigRow[]>( "getSignaturesForAddress", [
    program,
    { limit, commitment: "confirmed" },
  ]);
  return value ?? [];
}

function interleave(groups: Figure[][]): Figure[] {
  const out: Figure[] = [];
  const used = new Set<string>();
  const max = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < max; i++) {
    for (const group of groups) {
      const fig = group[i];
      if (!fig || used.has(fig.signature)) continue;
      used.add(fig.signature);
      out.push(fig);
      if (out.length >= BAYS) return out;
    }
  }
  return out;
}

function heatFromPerf(
  samples: { numNonVoteTransactions?: number; numTransactions: number; numSlots: number }[],
  fees: { prioritizationFee: number }[],
): { heat: number; nonVotePerSlot: number } {
  const newest = samples[0];
  const nv = newest
    ? (newest.numNonVoteTransactions ?? newest.numTransactions * 0.45) / Math.max(1, newest.numSlots)
    : 0;

  // Calm wire ~350–500 non-vote tx/slot; a crowded parlor sits nearer 1200+.
  const traffic = clamp01((nv - 320) / 1400);

  const paid = fees.map((f) => f.prioritizationFee).filter((n) => n > 0);
  let feeHeat = 0;
  if (paid.length > 0) {
    const ranked = [...paid].sort((a, b) => a - b);
    const p90 = ranked[Math.floor(ranked.length * 0.9)] ?? 0;
    feeHeat = clamp01(Math.log10(p90 + 1) / 6);
  }

  return { heat: Math.max(traffic, feeHeat), nonVotePerSlot: nv };
}

export async function pullSample(): Promise<Sample> {
  try {
    const [slotRes, perfRes, feeRes, ...sigRes] = await Promise.allSettled([
      rpc<number>("getSlot", [{ commitment: "confirmed" }]),
      rpc<{ numNonVoteTransactions?: number; numTransactions: number; numSlots: number }[]>(
        "getRecentPerformanceSamples",
        [4],
      ),
      rpc<{ slot: number; prioritizationFee: number }[]>("getRecentPrioritizationFees", [[]]),
      ...PROGRAMS.map((p) => signaturesFor(p.id, 6)),
    ]);

    if (slotRes.status !== "fulfilled") {
      throw slotRes.reason instanceof Error ? slotRes.reason : new Error("slot failed");
    }

    const slot = slotRes.value.value;
    const source = slotRes.value.endpoint;

    const groups = PROGRAMS.map((program, i) => {
      const rows = sigRes[i];
      if (rows.status !== "fulfilled") return [] as Figure[];
      return rows.value.map((row) => ({
        signature: row.signature,
        callsign: callsign(row.signature),
        family: program.family,
        failed: row.err != null,
        slot: row.slot,
        pose: poseFrom(row.signature),
      }));
    });

    let figures = interleave(groups);
    if (figures.length < BAYS && lastGood) {
      const seen = new Set(figures.map((f) => f.signature));
      for (const fig of lastGood.figures) {
        if (seen.has(fig.signature)) continue;
        figures.push(fig);
        if (figures.length >= BAYS) break;
      }
    }
    figures = figures.slice(0, BAYS);

    const samples = perfRes.status === "fulfilled" ? perfRes.value.value : [];
    const fees = feeRes.status === "fulfilled" ? feeRes.value.value : [];
    const { heat, nonVotePerSlot } = heatFromPerf(samples, fees);

    const sample: Sample = {
      slot,
      fetchedAt: Date.now(),
      figures,
      heat,
      torn: figures.filter((f) => f.failed).length,
      nonVotePerSlot,
      stale: false,
      source,
    };
    lastGood = sample;
    return sample;
  } catch (err) {
    if (lastGood) {
      return { ...lastGood, stale: true };
    }
    throw err instanceof Error ? err : new Error("wire quiet");
  }
}

export function lastSample(): Sample | null {
  return lastGood;
}

export const BAY_COUNT = BAYS;
