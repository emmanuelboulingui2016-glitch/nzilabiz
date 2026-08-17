"use client";

// Rendu d'un QR code en SVG.
//
// La génération se fait dans le navigateur (bibliothèque `qrcode`) et produit du SVG plutôt qu'une
// image : net à toutes les tailles, imprimable, et il suit les couleurs du thème.

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

export function QrCode({
  valeur,
  taille = 200,
  className,
}: {
  valeur: string;
  taille?: number;
  className?: string;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let annule = false;
    QRCode.toString(valeur, {
      type: "svg",
      margin: 1,
      width: taille,
      // Correction moyenne : lisible même si le téléphone scanne un écran un peu sale ou de biais.
      errorCorrectionLevel: "M",
      color: { dark: "#0b5a38", light: "#ffffff" },
    })
      .then((res) => {
        if (!annule) setSvg(res);
      })
      .catch(() => {
        if (!annule) setErreur(true);
      });
    return () => {
      annule = true;
    };
  }, [valeur, taille]);

  if (erreur) {
    return <p className="text-xs text-danger">QR code impossible à générer.</p>;
  }

  return (
    <div
      className={cn("inline-block rounded-xl bg-white p-2 shadow-sm", className)}
      style={{ width: taille + 16, height: taille + 16 }}
      // Le SVG vient de la bibliothèque locale, à partir d'une chaîne que nous construisons :
      // aucune donnée extérieure n'est injectée ici.
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      aria-hidden
    />
  );
}
