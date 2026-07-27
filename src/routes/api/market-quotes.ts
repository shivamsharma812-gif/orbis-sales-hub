import { createFileRoute } from "@tanstack/react-router";

const SYMBOLS = {
  nifty: "^NSEI",
  sensex: "^BSESN",
  usdinr: "USDINR=X",
  gold: "GC=F", // COMEX gold, USD per troy ounce
  silver: "SI=F", // COMEX silver, USD per troy ounce
} as const;

type Key = keyof typeof SYMBOLS;

type Quote = { price: number; change: number; changePct: number } | null;

async function fetchQuote(symbol: string): Promise<Quote> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; OrbisCRM/1.0; +https://lovable.dev)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            previousClose?: number;
          };
        }>;
      };
    };
    const m = json.chart?.result?.[0]?.meta;
    const price = m?.regularMarketPrice;
    const prev = m?.chartPreviousClose ?? m?.previousClose;
    if (typeof price !== "number" || typeof prev !== "number" || prev === 0) return null;
    const change = price - prev;
    const changePct = (change / prev) * 100;
    return { price, change, changePct };
  } catch {
    return null;
  }
}

const OZ_TO_G = 31.1034768;

function convert(q: Quote, factor: number): Quote {
  if (!q) return null;
  const price = q.price * factor;
  const prev = (q.price - q.change) * factor;
  const change = price - prev;
  const changePct = prev === 0 ? 0 : (change / prev) * 100;
  return { price, change, changePct };
}

export const Route = createFileRoute("/api/market-quotes")({
  server: {
    handlers: {
      GET: async () => {
        const keys = Object.keys(SYMBOLS) as Key[];
        const results = await Promise.all(
          keys.map((k) => fetchQuote(SYMBOLS[k])),
        );
        const raw = Object.fromEntries(
          keys.map((k, i) => [k, results[i]]),
        ) as Record<Key, Quote>;

        const usd = raw.usdinr?.price ?? null;
        // Gold: convert USD/oz -> INR per 10g
        const gold = usd ? convert(raw.gold, (usd * 10) / OZ_TO_G) : null;
        // Silver: convert USD/oz -> INR per 1kg (1000g)
        const silver = usd ? convert(raw.silver, (usd * 1000) / OZ_TO_G) : null;

        const payload = {
          nifty: raw.nifty,
          sensex: raw.sensex,
          usdinr: raw.usdinr,
          gold,
          silver,
        };
        return new Response(JSON.stringify(payload), {
          headers: {
            "content-type": "application/json",
            "cache-control": "public, s-maxage=60, stale-while-revalidate=120",
          },
        });
      },
    },
  },
});
