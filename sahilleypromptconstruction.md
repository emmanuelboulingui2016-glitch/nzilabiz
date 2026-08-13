# Prompt de construction — NzilaBiz (inspiré de Sahilley, marché gabonais)

> Ce document est un brief technique et produit complet pour construire une application **inspirée de Sahilley**, mais **corrigeant ses défauts observés** et **ajoutant les améliorations identifiées** lors d'un audit complet de l'application réelle (les 9 sections de navigation + les 9 sous-onglets de Paramètres ont toutes été explorées en direct, plus la page d'accueil publique). Il peut être collé tel quel dans un outil de génération d'application (Claude Code, Lovable, v0, Bolt, Cursor, etc.).
>
> Chaque section ci-dessous décrit d'abord le comportement de référence (ce que fait Sahilley aujourd'hui), puis liste les **améliorations à intégrer dès la conception**, repérées par le marqueur **🔧 Amélioration**. Trois sections de Paramètres (Devise, Mobile Money, Synchronisation) sont explicitement marquées « Cette section arrive bientôt » dans l'app d'origine — ce document les spécifie complètement au lieu de les laisser vides.

## 1. Vision produit

Construire **NzilaBiz**, une application web (PWA) de gestion de boutique pour les commerçants d'Afrique centrale (zone CEMAC : Tchad, Gabon, Cameroun, Congo, etc.), en français avec support anglais et arabe. L'application remplace le cahier papier pour la caisse, le stock, les créances clients et les dépenses, avec un fonctionnement **100 % utilisable hors connexion** et synchronisation automatique au retour du réseau.

Tagline de référence : *« Gérez votre boutique, simplement, au quotidien »*.

Cible : petits et moyens commerces (boutiques, épiceries, quincailleries...) qui n'utilisent pas encore d'outil numérique, avec un besoin fort de simplicité et de fonctionnement en devise locale (FCFA).

**Nom et identité de marque — NzilaBiz** : *Nzila* signifie « le chemin, la route, la voie » dans plusieurs langues bantoues du Gabon et du bassin du Congo (notamment le punu/ipunu ; le sens est bien attesté en kikongo, où « Nzila » désigne littéralement la voie/le chemin). Associé à *Biz* (business), le nom porte l'idée d'un outil qui **trace le chemin du commerçant** vers une gestion plus saine de sa boutique. ⚠️ La racine « chemin » est solidement attestée en kikongo ; sa présence exacte en punu/ipunu (chez qui elle est également plausible, les langues bantoues du Gabon partageant cette racine commune) mérite une confirmation rapide auprès d'un locuteur avant impression définitive des supports de marque (logo, enseigne, dépôt de nom).

**🔧 Amélioration — positionnement** : par rapport à l'original, NzilaBiz doit fermer l'écart entre promesse marketing et fonctionnalité livrée (le Mobile Money et le multi-devise sont annoncés publiquement mais absents de l'app d'origine) et renforcer trois axes faibles : la fiabilité de la caisse (rapprochement réel), la traçabilité (qui a fait quoi), et la lutte contre la fraude interne (annulations, remises).

**Périmètre volontairement restreint** : l'application ne gère pas la conformité fiscale (pas de TVA, pas de démarches d'immatriculation ANPI/NIF/RCCM) et ne cible pas le secteur pharmaceutique. Voir §20 pour le détail de ces exclusions et de l'adaptation au marché gabonais.

## 2. Stack technique recommandée

- **Frontend** : application web PWA (installable, icône sur l'écran d'accueil), **mobile-first** avec adaptation desktop. React/Next.js ou équivalent, avec Service Worker pour le mode hors-ligne.
- **Stockage local / offline-first** : base locale (IndexedDB via Dexie.js ou RxDB/PouchDB) qui sert de source de vérité pendant l'usage hors-ligne, avec file d'attente de synchronisation (sync queue) et résolution de conflits une fois la connexion rétablie.
- **Backend** : API REST/GraphQL + base de données relationnelle (Postgres) multi-tenant (une boutique = un tenant), avec authentification par email/mot de passe + OAuth Google.
- **Temps réel/sync** : file de synchronisation par boutique, horodatage des mutations, statut « En ligne / Hors ligne » visible en permanence dans l'en-tête.
- **Internationalisation** : FR (par défaut), EN, AR — avec support RTL complet pour l'arabe.
- **Formatage devise** : FCFA par défaut, séparateur de milliers par espace, aucune décimale (ex. `292 500 FCFA`).
- **Scan code-barres** : lecture via caméra (lib type ZXing/QuaggaJS) et saisie manuelle/douchette USB.

**🔧 Amélioration — infrastructure** :
- Chaque mutation locale (vente, dépense, ajustement de stock) doit être signée par `user_id` + `device_id`, pas seulement horodatée, pour permettre l'attribution dans les journaux (voir §11).
- Prévoir un module de paiement Mobile Money (Airtel Money, Moov Money) via API opérateur ou agrégateur (ex. CinetPay, PayGate) — utilisé à la fois pour encaisser les ventes clients et pour le paiement en libre-service de l'abonnement NzilaBiz lui-même.

## 3. Architecture de l'information (navigation)

Barre latérale gauche, groupée par sections avec petits libellés en majuscules, plus un pied de barre fixe :

- **En-tête de barre** : logo/nom de la boutique (tronqué si long), pastille de statut « En ligne / Hors ligne ».
- **VENTE** — Tableau de bord, Vendre, Ventes
- **BOUTIQUE** — Stock, Créances, Dépenses, Synchronisation
- **ANALYSE** — Documents, Rapports
- **Pied fixe** : Paramètres, puis bloc compte utilisateur (nom, rôle, bouton déconnexion).

**Barre supérieure commune** : champ de recherche global, icône de statut de synchronisation, cloche de notifications (badge de compteur), pastille « En ligne », sélecteur de langue (FR/EN/AR), bouton mode sombre. Bannière d'annonce système, discrète et fermable.

Bandeau PWA (« Installer l'application », boutons « Plus tard » / « Installer ») tant que l'app n'est pas installée.

## 4. Authentification

Écran `/connexion` :
- Logo + nom de l'app, sélecteur de langue en haut.
- Champs Adresse e-mail, Mot de passe, case « Se souvenir de moi », lien « Mot de passe oublié ? ».
- Bouton principal « Se connecter », séparateur « ou », bouton « Continuer avec Google » (OAuth).
- Lien « Pas encore de compte ? S'inscrire ».

Onboarding en 3 étapes après inscription : **créer sa boutique → ajouter des produits → vendre et suivre**, avec notification de bienvenue automatique dans le centre de notifications.

**🔧 Amélioration — onboarding accéléré** : proposer des **modèles de catalogue de démarrage** par type de commerce (épicerie/alimentation générale, quincaillerie, boutique de vêtements, cosmétiques/parfumerie, accessoires téléphone...), pré-remplissant quelques produits et catégories types que le commerçant peut ensuite éditer, pour raccourcir le temps avant la première vente réelle. **La pharmacie est explicitement hors périmètre** (voir §20) — ne pas proposer ce modèle.

## 5. Tableau de bord (`/dashboard`)

Cartes KPI : **CA du jour** (avec % vs hier), **Ventes aujourd'hui** (avec % vs hier), **Créances en cours**, **Dépenses du jour**.

Bloc « Encaissé aujourd'hui » (*valeur vendue, crédit inclus*) : Espèces, Mobile Money, Vendu à crédit, puis **Reste en caisse** = Espèces − Dépenses.

Graphique **Ventes de la semaine** (7 jours, FCFA). Widget **Alertes stock**. Tableau **Ventes récentes** (Heure, Article, Qté, Total, Paiement) + lien « Voir toutes ». Bouton « Nouvelle vente » toujours visible.

**🔧 Amélioration — fiabilité de la caisse** :
- Ajouter un **fond de caisse d'ouverture** : au début de chaque journée (ou de chaque prise de service), l'utilisateur saisit le montant d'espèces déjà présent dans le tiroir-caisse. La formule devient `Reste en caisse = Fond d'ouverture + Espèces encaissées − Dépenses réglées en espèces − Retraits/prélèvements`.
- Ajouter un **comptage de caisse de fermeture** (optionnel mais recommandé) : à la fin de la journée, l'utilisateur compte physiquement l'argent et le saisit ; l'écart avec le solde théorique est affiché et journalisé (utile pour repérer les erreurs ou pertes rapidement).
- Ajouter un mini-widget **Top produits du jour** sur le tableau de bord (déjà présent sur Rapports par période, mais utile en aperçu quotidien direct).

## 6. Vendre — écran de caisse / POS (`/vendre`)

Colonne gauche/centre : recherche produit, champ « Scanner ou saisir un code-barres… » avec icône caméra, onglets de catégories dynamiques, grille de cartes produit cliquables (photo, nom, prix, stock).

Colonne droite — panier : liste des lignes ajoutées, **Remise**, **Sous-total**, **Total**, **Mode de paiement** (Espèces / Mobile Money / Crédit, avec « Paiement mixte » pour répartir entre plusieurs modes), **Client (optionnel)** — obligatoire si mode Crédit —, bouton **« Valider la vente »**.

**🔧 Amélioration — vitesse et fiabilité au comptoir** :
- Ajouter, dans le panneau de paiement (mode Espèces), un champ **« Montant reçu »** et un affichage automatique de la **« Monnaie à rendre »** — geste le plus fréquent d'une caisse physique, absent de l'écran actuel.
- Après validation d'une vente, afficher immédiatement des boutons **« Imprimer le reçu »** et **« Partager par WhatsApp »**, sans devoir passer par l'historique des ventes.
- Ajouter un **stepper +/-** clairement visible sur chaque ligne du panier pour ajuster la quantité sans ressaisir, utile pour les ventes en gros/multiples.
- Permettre de basculer la Remise entre **montant fixe (FCFA)** et **pourcentage (%)**.
- Optimiser le tactile : grandes zones cliquables sur les cartes produits, utilisable à une main sur téléphone (le commerçant est généralement debout au comptoir, pas assis à un bureau).

## 7. Ventes — historique (`/ventes`)

Cartes KPI : **CA aujourd'hui**, **Transactions**, **Ventes à crédit**. Filtres : période, mode de paiement, recherche article. Tableau : N° (ex. `V-0001`), Date, Heure, Article (+N si plusieurs, nom du client si crédit), Qté, Total, Paiement (statut, ex. « Annulée »), Actions (voir/imprimer reçu).

Une vente peut être **annulée** (soft-cancel), ce qui réajuste le stock et la créance associée.

**🔧 Amélioration — traçabilité et anti-fraude** :
- Rendre le **motif obligatoire** pour toute annulation de vente (liste : erreur de saisie, retour client, geste commercial, autre + champ libre), enregistré et affiché dans le détail de la vente.
- Ajouter un **workflow d'approbation** configurable pour les actions sensibles côté vendeur/gérant : annulation de vente, remise au-delà d'un seuil défini par le Patron, modification de prix à la volée — nécessitant une validation du Patron (ou saisie de son code) avant application.
- Ajouter un **bouton d'export direct** (CSV/PDF) depuis cet écran, filtré selon les critères actifs, plutôt que de forcer un détour par Rapports.

## 8. Stock (`/stock`)

Cartes KPI : **Total produits**, **Valeur du stock**, **Stock faible**, **Rupture de stock**, **À payer** (dépliable). Filtres catégorie/statut/recherche.

Modale « Ajouter un produit » : Photo, Nom, Catégorie (créable à la volée), Code-barres, Date de péremption (optionnelle), Prix d'achat, Prix de vente, Prix de gros (optionnel), Unité, Quantité initiale, Seuil d'alerte (défaut 5).

Tableau produits : Réf. (auto, ex. `P-A3BG3`), Produit, Catégorie, Prix achat, Prix vente, Stock, Seuil, Statut, Actions.

Chaque vente décrémente le stock ; chaque annulation le recrédite ; le statut change selon `stock <= seuil` (faible) ou `stock == 0` (rupture).

**🔧 Amélioration — le point le plus important identifié** :
- **Unifier réapprovisionnement et stock.** Dans l'app d'origine, la dépense « Rachats de stock » (voir §10) et la mise à jour des quantités sont deux actions manuelles totalement déconnectées — source d'erreurs. Remplacer par un flux unique **« Réceptionner une livraison »** : choix du/des produit(s), quantité reçue, prix d'achat (peut différer de l'ancien), fournisseur (texte libre ou liste), montant total — cette action crée automatiquement la dépense « Rachats de stock » **et** incrémente le stock des produits concernés, en une seule saisie.
- Ajouter un **historique des mouvements de stock par produit** (fiche produit → onglet « Mouvements ») : chaque entrée montre la date, le type (vente, annulation, réception, ajustement), la quantité, et l'utilisateur à l'origine.
- Ajouter un **ajustement manuel de stock avec motif obligatoire** (casse, perte, vol, inventaire physique, autre) plutôt qu'une simple modification libre du chiffre de quantité.
- Ajouter un **import CSV/Excel en masse** de produits pour l'onboarding de catalogues de 100+ références, avec mapping de colonnes et détection de doublons par code-barres.

## 9. Créances (`/creances`)

Deux onglets : **Clients débiteurs** (liste des clients avec ventes à crédit non soldées) et **Remboursements reçus** (historique des paiements partiels/totaux). Alimentée automatiquement depuis Vendre (mode « Crédit »).

**🔧 Amélioration — gestion du risque crédit** :
- Ajouter, sur la fiche client, une **échéance de paiement** et une **limite de crédit** personnalisables (au lieu du seul seuil global « Créance en retard après X jours » disponible aujourd'hui dans Paramètres > Notifications) — avec possibilité de fixer des conditions différentes par client (client de confiance vs nouveau client).
- Ajouter des **relances automatiques par WhatsApp/SMS** avant et après l'échéance, avec message pré-rempli modifiable (cohérent avec le canal de support déjà privilégié par l'app).
- Afficher directement sur la liste des débiteurs le nombre de jours de retard par client, pas seulement via une alerte globale dans la cloche de notifications.

## 10. Dépenses (`/depenses`)

Cartes KPI : **Total ce mois**, **Rachats de stock (mois)** — exclu du calcul de bénéfice car déjà compté dans le coût des produits vendus —, **Autres dépenses (mois)** — comptées dans le bénéfice —, **Aujourd'hui**, **Transactions**, **Plus grosse charge**. Filtres période/catégorie/recherche.

Formulaire « Ajouter une dépense » : Libellé, Montant (FCFA), Catégorie (suggestions + création libre), Date (défaut aujourd'hui), Note.

**🔧 Amélioration** :
- Voir §8 pour l'unification Rachats de stock ↔ Stock via « Réceptionner une livraison ».
- Ajouter les **dépenses récurrentes** : marquer une dépense comme mensuelle/hebdomadaire (loyer, salaires, abonnement internet) avec génération automatique à la période suivante et rappel avant échéance, pour éviter les oublis qui faussent le bénéfice net.
- Ajouter la possibilité de **joindre une photo du reçu/facture fournisseur** à chaque dépense (l'upload photo existe déjà côté Stock, à réutiliser ici).

## 11. Synchronisation (`/synchronisation`)

Statut « À jour » / dernière synchronisation + bouton « Synchroniser maintenant ». Sections **Écarts de stock** et **Échecs de synchronisation** (états vides si tout va bien). **Dernières synchronisations** : journal des événements (ex. « Vente — V-0001 · 6 490 FCFA », « Annulation de vente — V-0001 »).

**🔧 Amélioration** :
- **Attribuer chaque ligne du journal** à l'utilisateur et à l'appareil d'origine (ex. « Vente — V-0001 · par Fatou · Téléphone caisse 2 »), essentiel dès qu'il y a plusieurs vendeurs sur plusieurs appareils.
- Ajouter un **état d'exemple pédagogique** pour la section « Écarts de stock » (même vide, un lien « Comment ça marche ? » ou une illustration) expliquant comment un écart peut survenir (ex. deux ventes simultanées hors-ligne sur le dernier article) et comment le résoudre — pour rassurer l'utilisateur avant que ça n'arrive réellement.
- Construire réellement le sous-onglet **Paramètres > Synchronisation** (marqué « arrive bientôt » dans l'original) : règles de résolution de conflits (dernier écrit gagne / priorité au Patron / validation manuelle), et liste des appareils connectés à la boutique avec possibilité de révoquer l'accès d'un appareil perdu ou d'un ancien employé.

## 12. Documents (`/documents`)

Onglets **Factures**, **Proformas**, **Remboursements**. Bouton « + Générer une facture ». Recherche + filtre. Les factures sont générées depuis une vente existante.

**🔧 Amélioration** :
- **Clarifier et relier le parcours devis → vente → facture** : permettre de créer une Proforma indépendamment d'une vente (pour un client professionnel qui n'a pas encore payé), puis de la **transformer directement en vente** (et donc en facture) une fois le paiement confirmé, sans ressaisie.
- Étendre le **partage WhatsApp** (déjà présent sur Rapports) aux documents individuels : chaque facture, proforma ou reçu doit avoir son propre bouton « Partager par WhatsApp ».

## 13. Rapports (`/rapports`)

Boutons d'export : PDF, WhatsApp, CSV. Filtres période (Aujourd'hui / Semaine / Mois / Année / Personnalisé). KPI : **Chiffre d'affaires**, **Ventes**, **Marge brute** (+%), **Achats de stock**, **Autres dépenses**, **Bénéfice net estimé**. Section **Argent encaissé** (Espèces, Mobile Money, Vendu à crédit, Remboursements de créances reçus, Reste en caisse). Section **Évolution des ventes** (graphique). Section **Top produits**.

Point positif à conserver : la marge brute est calculée à partir du **prix d'achat figé au moment de chaque vente** (évite les recalculs faux si les prix changent après coup), et le bénéfice net est explicitement distingué de la trésorerie réelle (« gagné, pas forcément encaissé »).

**🔧 Amélioration** :
- Rendre la distinction **bénéfice comptable vs argent réellement en caisse** plus pédagogique : un petit **`?` explicatif** sur chaque KPI plutôt qu'une simple note en bas de page, pour des commerçants pas forcément familiers avec la comptabilité.
- Ajouter un **comparatif à la période précédente** (semaine vs semaine dernière, mois vs mois dernier) sur les KPI principaux, pas seulement le comparatif quotidien du tableau de bord.

## 14. Paramètres (`/parametres`)

Sous-onglets confirmés : **Boutique**, **Abonnement**, **Facturation**, **Devise**, **Utilisateurs**, **Sécurité & connexion**, **Notifications**, **Mobile Money**, **Synchronisation**.

- **Boutique** : logo, nom de la boutique, téléphone, ville, pays (fixe l'indicatif par défaut), type de commerce, quartier/adresse, note de bas de facture.
- **Abonnement** : plan actuel, date d'expiration, jours restants d'essai (15 jours gratuits). Plans : Premium (35 000 FCFA/mois, 95 000 FCFA/trimestre, 350 000 FCFA/an) « utilisateurs illimités (patron, gérants, vendeurs) » ; Entreprise (à partir de 700 000 FCFA/an) « multi-boutiques, gros volumes », avec lien « Nous contacter ».
- **Facturation** : apparence du reçu (logo, téléphone, adresse, message de bas de reçu) avec aperçu en direct.
- **Utilisateurs** : liste des membres avec rôle (ex. « Patron »), bouton « Inviter un employé ».
- **Sécurité & connexion** : nom affiché, e-mail du compte, définir un mot de passe (utile si connecté via Google), comptes liés (Google).
- **Notifications** : seuils d'alerte — créance « en retard » après (jours, défaut 30), « grosse » dépense à partir de (FCFA, défaut 50 000), alerter avant péremption (jours, défaut 30) — et types d'alertes activables (stock bas, péremption proche, créance en retard, vente réalisée, grosse dépense).
- **Devise** et **Mobile Money** et **Synchronisation** : *marquées « Cette section arrive bientôt » dans l'app d'origine — à construire entièrement, voir améliorations ci-dessous.*

**🔧 Amélioration** :
- **Devise** : construire réellement la sélection de devise (FCFA par défaut, mais possibilité de multi-devise pour une expansion hors zone CEMAC), avec taux de change fixé manuellement si besoin.
- **Mobile Money** : construire réellement la connexion aux opérateurs (Airtel Money, Moov Money) — c'est un argument marketing central de la page publique, absent de l'app testée. Permet d'encaisser un paiement Mobile Money via l'app directement (au lieu d'un simple enregistrement manuel du montant) et de payer l'abonnement NzilaBiz lui-même en libre-service, sans dépendre d'un échange WhatsApp.
- **Synchronisation** (paramètres) : voir §11.
- **Sécurité & connexion** : ajouter l'**authentification à deux facteurs (2FA)** optionnelle et une **liste des sessions/appareils actifs** avec possibilité de déconnecter un appareil à distance.
- **Utilisateurs** : supprimer la duplication observée (le même bloc apparaissant à la fois en bas de l'onglet Boutique et dans son propre onglet). Ajouter une **matrice de permissions claire par rôle** : Patron (accès complet), Gérant (accès large sauf paramètres sensibles/abonnement), Vendeur (limité à Vendre + son propre historique de ventes, sans visibilité sur les totaux des autres vendeurs ni droit d'annulation sans validation du Patron/Gérant, cf. §7).
- **Abonnement** : au clic sur « Choisir », proposer un paiement direct par Mobile Money en plus de l'option WhatsApp actuelle.

## 15. Modèle de données (entités principales)

- **Store (Boutique)** : id, nom, logo, adresse, ville, pays, type_commerce, devise, langue par défaut, plan d'abonnement, date de création.
- **User (Utilisateur)** : id, store_id, nom, email, mot de passe (hashé), rôle (patron/gérant/vendeur), photo, 2FA_activée (bool), dernière connexion.
- **Device** : id, store_id, user_id, nom (« Téléphone caisse 2 »), dernière activité, révoqué (bool) — 🔧 nouveau.
- **Product (Produit)** : id, store_id, référence auto, nom, photo, catégorie_id, code_barres, date_péremption (nullable), prix_achat, prix_vente, prix_gros (nullable), unité, quantité_stock, seuil_alerte, statut (calculé), créé_le.
- **Category (Catégorie)** : id, store_id, nom.
- **Sale (Vente)** : id, store_id, numéro (V-0001…), date/heure, user_id, device_id, client_id (nullable), sous_total, remise, type_remise (montant/%), total, statut (validée/annulée), motif_annulation (nullable), approuvé_par (nullable), créé_le. — 🔧 champs ajoutés : device_id, type_remise, motif_annulation, approuvé_par.
- **SaleItem (Ligne de vente)** : id, sale_id, product_id, quantité, prix_unitaire, sous_total.
- **Payment (Paiement)** : id, sale_id, mode (espèces/mobile_money/crédit), montant, montant_reçu (nullable), monnaie_rendue (nullable). — 🔧 champs ajoutés pour le calcul de monnaie.
- **Client** : id, store_id, nom, téléphone (optionnel), solde_dû (calculé), limite_credit (nullable), echeance_jours (nullable), créé_le. — 🔧 champs ajoutés.
- **DebtRepayment (Remboursement de créance)** : id, client_id, sale_id (nullable), montant, date, mode.
- **Expense (Dépense)** : id, store_id, catégorie, description, montant, date, mode_règlement, recurrente (bool), fréquence (nullable), piece_jointe_url (nullable), stock_receipt_id (nullable). — 🔧 champs ajoutés.
- **StockReceipt (Réception de livraison)** : id, store_id, fournisseur (texte libre), montant_total, date, user_id — génère une Expense et des StockMovement associés. — 🔧 nouvelle entité.
- **StockMovement (Mouvement de stock)** : id, product_id, type (vente/annulation/réception/ajustement), quantité, motif (nullable, pour ajustement), user_id, date, référence liée.
- **CashCount (Comptage de caisse)** : id, store_id, user_id, type (ouverture/fermeture), montant_saisi, montant_théorique (nullable), écart (nullable), date. — 🔧 nouvelle entité.
- **Notification** : id, user_id/store_id, type, message, lue (bool), créée_le.
- **SyncLog** : id, store_id, user_id, device_id, statut, horodatage. — 🔧 champ user_id ajouté.

## 16. Modèle économique

- **Essai gratuit** : 15 jours, sans carte bancaire.
- **Premium** : 35 000 FCFA/mois, 95 000 FCFA/trimestre (≈10 % de remise), 350 000 FCFA/an (≈17 % de remise) — produits/ventes illimités, utilisateurs illimités (patron, gérants, vendeurs), mode hors-ligne complet, rapports avancés, support prioritaire WhatsApp.
- **Entreprise** : à partir de 700 000 FCFA/an — gestion multi-boutiques, utilisateurs illimités, support dédié, formation des équipes incluse (sur devis, bouton « Nous contacter »).
- Paiement arrangé via WhatsApp dans l'app d'origine. **🔧 Amélioration** : ajouter un paiement Mobile Money en libre-service pour l'abonnement (voir §14).

## 17. Design system

- **Couleur primaire** : vert émeraude/forêt. **Fond** : beige/crème très clair, sidebar vert foncé profond avec texte clair. **Cartes** : coins arrondis, ombre légère. **Typographie** : sans-serif claire, gros chiffres en gras pour les KPI. **Composants** : badges de statut colorés (vert/orange/rouge), onglets pilules, icônes ligne cohérentes. **Mode sombre** disponible en permanence. **RTL** complet pour l'arabe.

**🔧 Amélioration — accessibilité** : vérifier le contraste des libellés de section de la sidebar (gris clair sur vert foncé observé dans l'original, à tester WCAG AA) ; s'assurer que tous les badges de statut ne reposent pas uniquement sur la couleur (ajouter une icône ou un texte pour les daltoniens).

### 17.1 Identité de marque — logo NzilaBiz

L'identité visuelle finale retenue est un **badge à coins arrondis** (app icon / favicon) représentant une **boutique stylisée** : un motif de devanture/échoppe avec auvent, dans lequel est intégré un **tracé de chemin/route** (référence directe au nom *Nzila* = « le chemin »). L'icône est traitée en **blanc plein sur fond vert émeraude uni**, sans dégradé ni détail fin, pour rester lisible en très petite taille (favicon, icône d'app sur écran d'accueil).

- **Concept graphique** : silhouette de boutique (toit/auvent en pointe + façade + porte/ouverture) avec une ligne de chemin sinueuse intégrée à la base ou traversant le pictogramme, symbolisant à la fois le commerce (boutique) et la progression/le parcours (chemin/route). Traitement en aplat (une seule couleur de trait/forme) pour une lecture instantanée à petite taille.
- **Forme du badge** : carré à coins arrondis (style app icon iOS/Android), fond **vert émeraude uni**, pictogramme blanc centré.
- **Palette de couleurs officielle** :
  | Rôle | Nom | Hex |
  |---|---|---|
  | Couleur de marque principale | Émeraude | `#0F9D58` |
  | Couleur secondaire / fonds foncés (sidebar, contraste) | Forêt | `#0B5A38` |
  | Accent / états actifs, liens, succès | Clair | `#3FBE7D` |
  | Fond d'application, cartes claires | Crème | `#FAF7F0` |
- **Typographie** : **Manrope**, wordmark « NzilaBiz » en un seul mot avec contraste de graisse entre les deux parties — « Nzila » en **graisse 800 (ExtraBold)**, « Biz » en **graisse 600 (SemiBold)** — pour hiérarchiser visuellement la racine locale du nom et son suffixe business.
- **Déclinaisons de lockup** : logo icône seule (app icon/favicon), logo icône + wordmark horizontal (en-tête desktop, documents, reçus), wordmark seul (contextes très étroits). Variante **monochrome blanc** et variante **monochrome vert foncé** pour usages sur fonds photo ou sur supports imprimés en une couleur.

**🔧 Amélioration — validation avant production finale** : avant impression des supports définitifs (enseigne, cartes de visite, dépôt de nom/marque), effectuer un **test de lisibilité en très petite taille** du pictogramme retenu (rendus à 32px, 16px, et en version monochrome) pour confirmer que le motif boutique + chemin reste identifiable une fois réduit à la taille d'un favicon ou d'une icône d'app sur écran d'accueil ; ajuster l'épaisseur des traits si nécessaire.

### 17.2 Assets d'export à produire

Formats et tailles à demander au designer (ou à générer via Gemini/l'outil de design utilisé) pour couvrir tous les usages techniques de l'application :

| Fichier | Taille / format | Usage |
|---|---|---|
| `logo-source.svg` | Vectoriel, fond transparent | Fichier source, base de toutes les autres déclinaisons |
| `favicon.ico` | 16×16, 32×32, 48×48 (multi-résolution) | Onglet navigateur |
| `icon-192.png` | 192×192 px, PNG | Icône PWA (Android, manifest.json) |
| `icon-512.png` | 512×512 px, PNG | Icône PWA haute résolution (splash screen, stores) |
| `apple-touch-icon.png` | 180×180 px, PNG, fond opaque | Icône iOS (écran d'accueil Safari) |
| `logo-horizontal.svg` / `.png` | Vectoriel + export PNG @2x | En-tête desktop, documents PDF, reçus imprimés |
| `logo-monochrome-blanc.svg` | Vectoriel, blanc pur | Usage sur fonds foncés/photo |
| `logo-monochrome-vert.svg` | Vectoriel, `#0B5A38` | Usage impression une couleur |
| `og-image.png` | 1200×630 px, PNG/JPG | Aperçu de partage (réseaux sociaux, liens partagés) |

## 18. Exigences non-fonctionnelles

- **Offline-first** : ventes, ajout produit, dépenses fonctionnent sans réseau et se synchronisent silencieusement.
- **Performance** : écran Vendre quasi instantané (dizaines de ventes/jour).
- **PWA installable** sur mobile et desktop.
- **Multi-langue** FR/EN/AR avec bascule immédiate, RTL complet.
- **Multi-utilisateur par boutique** avec droits différenciés par rôle (Patron/Gérant/Vendeur).
- **Sécurité** : isolation stricte multi-tenant, mots de passe hashés, sessions sécurisées, **2FA optionnelle**, **liste des sessions actives révocables**.
- **Traçabilité** : chaque mutation sensible (vente, annulation, ajustement de stock, dépense) attribuée à un utilisateur et un appareil identifiables.
- **Mobile-first réel** : l'écran Vendre doit être testé et validé en priorité sur petit écran tactile, pas seulement en desktop.

## 19. Découpage MVP suggéré

1. **Phase 1 (MVP caisse)** : Authentification, Tableau de bord (KPI simples + fond de caisse), Vendre (vente mono-paiement + montant reçu/monnaie à rendre), Stock (CRUD produit + décrément auto + mouvements), Ventes (historique + annulation avec motif).
2. **Phase 2** : Paiement mixte, Créances (avec échéance/limite par client) + remboursements, Dépenses (avec dépenses récurrentes), flux unifié « Réceptionner une livraison ».
3. **Phase 3** : Mode hors-ligne complet + synchronisation (avec attribution utilisateur/appareil), PWA installable, import CSV produits.
4. **Phase 4** : Rapports avancés, Documents (proforma → vente → facture), personnalisation des reçus, multi-utilisateurs avec matrice de permissions par rôle, workflow d'approbation.
5. **Phase 5** : Multi-langue complet (EN/AR + RTL), mode sombre, multi-boutiques (plan Entreprise), Mobile Money réel (encaissement + paiement abonnement), multi-devise, 2FA, relances automatiques WhatsApp/SMS.

## 20. Adaptation au marché gabonais

NzilaBiz vise en priorité les commerçants de Libreville, Port-Gentil et Franceville. Adaptations à intégrer :

- **Mobile Money** : prioriser l'intégration **Airtel Money avant Moov Money** — Airtel Money est nettement dominant au Gabon (plus de 4 000 milliards FCFA de transactions mobile money au Gabon en 2024, Airtel très largement majoritaire face à Moov).
- **Indicatif et villes par défaut** : indicatif téléphonique par défaut sur **+241 (Gabon)**. Autocomplétion du champ Ville suggérant en priorité Libreville, Port-Gentil, Franceville.
- **Adressage** : conserver le champ libre « Quartier / Adresse » tel quel — l'usage gabonais repose sur des repères de quartier (Akanda, Nzeng-Ayong, PK5, PK8, Glass, Louis...) plutôt que sur un numéro de rue formel ; pas besoin d'un champ d'adresse structuré.
- **Positionnement concurrentiel** : un concurrent local existe déjà (une appli de caisse gratuite pour Android, avec suivi séparé Airtel Money/Moov Money, mais sans gestion des créances clients, sans rapports avancés, sans rôles multi-utilisateurs ni factures). Se différencier sur ces points plutôt que sur le prix.

**Hors périmètre — exclusions volontaires (à ne pas développer)** :
- **Fiscalité / TVA** : aucune gestion de la TVA, aucun calcul de taux, aucune mention légale automatique sur les factures. Les champs et écrans liés à la fiscalité ne font pas partie du produit.
- **Démarches d'immatriculation (ANPI, NIF, RCCM)** : pas de champs NIF/RCCM, pas d'accompagnement ou de lien vers les démarches d'enregistrement d'entreprise. L'app reste utilisable par un commerçant formel ou informel sans distinction.
- **Secteur pharmaceutique** : pas de type de commerce « Pharmacie », pas de gestion d'ordonnances, pas de traçabilité réglementée de médicaments. Le champ « Date de péremption » du produit (§8) reste générique (utile pour l'alimentaire, les cosmétiques, etc.) mais aucune fonctionnalité spécifique à la réglementation pharmaceutique ne doit être ajoutée.

---

*Document mis à jour le 12 août 2026, à partir de l'exploration en direct de la totalité des écrans de sahilley.com (Tableau de bord, Vendre, Ventes, Stock, Créances, Dépenses, Synchronisation, Documents, Rapports, et les 9 sous-onglets de Paramètres), de la page d'accueil publique sahilley.com, et d'une recherche sur le contexte du marché gabonais (mobile money, concurrence locale). Les marqueurs 🔧 identifient les ajouts et corrections proposés par rapport au comportement observé de l'application d'origine.*
