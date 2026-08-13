import { useEffect, useRef } from "react";

/**
 * Listens for rapid keyboard input that ends with Enter/Tab — the signature
 * of a USB/Bluetooth barcode scanner gun. Falls through to normal typing
 * inside inputs (unless the input is a hidden scanner sink).
 */
export function useHardwareScanner(onScan: (code: string) => void, enabled = true) {
  const bufferRef = useRef("");
  const lastTimeRef = useRef(0);
  const callbackRef = useRef(onScan);
  callbackRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    function handler(e: KeyboardEvent) {
      // Ignore typing into visible inputs / textareas unless it's our sink.
      const t = e.target as HTMLElement | null;
      const isSink = t?.dataset?.hardwareScanner === "true";
      const isEditable =
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          (t as HTMLElement).isContentEditable);
      if (isEditable && !isSink) return;

      const now = Date.now();
      // Scanner guns fire keystrokes fast (~<40ms apart). Reset on long gaps.
      if (now - lastTimeRef.current > 300) bufferRef.current = "";
      lastTimeRef.current = now;

      if (e.key === "Enter" || e.key === "Tab") {
        const code = bufferRef.current.trim();
        bufferRef.current = "";
        if (code.length >= 3) {
          e.preventDefault();
          callbackRef.current(code);
        }
        return;
      }
      if (e.key.length === 1) bufferRef.current += e.key;
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}
