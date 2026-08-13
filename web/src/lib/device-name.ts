export function deviceNameFromUserAgent(ua: string | null): string {
  if (!ua) return "Appareil inconnu";
  const isMobile = /Mobi|Android/i.test(ua);
  let os = "Ordinateur";
  if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad/i.test(ua)) os = "iOS";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS/i.test(ua)) os = "Mac";
  else if (/Linux/i.test(ua)) os = "Linux";
  return `${isMobile ? "Téléphone" : "Ordinateur"} · ${os}`;
}
