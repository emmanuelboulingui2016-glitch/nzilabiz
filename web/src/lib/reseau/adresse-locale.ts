import os from "node:os";

// Adresse par laquelle un téléphone du même réseau peut joindre cet ordinateur.
//
// Utile en présentation ou en boutique tant que l'application n'est pas en ligne : le QR code
// d'installation doit pointer vers une adresse joignable, et « localhost » n'en est pas une pour
// un téléphone.
//
// Les cartes virtuelles (VMware, VirtualBox, Hyper-V, Docker, WSL) et les tunnels VPN créent des
// réseaux auxquels le téléphone n'est jamais connecté. Les proposer enverrait vers une adresse
// morte, avec un QR code qui a pourtant l'air correct : on les écarte explicitement.

const INTERFACE_VIRTUELLE =
  /vmnet|vmware|virtualbox|vethernet|hyper-?v|docker|loopback|bluetooth|wsl|tailscale|zerotier|nord|wireguard|openvpn|mullvad|radmin|vpn|tun\d*$|tap\d*$/i;
const INTERFACE_WIFI = /wi-?fi|wlan|sans fil/i;
const INTERFACE_CABLE = /ethernet|^eth|^en\d/i;

export type AdresseReseau = {
  /** Nom de la carte réseau, tel que le système l'expose (« Wi-Fi », « Ethernet »…). */
  interface: string;
  /** Adresse IPv4, sans schéma ni port. */
  adresse: string;
};

/** Vrai pour les plages réservées aux réseaux locaux (RFC 1918). */
function estReseauPrive(ip: string): boolean {
  if (ip.startsWith("192.168.") || ip.startsWith("10.")) return true;
  const [a, b] = ip.split(".").map(Number);
  return a === 172 && b >= 16 && b <= 31;
}

/**
 * Adresses IPv4 locales, la plus probable en premier : Wi-Fi, puis câble, puis le reste.
 * Retourne un tableau vide si la machine n'est sur aucun réseau.
 */
export function adressesLocales(): AdresseReseau[] {
  const trouvees: AdresseReseau[] = [];

  for (const [nom, cartes] of Object.entries(os.networkInterfaces())) {
    if (INTERFACE_VIRTUELLE.test(nom)) continue;
    for (const carte of cartes ?? []) {
      if (carte.family !== "IPv4" || carte.internal) continue;
      if (!estReseauPrive(carte.address)) continue;
      trouvees.push({ interface: nom, adresse: carte.address });
    }
  }

  const rang = (nom: string) => (INTERFACE_WIFI.test(nom) ? 0 : INTERFACE_CABLE.test(nom) ? 1 : 2);
  return trouvees.sort((a, b) => rang(a.interface) - rang(b.interface));
}

/** Adresse la plus probable, ou `null` si la machine n'est sur aucun réseau. */
export function adresseLocalePrincipale(): string | null {
  return adressesLocales()[0]?.adresse ?? null;
}

/**
 * URL complète à mettre dans le QR code d'installation, construite à partir du port réellement
 * utilisé. `hote` est l'en-tête Host de la requête en cours (« localhost:3000 », « 192.168.1.67:3000 »).
 */
export function urlReseauLocal(hote: string | null | undefined): string | null {
  const ip = adresseLocalePrincipale();
  if (!ip) return null;
  const port = hote?.includes(":") ? hote.split(":").pop() : null;
  return port && port !== "80" ? `http://${ip}:${port}` : `http://${ip}`;
}
