import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";

type Quote = { price: number; change: number; changePct: number } | null;
type Payload = { nifty: Quote; sensex: Quote; usdinr: Quote };

async function fetchQuotes(): Promise<Payload> {
  const res = await fetch("/api/market-quotes");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

function formatPrice(n: number, isFx: boolean) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: isFx ? 4 : 2,
    maximumFractionDigits: isFx ? 4 : 2,
  });
}

function Pill({ label, quote, isFx = false }: { label: string; quote: Quote; isFx?: boolean }) {
  if (!quote) return null;
  const up = quote.change >= 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{formatPrice(quote.price, isFx)}</span>
      <span
        className={`flex items-center gap-0.5 font-mono tabular-nums ${
          up ? "text-emerald-600 dark:text-emerald-500" : "text-destructive"
        }`}
      >
        <Icon className="w-3 h-3" />
        {Math.abs(quote.changePct).toFixed(2)}%
      </span>
    </div>
  );
}

export function MarketTicker() {
  const { data } = useQuery({
    queryKey: ["market-quotes"],
    queryFn: fetchQuotes,
    refetchInterval: 60_000,
    staleTime: 60_000,
    retry: 1,
  });

  if (!data) return null;
  if (!data.nifty && !data.sensex && !data.usdinr) return null;

  return (
    <div className="hidden lg:flex items-center gap-2">
      <Pill label="NIFTY" quote={data.nifty} />
      <Pill label="SENSEX" quote={data.sensex} />
      <Pill label="USD/INR" quote={data.usdinr} isFx />
    </div>
  );
}
