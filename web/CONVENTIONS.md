# Conventions du projet NzilaBiz — à lire avant de coder un module

Ce document est la référence commune pour tout module ajouté à l'application. Le cahier des
charges complet est dans `../sahilleypromptconstruction.md` (à la racine du repo, un niveau
au-dessus de ce dossier `web/`) — lisez la section correspondant à votre module avant de commencer.

## Stack en place (ne pas remettre en cause)

- Next.js 16 (App Router, **Turbopack**), TypeScript, React 19. `src/` en racine (`src/app`, `src/components`, `src/lib`, `src/db`).
- ⚠️ Next.js 16 a des différences avec vos connaissances d'entraînement : `params`/`searchParams` sont
  des **Promises** à `await`, le fichier de middleware s'appelle **`proxy.ts`** (pas `middleware.ts`,
  déjà en place, ne pas y toucher). Si un doute, lisez `node_modules/next/dist/docs/`.
- Base de données : **Drizzle ORM** (pas Prisma — voir README à la racine pour la raison) + Postgres.
  Schéma unique dans `src/db/schema.ts` (**ne pas le modifier** ; si un champ manque pour votre module,
  contournez côté application ou signalez-le clairement dans votre résumé final, n'éditez pas ce fichier
  partagé). Client : `import { db } from "@/db/client"`. Requêtes relationnelles disponibles via
  `db.query.<table>.findFirst/findMany`, ou `db.select()/.insert()/.update()` classiques.
- Auth maison (pas next-auth) : `getSession()` depuis `@/lib/auth/session` (server-only, à `await`),
  retourne `{ userId, storeId, role, deviceId, email, nom } | null`. Toujours filtrer vos requêtes par
  `storeId` (multi-tenant strict).
- Permissions : `can(role, permission)` depuis `@/lib/auth/rbac`. Vérifiez les permissions pertinentes
  à votre module côté page ET côté route API (ne pas se fier au seul masquage UI).
- UI kit déjà prêt dans `src/components/ui/` (`Button`, `Card`/`CardHeader`/`CardTitle`/`CardContent`,
  `Input`/`Label`/`Textarea`/`Select`, `Badge`, `Dialog`, `Tabs`, `StatCard`) — **réutilisez-les**, ne
  recréez pas vos propres boutons/cartes.
- Formatage monétaire : `formatFcfa(montant)` depuis `@/lib/currency` (jamais de `toLocaleString` manuel).
- Utilitaires : `cn()`, `genSaleNumber()`, `genProductRef()` depuis `@/lib/utils`.
- i18n : `useTranslations()` depuis `@/lib/i18n/provider` existe pour la nav/les libellés communs déjà
  traduits (fr/en/ar). **Ne modifiez pas** les fichiers `src/lib/i18n/dictionaries/*.json` (partagés,
  risque de collision entre agents travaillant en parallèle) : écrivez le texte de votre module
  directement en français en dur. La traduction complète EN/AR de chaque module est Phase 5 du
  cahier des charges (§19), volontairement différée.
- Manrope est déjà chargé globalement (`@fontsource/manrope`), ne pas ajouter next/font/google (le
  réseau de cet environnement de build bloque `fonts.googleapis.com` — ce n'est pas un problème côté
  utilisateur final, juste dans ce sandbox de build, mais autant rester cohérent).
- Toasts : `import { toast } from "sonner"` (déjà monté dans le layout racine) pour les confirmations
  d'action (`toast.success("...")`, `toast.error("...")`).
- Dates : `date-fns` est installé si besoin de formatage/calculs de dates.
- Graphiques : `recharts` est installé (utilisé pour Dashboard/Rapports).
- CSV : `papaparse` est installé (import/export CSV — Stock, Rapports).
- Export PDF : pas de librairie serveur lourde. Utilisez soit `jspdf` + `jspdf-autotable` (déjà
  installés, génération client-side), soit une vue imprimable (`@media print`) déclenchée par
  `window.print()` — au choix selon ce qui convient le mieux à votre écran.
- Partage WhatsApp : lien `https://wa.me/?text=<encodeURIComponent(message)>` (ouvre WhatsApp Web/app
  avec un message pré-rempli) — pas d'API tierce nécessaire.
- Scan code-barres : `@zxing/browser` est installé pour la lecture caméra si besoin (écran Vendre).

## Où écrire votre code

- Pages : `src/app/(app)/<route>/page.tsx` (le layout `(app)` fournit déjà la Sidebar/Topbar/nav
  mobile et vérifie l'authentification — vos pages sont automatiquement dans le shell protégé).
  Server Component par défaut ; ajoutez `"use client"` seulement si vous avez besoin d'état/interactivité.
- Routes API : `src/app/api/<module>/route.ts` (et sous-dossiers `[id]/route.ts` si besoin). Toujours
  vérifier `getSession()` en premier, retourner 401 si absent, filtrer par `storeId`.
- Composants spécifiques à votre module : `src/components/<module>/...` (dossier dédié à votre module,
  pas de risque de collision).
- N'éditez QUE les fichiers sous votre périmètre (listés dans votre instruction de tâche). Si vous avez
  besoin de modifier un fichier partagé (schema.ts, proxy.ts, layout racine, nav-config.ts...),
  n'éditez pas — documentez le besoin dans votre résumé final à la place.

## Style / UX à respecter

- Palette : `--color-primary` (émeraude), fond `--color-background` (crème), sidebar déjà stylée.
  Utilisez les classes Tailwind sémantiques déjà configurées (`bg-card`, `text-muted-foreground`,
  `border-border`, `bg-primary`, etc. — voir `src/app/globals.css`) plutôt que des couleurs en dur.
- Mobile-first : l'app est utilisée au comptoir sur téléphone. Zones cliquables larges, layout qui
  s'empile proprement en dessous de 640px (le nav mobile est en bas de l'écran ; laissez ~80px de
  marge basse sur les pages avec `pb-20 md:pb-0` si votre contenu risque d'être masqué).
- FCFA : jamais de décimales affichées, séparateur espace (`formatFcfa` s'en charge déjà).

## Avant de terminer

1. Lancez `cd web && npx tsc --noEmit` et corrigez toute erreur TypeScript touchant vos fichiers.
2. Vérifiez que vous n'avez modifié AUCUN fichier hors de votre périmètre.
3. Terminez votre résumé par : fichiers créés/modifiés, endpoints API ajoutés, tout écart pris par
   rapport au cahier des charges et pourquoi, et tout ce qui resterait à faire pour ce module.
