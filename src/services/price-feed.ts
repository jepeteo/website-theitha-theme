const TWELVE_DATA_BASE = "https://api.twelvedata.com";

export type LivePrice = {
  symbol: string;
  price: number;
  fetchedAt: string;
};

/**
 * Fetches the current price for a symbol from Twelve Data.
 * Symbol format: "XAU/USD", "EUR/USD", etc.
 */
export async function fetchLivePrice(
  symbol: string,
  apiKey: string
): Promise<LivePrice> {
  const url = `${TWELVE_DATA_BASE}/price?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Twelve Data HTTP error: ${res.status}`);
  }

  const data = (await res.json()) as Record<string, unknown>;

  if (data.status === "error" || data.code !== undefined) {
    throw new Error(`Twelve Data API error: ${String(data.message ?? data.code)}`);
  }

  const price = Number(data.price);
  if (!price || isNaN(price)) {
    throw new Error(`Twelve Data returned invalid price: ${String(data.price)}`);
  }

  return {
    symbol,
    price,
    fetchedAt: new Date().toISOString()
  };
}

/**
 * Maps an internal signal symbol (e.g. "XAUUSD") to Twelve Data format ("XAU/USD").
 */
export function toTwelveDataSymbol(symbol: string): string {
  const map: Record<string, string> = {
    XAUUSD: "XAU/USD",
    XAGUSD: "XAG/USD",
    WTIUSD: "WTI/USD",
    EURUSD: "EUR/USD",
    GBPUSD: "GBP/USD",
    USDJPY: "USD/JPY",
    USDCHF: "USD/CHF",
    BTCUSD: "BTC/USD",
    ETHUSD: "ETH/USD"
  };
  return map[symbol.toUpperCase()] ?? symbol;
}
