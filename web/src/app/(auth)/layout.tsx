import Image from "next/image";
import Link from "next/link";

// Le fond suit le thème : il était auparavant forcé en crème par un style en ligne, ce qui
// rendait le titre et le sous-titre illisibles en mode sombre (texte clair sur fond clair).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex flex-col items-center gap-2 text-center">
          <Image src="/brand/nzilabiz-icone-transparent.png" alt="NzilaBiz" width={56} height={56} />
          <h1 className="text-xl font-extrabold text-foreground">NzilaBiz</h1>
          <p className="text-sm text-muted-foreground">Gérez votre boutique, simplement, au quotidien</p>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">{children}</div>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          <Link href="/conditions" className="hover:text-foreground">
            Conditions
          </Link>
          {" · "}
          <Link href="/confidentialite" className="hover:text-foreground">
            Confidentialité
          </Link>
          {" · "}
          <Link href="/mentions-legales" className="hover:text-foreground">
            Mentions légales
          </Link>
        </p>
      </div>
    </div>
  );
}
