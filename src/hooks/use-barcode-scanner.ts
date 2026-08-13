/**
 * useBarcodeScanner
 *
 * Global keyboard listener that distinguishes hardware barcode-gun input
 * from normal typing by measuring the inter-key delay.  A barcode scanner
 * fires characters very rapidly (typically < 30 ms apart); a human typist
 * is far slower.
 *
 * Usage:
 *   useBarcodeScanner({
 *     onMatch:    (product) => addToCart(product),
 *     onNotFound: (code)    => openAddProductModal(code),
 *     enabled:    true,            // optional — set false to pause
 *     threshold:  50,              // optional — ms; gap above = human
 *     minLength:  4,               // optional — ignore codes shorter than N
 *   });
 */

import { useEffect, useRef, useCallback } from "react";
import { getToken } from "@/lib/api";

export interface ScannedProduct {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  selling_price: number;
  unit_cost?: number;
  quantity: number;
  low_stock_threshold?: number;
  imageUrl?: string;
  [key: string]: any;
}

export interface UseBarcodeScannerOptions {
  /** Called when the scanned code matches a product in the database. */
  onMatch: (product: ScannedProduct) => void;
  /** Called when no product was found for the scanned code. */
  onNotFound?: (code: string) => void;
  /** Set to false to temporarily disable the scanner listener. */
  enabled?: boolean;
  /**
   * Maximum gap in milliseconds between consecutive key-presses that is
   * considered "scanner input".  Gaps above this value reset the buffer
   * (human typing).  Default: 50 ms.
   */
  threshold?: number;
  /**
   * Minimum number of characters the accumulated code must have before
   * an API lookup is triggered.  Default: 4.
   */
  minLength?: number;
}

export function useBarcodeScanner({
  onMatch,
  onNotFound,
  enabled = true,
  threshold = 50,
  minLength = 4,
}: UseBarcodeScannerOptions): void {
  const bufferRef   = useRef<string>("");
  const lastKeyTime = useRef<number>(0);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lookup = useCallback(async (code: string) => {
    if (code.length < minLength) return;

    try {
      const token = getToken();
      const res = await fetch(`/api/products?sku=${encodeURIComponent(code)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.status === 404) {
        onNotFound?.(code);
        return;
      }
      if (!res.ok) throw new Error("Network error");

      const product: ScannedProduct = await res.json();
      // Server returns a single object (findOne), not an array
      if (product && product.id) {
        onMatch(product);
      } else {
        onNotFound?.(code);
      }
    } catch (err) {
      console.error("[BarcodeScanner] lookup failed:", err);
      onNotFound?.(code);
    }
  }, [minLength, onMatch, onNotFound]);

  useEffect(() => {
    if (!enabled) return;

    function handleKeydown(e: KeyboardEvent) {
      // Ignore modifier combos (Ctrl+, Alt+, Meta+) — they're app shortcuts
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Ignore keyboard wedge scanner inputs when focused on editable fields other than body
      const target = e.target as HTMLElement | null;
      if (target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )) {
        // If it's a normal input field, let it handle keypresses
        return;
      }

      // "Enter" signals end-of-barcode for most scanners
      if (e.key === "Enter") {
        const code = bufferRef.current.trim();
        bufferRef.current = "";
        lastKeyTime.current = 0;
        if (timerRef.current) clearTimeout(timerRef.current);

        if (code.length >= minLength) {
          lookup(code);
        }
        return;
      }

      // Only accumulate printable single characters
      if (e.key.length !== 1) return;

      const now = Date.now();
      const gap = now - lastKeyTime.current;

      // If the gap is too large this is a new human keypress — reset buffer
      if (lastKeyTime.current > 0 && gap > threshold) {
        bufferRef.current = "";
      }

      bufferRef.current += e.key;
      lastKeyTime.current = now;

      // Auto-flush after 100 ms of silence (handles scanners that don't
      // send a trailing Enter, or multi-format codes)
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const code = bufferRef.current.trim();
        bufferRef.current = "";
        lastKeyTime.current = 0;

        if (code.length >= minLength) {
          lookup(code);
        }
      }, 100);
    }

    window.addEventListener("keydown", handleKeydown, true);
    return () => {
      window.removeEventListener("keydown", handleKeydown, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, threshold, minLength, lookup]);
}
