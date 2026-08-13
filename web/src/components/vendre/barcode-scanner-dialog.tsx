"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Dialog } from "@/components/ui/dialog";

export function BarcodeScannerDialog({
  open,
  onClose,
  onDetected,
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, _err, controls) => {
        controlsRef.current = controls;
        if (cancelled || !result) return;
        controls.stop();
        onDetected(result.getText());
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Caméra indisponible sur cet appareil.");
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetected]);

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} title="Scanner un code-barres">
      <div className="space-y-3">
        <div className="overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
        </div>
        {error ? (
          <p className="text-sm text-danger">{error} Vous pouvez saisir le code manuellement dans le champ.</p>
        ) : (
          <p className="text-center text-sm text-muted-foreground">Placez le code-barres devant la caméra.</p>
        )}
      </div>
    </Dialog>
  );
}
