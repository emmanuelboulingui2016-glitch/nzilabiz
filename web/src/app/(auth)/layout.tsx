import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-creme px-4 py-10" style={{ background: "var(--color-creme)" }}>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Image src="/brand/nzilabiz-icone-transparent.png" alt="NzilaBiz" width={56} height={56} />
          <h1 className="text-xl font-extrabold">NzilaBiz</h1>
          <p className="text-sm text-muted-foreground">Gérez votre boutique, simplement, au quotidien</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
