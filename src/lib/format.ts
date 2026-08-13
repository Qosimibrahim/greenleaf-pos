export function getCurrencyCode(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("stockroom_currency") || "NGN";
  }
  return "NGN";
}

export function getExchangeRate(): number {
  if (typeof window !== "undefined") {
    const r = parseFloat(localStorage.getItem("stockroom_exchange_rate") || "1");
    return Number.isFinite(r) && r > 0 ? r : 1;
  }
  return 1;
}

export function money(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  const num = Number.isFinite(v) ? v : 0;
  
  const currency = getCurrencyCode();
  const rate = getExchangeRate();

  const converted = rate !== 1 ? num * rate : num;
  
  const _fmt = new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-US", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 2,
  });

  const formatted = _fmt.format(converted);

  if (currency === "NGN") {
    // Normalise to ₦ without weird prefix variants
    return "₦" + formatted.replace(/^[₦NGN\s]+/, "");
  }
  return formatted;
}

export function shortDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function productStatus(qty: number, threshold: number) {
  if (qty <= 0) return "out_of_stock" as const;
  if (qty <= threshold) return "low_stock" as const;
  return "in_stock" as const;
}
