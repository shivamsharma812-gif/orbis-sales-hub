import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";

type Quote = { price: number; change: number; changePct: number } | null;
type Payload = { nifty: Quote; sensex: Quote; usdinr: Quote; gold: Quote; silver: Quote };

async function fetchQuotes(): Promise<Payload> {
  const res = await fetch("/api/market-quotes");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

function formatPrice(n: number, digits: number) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function Pill({
  label,
  quote,
  digits = 2,
  prefix,
  suffix,
}: {
  label: string;
  quote: Quote;
  digits?: number;
  prefix?: string;
  suffix?: string;
}) {
  if (!quote) return null;
  const up = quote.change >= 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-xs whitespace-nowrap shrink-0">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">
        {prefix}{formatPrice(quote.price, digits)}{suffix}
      </span>
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
  if (!data.nifty && !data.sensex && !data.usdinr && !data.gold && !data.silver) return null;

  return (
    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <Pill label="NIFTY" quote={data.nifty} />
      <Pill label="SENSEX" quote={data.sensex} />
      <Pill label="USD/INR" quote={data.usdinr} digits={4} />
      <Pill label="GOLD 10g" quote={data.gold} prefix="₹" digits={0} />
      <Pill label="SILVER 1kg" quote={data.silver} prefix="₹" digits={0} />
    </div>
  );
}

