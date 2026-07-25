import { createFileRoute } from "@tanstack/react-router";

const SYMBOLS = {
  nifty: "^NSEI",
  sensex: "^BSESN",
  usdinr: "USDINR=X",
} as const;

type Key = keyof typeof SYMBOLS;

type Quote = { price: number; change: number; changePct: number } | null;

async function fetchQuote(symbol: string): Promise<Quote> {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const res = await fetch(url, {
      headers: {
        // Yahoo rejects requests without a UA
        "User-Agent":
          "Mozilla/5.0 (compatible; OrbisCRM/1.0; +https://lovable.dev)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      quoteResponse?: {
        result?: Array<{
          regularMarketPrice?: number;
          regularMarketChange?: number;
          regularMarketChangePercent?: number;
        }>;
      };
    };
    const r = json.quoteResponse?.result?.[0];
    if (!r || typeof r.regularMarketPrice !== "number") return null;
    return {
      price: r.regularMarketPrice,
      change: r.regularMarketChange ?? 0,
      changePct: r.regularMarketChangePercent ?? 0,
    };
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/market-quotes")({
  server: {
    handlers: {
      GET: async () => {
        const keys = Object.keys(SYMBOLS) as Key[];
        const results = await Promise.all(
          keys.map((k) => fetchQuote(SYMBOLS[k])),
        );
        const payload = Object.fromEntries(
          keys.map((k, i) => [k, results[i]]),
        ) as Record<Key, Quote>;
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
