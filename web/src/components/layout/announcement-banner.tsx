"use client";

// Bandeau d'annonce publié depuis l'administration (Réglages → Annonce). Le commerçant peut le
// masquer : le texte est mémorisé dans le navigateur, une annonce modifiée réapparaît donc, une
// annonce déjà lue non.

import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";

const STORAGE_KEY = "nzilabiz.annonce.masquee";

export function AnnouncementBanner({ message }: { message: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem(STORAGE_KEY) !== message);
  }, [message]);

  if (!visible) return null;

  return (
    <div className="flex items-start gap-2 border-b border-primary/30 bg-primary/10 px-4 py-2.5 text-sm">
      <Megaphone size={16} className="mt-0.5 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 font-medium">{message}</p>
      <button
        onClick={() => {
          window.localStorage.setItem(STORAGE_KEY, message);
          setVisible(false);
        }}
        aria-label="Masquer l'annonce"
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-primary/10"
      >
        <X size={15} />
      </button>
    </div>
  );
}
