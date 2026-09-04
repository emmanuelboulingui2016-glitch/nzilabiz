import { afterEach, describe, expect, it, vi } from "vitest";
import os from "node:os";
import { adresseLocalePrincipale, adressesLocales, urlReseauLocal } from "./adresse-locale";

vi.mock("node:os", () => ({
  default: { networkInterfaces: vi.fn() },
}));

function reseau(interfaces: Record<string, Partial<import("node:os").NetworkInterfaceInfo>[]>) {
  (os.networkInterfaces as ReturnType<typeof vi.fn>).mockReturnValue(interfaces);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("adressesLocales", () => {
  it("retourne l'IPv4 privée d'une carte Wi-Fi (cas nominal)", () => {
    reseau({
      "Wi-Fi": [{ address: "192.168.1.67", family: "IPv4", internal: false }],
    });
    expect(adressesLocales()).toEqual([{ interface: "Wi-Fi", adresse: "192.168.1.67" }]);
  });

  it("retourne un tableau vide quand la machine n'a aucune interface exploitable", () => {
    reseau({});
    expect(adressesLocales()).toEqual([]);
  });

  it("ignore l'interface de bouclage (loopback)", () => {
    reseau({
      "Loopback Pseudo-Interface": [{ address: "127.0.0.1", family: "IPv4", internal: true }],
    });
    expect(adressesLocales()).toEqual([]);
  });

  it("ignore les interfaces virtuelles (VMware, WSL, VPN…)", () => {
    reseau({
      "vEthernet (WSL)": [{ address: "172.20.10.2", family: "IPv4", internal: false }],
      "VMware Network Adapter": [{ address: "192.168.100.1", family: "IPv4", internal: false }],
    });
    expect(adressesLocales()).toEqual([]);
  });

  it("ignore les adresses IPv6", () => {
    reseau({
      "Wi-Fi": [{ address: "fe80::1", family: "IPv6", internal: false }],
    });
    expect(adressesLocales()).toEqual([]);
  });

  it("ignore les adresses publiques (hors plages RFC 1918)", () => {
    reseau({
      "Wi-Fi": [{ address: "8.8.8.8", family: "IPv4", internal: false }],
    });
    expect(adressesLocales()).toEqual([]);
  });

  it("accepte les trois plages privées RFC 1918", () => {
    reseau({
      A: [{ address: "10.0.0.5", family: "IPv4", internal: false }],
      B: [{ address: "172.16.0.5", family: "IPv4", internal: false }],
      C: [{ address: "192.168.0.5", family: "IPv4", internal: false }],
    });
    expect(adressesLocales().map((a) => a.adresse).sort()).toEqual(["10.0.0.5", "172.16.0.5", "192.168.0.5"]);
  });

  it("respecte la borne haute de la plage 172.16-172.31 (172.32 est publique)", () => {
    reseau({
      Ethernet: [{ address: "172.32.0.5", family: "IPv4", internal: false }],
    });
    expect(adressesLocales()).toEqual([]);
  });

  it("classe le Wi-Fi avant le câble Ethernet", () => {
    reseau({
      Ethernet: [{ address: "192.168.1.10", family: "IPv4", internal: false }],
      "Wi-Fi": [{ address: "192.168.1.20", family: "IPv4", internal: false }],
    });
    expect(adressesLocales().map((a) => a.interface)).toEqual(["Wi-Fi", "Ethernet"]);
  });
});

describe("adresseLocalePrincipale", () => {
  it("retourne la première adresse la plus probable", () => {
    reseau({ "Wi-Fi": [{ address: "192.168.1.67", family: "IPv4", internal: false }] });
    expect(adresseLocalePrincipale()).toBe("192.168.1.67");
  });

  it("retourne null quand la machine n'est sur aucun réseau", () => {
    reseau({});
    expect(adresseLocalePrincipale()).toBeNull();
  });
});

describe("urlReseauLocal", () => {
  it("construit l'URL avec le port transmis dans l'en-tête Host (cas nominal)", () => {
    reseau({ "Wi-Fi": [{ address: "192.168.1.67", family: "IPv4", internal: false }] });
    expect(urlReseauLocal("localhost:3000")).toBe("http://192.168.1.67:3000");
  });

  it("omet le port par défaut (80)", () => {
    reseau({ "Wi-Fi": [{ address: "192.168.1.67", family: "IPv4", internal: false }] });
    expect(urlReseauLocal("exemple.com:80")).toBe("http://192.168.1.67");
  });

  it("fonctionne sans port dans l'en-tête Host", () => {
    reseau({ "Wi-Fi": [{ address: "192.168.1.67", family: "IPv4", internal: false }] });
    expect(urlReseauLocal("exemple.com")).toBe("http://192.168.1.67");
    expect(urlReseauLocal(null)).toBe("http://192.168.1.67");
  });

  it("retourne null quand la machine n'a pas d'adresse locale", () => {
    reseau({});
    expect(urlReseauLocal("localhost:3000")).toBeNull();
  });
});
