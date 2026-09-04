import { describe, expect, it } from "vitest";
import { deviceNameFromUserAgent } from "./device-name";

const UA_ANDROID =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
const UA_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const UA_IPAD =
  "Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1";
const UA_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const UA_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15";
const UA_LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

describe("deviceNameFromUserAgent", () => {
  it("reconnaît un téléphone Android (cas nominal)", () => {
    expect(deviceNameFromUserAgent(UA_ANDROID)).toBe("Téléphone · Android");
  });

  it("reconnaît un iPhone", () => {
    expect(deviceNameFromUserAgent(UA_IPHONE)).toBe("Téléphone · iOS");
  });

  it("reconnaît un iPad comme un appareil mobile iOS", () => {
    expect(deviceNameFromUserAgent(UA_IPAD)).toBe("Téléphone · iOS");
  });

  it("reconnaît un ordinateur Windows", () => {
    expect(deviceNameFromUserAgent(UA_WINDOWS)).toBe("Ordinateur · Windows");
  });

  it("reconnaît un Mac", () => {
    expect(deviceNameFromUserAgent(UA_MAC)).toBe("Ordinateur · Mac");
  });

  it("reconnaît Linux", () => {
    expect(deviceNameFromUserAgent(UA_LINUX)).toBe("Ordinateur · Linux");
  });

  it("retourne « Appareil inconnu » quand l'en-tête est absent", () => {
    expect(deviceNameFromUserAgent(null)).toBe("Appareil inconnu");
    expect(deviceNameFromUserAgent("")).toBe("Appareil inconnu");
  });

  it("retombe sur « Ordinateur » quand aucun système n'est reconnu", () => {
    expect(deviceNameFromUserAgent("SomeBot/1.0")).toBe("Ordinateur · Ordinateur");
  });
});
