import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Keyboard, X } from "lucide-react";

interface Props {
  onDetected: (code: string) => void;
  onClose?: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "camera") return;
    const reader = new BrowserMultiFormatReader();
    let stopFn: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const deviceId =
          devices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ??
          devices[0]?.deviceId;
        if (!deviceId) throw new Error("No camera found");
        if (cancelled) return;
        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current!,
          (result) => {
            if (result) {
              onDetected(result.getText());
            }
          },
        );
        stopFn = () => controls.stop();
      } catch (e: any) {
        setError(e?.message ?? "Camera unavailable");
      }
    })();

    return () => {
      cancelled = true;
      stopFn?.();
    };
  }, [mode, onDetected]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 rounded-md border border-border bg-muted p-1 text-xs">
        <button
          type="button"
          onClick={() => setMode("camera")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 transition ${
            mode === "camera" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Camera className="h-3.5 w-3.5" /> Camera
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 transition ${
            mode === "manual" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Keyboard className="h-3.5 w-3.5" /> Manual
        </button>
      </div>

      {mode === "camera" ? (
        <div className="relative overflow-hidden rounded-lg border border-border bg-black">
          {error ? (
            <div className="flex aspect-video items-center justify-center bg-muted p-6 text-center text-sm text-muted-foreground">
              {error}. Switch to manual entry.
            </div>
          ) : (
            <>
              <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
              <div className="pointer-events-none absolute inset-8 rounded-md border-2 border-primary/70" />
            </>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) onDetected(manual.trim());
          }}
          className="flex flex-col gap-3"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="manual-barcode">Barcode / SKU</Label>
            <Input
              id="manual-barcode"
              value={manual}
              autoFocus
              onChange={(e) => setManual(e.target.value)}
              placeholder="Enter code…"
            />
          </div>
          <Button type="submit" disabled={!manual.trim()}>
            Look up
          </Button>
        </form>
      )}
    </div>
  );
}
