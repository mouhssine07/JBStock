# JBStock — Suivi du développement et reprise de session

Dernière mise à jour : **8 octobre 2026**.

**Point d'arrêt demandé par l'utilisateur :** enregistrer les changements par commits et push, puis arrêter. Reprendre les validations techniques uniquement sur nouvelle demande ; prochaine action et limites conservées ci-dessous.

Référence : [Spécification fonctionnelle et architecture technique](StockManager%20--%20Spécification%20Fonctionnelle%20et%20architecture%20technique%20de%20référence.md), version 1.0.

## Description courte

JBStock est un logiciel Windows de gestion de stock et de gestion commerciale destiné aux commerçants et aux PME. Il vise à gérer produits, images, mouvements de stock, clients, fournisseurs, ventes, achats, paiements et factures. Son architecture local-first et offline-first conserve les données sur le PC dans SQLite ; Google Drive sert uniquement aux sauvegardes et à la récupération. L'application associe React/TypeScript/Vite, Spring Boot/Java et Electron, avec une distribution prévue sur Microsoft Store.

Cette description présente la cible du produit, pas les fonctionnalités toutes disponibles aujourd'hui.

## Reprendre une session

1. Lire la spécification complète, puis ce fichier et `AGENTS.md` à la racine.
2. Examiner `git status --short` et le code concerné : le suivi doit toujours être confronté à l'état réel du dépôt.
3. Reprendre la « Prochaine étape concrète » ci-dessous. Ne pas recréer une infrastructure existante.
4. Implémenter une étape limitée, avec migrations versionnées si le schéma change et tests adaptés.
5. Actualiser l'état, les écarts et le journal en fin de session, y compris en cas de blocage.

Légende : **Vérifié** = contrôle exécuté avec résultat documenté ; **Partiel** = éléments présents mais critères incomplets ; **À faire** = absent du code inspecté. Une étape globale n'est terminée que lorsque ses critères d'acceptation sont satisfaits.

## État actuel

**Incident prioritaire après les essais réussis :** l'utilisateur rapporte une alerte d'ouverture de base après désinstallation/réinstallation du NSIS sur le second PC. Ce PC n'est plus accessible pour le diagnostic. L'existence/intégrité de ses fichiers ne sont pas inspectées et la cause de son alerte reste inconnue. Préserver les données ; ne pas considérer la réinstallation comme une restauration ni déclarer cet incident corrigé. Le ralentissement général rapporté reste également non résolu.

**Stabilisation locale du démarrage :** reprise SQLite bornée sur le même fichier pour BUSY/LOCKED/CANTOPEN, avec refus conservateur après trois tentatives. Verrou temporaire libéré : démarrage et données existantes retrouvés ; verrou persistant : refus et octets conservés. Heap Java initial 32 MiB/maximal 512 MiB, pools JVM dimensionnés pour au plus deux processeurs, GC par défaut conservé. Sur ce PC uniquement, deux mesures par configuration donnent environ **10,4 → 7,4 s** jusqu'à santé/lecture Entreprise, et **394 → 294 MiB** de pic mémoire Java moyen. Cela ne mesure ni l'installation, ni Electron, ni le ralentissement du second PC. Détails et validations dans la dernière entrée du journal.

**Mono-instance du package courant :** deux passages complets instrumentés réussis : second lancement pendant le démarrage Java puis avec fenêtre réduite, même fenêtre restaurée au premier plan, même Java/port, brouillon/données/arabe conservés. Un essai antérieur a présenté un retour inattendu à l'anglais, non reproduit sur ces deux passages ; cause inconnue, traces conservées et aucune correction applicative déclarée. La validation locale ne vaut pas recette sous identité MSIX ou Windows vierge.

**Perte du backend dans le package :** arrêt brutal du seul Java enfant testé en anglais et arabe ; message/action `BACKEND_EXITED` vérifiés et captures inspectées, fermeture de l'application puis relance avec données/langue conservées. SQLite `quick_check=ok`, aucune violation de clé étrangère, aucun processus/port résiduel. Scénario empaqueté étendu réussi : huit lancements avec Java, deux arrêts Java forcés et six arrêts propres, huit dialogues natifs. Données déjà enregistrées avant arrêt ; écritures en cours et coupures électriques non couvertes.

**Retour utilisateur du second PC :** sous Windows 11 sans Java ni Node.js préinstallés, installation NSIS sans Wi-Fi/Internet, ouverture, changement de langue et enregistrement de données fictives réussis sur un PC sans données JBStock. Choix de l'arabe, données/langue conservées après fermeture/relance puis redémarrage Windows confirmés hors ligne. Ces scénarios sont validés par retour utilisateur. Léger ralentissement du PC rapporté pendant l'installation et au démarrage de JBStock : diagnostic à poursuivre. Recette globale encore **partielle** : build Windows exact, contrôles détaillés RTL/LTR, validations, mono-instance et empreinte transférée non renseignés ; aucune validation MSIX externe rapportée.

**Phase active : arrêt Java après crash du main Electron corrigé et vérifié dans le package ; NSIS et MSIX reconstruits ; recette du second PC commencée.** Anglais initial, arabe RTL, langue/données conservées sur quatre lancements du véritable exécutable (dont crash du main puis récupération), quatre fins de journal Java et six erreurs natives de ressources vérifiés localement le 08/10. Processus de la copie isolée sortis et ports Java/diagnostic fermés. NSIS et MSIX `0.0.1.2` contiennent cette correction ; nouvelles empreintes dans la fiche de recette et le journal ci-dessous. L'utilisateur rapporte maintenant une installation NSIS hors ligne et un changement de langue réussis sur le second PC sans données JBStock. Les MSIX de développement signés `0.0.1.0` puis `0.0.1.1` avaient été installés dans le compte habituel choisi par l'utilisateur, avec profil conservé après mise à jour et redémarrage. Cette installation du PC de développement reste en `0.0.1.1`. L'identité Partner Center n'est pas encore réservée. Compléter la recette du second PC avant de la déclarer terminée.

| Domaine | État | Preuve et limites |
| --- | --- | --- |
| Monorepo | Partiel | Backend, frontend, `desktop/`, docs et scripts présents ; NSIS et MSIX de test construits, chaîne de soumission Store encore incomplète. |
| Backend | Vérifié pour le socle | Java 21, Spring Boot 4.1.1 selon `pom.xml` ; contexte et serveur HTTP démarrés par les tests. |
| API locale | Vérifié pour le prototype | Electron lance Java directement sur 127.0.0.1:0, lit le port READY, vérifie santé et accès authentifié ; secret neuf par lancement, supervision et timeout. |
| SQLite | Partiel | WAL, clés étrangères, busy_timeout=5000 et synchronous=FULL configurés pour chaque connexion physique ; pool limité à une connexion. Tests de reconnexion, rollback et redémarrage ajoutés à l'étape 1.3 ; tests catastrophe et mesures de performance encore à faire. |
| Stockage local | Partiel | Résolution LOCALAPPDATA/JBSTOCK_HOME, compatibilité des chemins DB explicites, arborescence locale créée. MSIX : virtualisation sous Packages/LocalCache/Local/JBStock et conservation après mise à jour vérifiées localement ; désinstallation et migration d'une base hors MSIX non vérifiées. |
| Diagnostics et arrêt backend | Vérifié localement dans le package | Journaux filtrés et rotation ; commande privée stdin, fermeture Spring et attente Java. Quatre cycles empaquetés dont arrêt brutal du seul main Electron et récupération : `LOGGING_STOPPED`, aucun processus de la copie ni port Java/diagnostic résiduel. Java détaché sous Windows, pipes et suivi conservés sans unref. Arrêt forcé de secours testé par les tests Node ; backup de fermeture absent. |
| Migrations | Partiel | Flyway V1 à V3 appliquées sur une base neuve pendant les tests ; aucune sauvegarde automatique avant migration. |
| Santé | Vérifié | `GET /health` délègue à Actuator ; `GET /actuator/health` conservé ; HTTP 200 et statut UP vérifiés avec SQLite. |
| Entreprise | Partiel | GET/PUT `/api/company`, nom, adresse, téléphone, email et identifiants fiscaux ; mise à jour transactionnelle via JdbcTemplate. Logo, devise, langue et paramètres facture absents. |
| Validation API | Partiel | Erreurs de validation et JSON illisible : HTTP 400 avec `code`, `message`, `fields`. Pas encore de convention pour toutes les erreurs métier. |
| Sécurité | Partiel | Token local obligatoire sur les routes applicatives, secret valide requis au démarrage, routes non prévues refusées. Entreprise GET/PUT protégée par le token ; exemption CSRF limitée à cette route. Aucun compte local ou rôle métier ; pas de session HTTP ni de compte Spring implicite. |
| Frontend | Partiel | Formulaire Entreprise utilisable via Vite ou preload Electron. Build/lint/proxy réussis et test UI Electron réel validé avec capture inspectée. Autres écrans encore absents. |
| Multilingue | Vérifié localement dans le package, recette externe restante | Catalogues communs `en`/`ar`, sélecteur, anglais initial, RTL/LTR, validations et erreurs traduites. Prototype avec HTTP(S) Chromium bloqué vérifié ; deux lancements du vrai main empaqueté conservent langue/données. Six dialogues natifs lus, capturés, inspectés et fermés ; direction des fragments mixtes arabe/latin corrigée. Recette du second PC restante. |
| Desktop | Partiel | Electron 44.6.0 et electron-builder 26.17.0 fixés par lockfile ; runtime Java embarqué. Nouveau main empaqueté testé sans Java/Node dans PATH, profils isolés et chemins accentués. NSIS reconstruit ; MSIX non signé 0.0.1.2 comparé au build (413 fichiers). Ancienne installation/mise à jour signée 0.0.1.0 → 0.0.1.1 vérifiée localement. Installation du nouveau build sur Windows vierge et premier lancement sans réseau système restent à vérifier. |
| Métier hors Entreprise | À faire | Produits, images, stock, clients, fournisseurs, ventes, achats, paiements, factures et audit absents. |
| Sauvegardes et Drive | À faire | Snapshot SQLite, médias, file de synchronisation, chiffrement, OAuth et restauration absents. |
| Licence et Store | Partiel pour le packaging | MSIX de développement signé, installé et mis à jour localement ; serveur de licences, cache offline, `.msixupload`, identité officielle, certification et confidentialité restent à réaliser. NSIS reste un installateur de validation. |
| Automatisation | À faire | Aucun workflow dans `.github/workflows` ; des artefacts locaux de build ne prouvent pas une livraison reproductible. |

### Fichiers repères

- `Jbstock-backend/pom.xml` : dépendances et Java 21.
- `Jbstock-backend/src/main/resources/application.properties` : écoute locale, SQLite et Actuator.
- `Jbstock-backend/src/main/java/com/jbstock/backend/config/` : datasource SQLite et sécurité.
- `Jbstock-backend/src/main/java/com/jbstock/backend/storage/LocalStorage.java` et `config/LocalStorageConfiguration.java` : chemins persistants et initialisation des dossiers.
- `Jbstock-backend/src/test/java/com/jbstock/backend/storage/` : tests de chemins et de redémarrage complet du backend.
- `Jbstock-backend/src/main/java/com/jbstock/backend/security/LocalSessionTokenFilter.java` : contrôle du token local.
- `Jbstock-backend/src/main/java/com/jbstock/backend/common/` : santé et erreurs de validation.
- `Jbstock-backend/src/main/java/com/jbstock/backend/company/` : API Entreprise et repository JDBC. JPA est installé mais ce module utilise JdbcTemplate.
- `Jbstock-backend/src/main/resources/db/migration/` : V1 métadonnées, V2 entreprise, V3 identifiants fiscaux.
- `Jbstock-backend/src/test/java/com/jbstock/backend/JbstockApplicationTests.java` : tests d'intégration HTTP et SQLite.
- `Jbstock-frontend/src/App.tsx` : écran Entreprise actuel.
- `Jbstock-frontend/vite.config.ts` : proxy de développement.
- `Jbstock-frontend/scripts/test-dev-proxy.mjs` : test du proxy et de l'absence du secret dans les assets.
- `scripts/dev.mjs` : lanceur backend + Vite avec secret aléatoire et base de développement isolée.
- `Jbstock-backend/src/main/java/com/jbstock/backend/diagnostics/` et `config/DiagnosticsConfiguration.java` : encodeur, rotation, événements et diagnostic de démarrage.
- `Jbstock-backend/src/main/resources/logback-spring.xml` et `META-INF/spring.factories` : console filtrée et listener d'échec.
- [Contrat backend/desktop](CONTRAT_BACKEND_DESKTOP.md) : variables, port, stdout/stderr, logs, fermeture et limites pour Electron.
- `desktop/src/` : main Electron, superviseur Java, preload, fenêtre/protocole local et validation IPC.
- `desktop/test/` : tests Node, intégration Java réelle et test du formulaire dans Electron.
- `desktop/scripts/prepare-jdk.ps1` et `build-runtime.ps1` : téléchargement vérifié du Microsoft OpenJDK 21 et création du runtime réduit.
- `Jbstock-backend/src/main/java/com/jbstock/backend/desktop/DesktopControl.java` : fermeture Spring sur commande stdin/EOF, activée explicitement.
- `Jbstock-frontend/src/services/company.ts` : choix du transport preload Electron ou HTTP navigateur.
- [Guide desktop](../desktop/README.md) : lancement et commandes de validation.
- [Préparation MSIX](PACKAGING_MSIX.md) : identité de test/officielle, build SDK et validation ; scripts `desktop/scripts/build-msix.ps1`, `verify-msix.ps1` et manifeste `desktop/msix/AppxManifest.xml`.

### Écarts prioritaires par rapport à la spécification

1. **Sections 7, 17–18 : sécurité partiellement réalisée.** Electron génère et conserve le token ; React dispose uniquement d'un bridge Entreprise validé. L'authentification utilisateur et les rôles restent absents.
2. **Sections 4–9 et 103 : fondation desktop partielle.** Chaîne complète testée, packages autonomes assemblés, MSIX installé et mis à jour localement avec données conservées. Erreurs de ressources du package testées en anglais/arabe. Restent Windows vierge, premier lancement sans réseau système et format Store.
3. **Section 9 : stockage local implémenté, virtualisation MSIX observée.** Le défaut logique `%LOCALAPPDATA%/JBStock` est redirigé sous `%LOCALAPPDATA%/Packages/JBStock.Development_yrahyscxc0a2p/LocalCache/Local/JBStock` sous cette identité MSIX. Les chemins explicites restent compatibles ; aucun déplacement automatique. La transition de données hors MSIX vers MSIX et la désinstallation ne sont pas validées.
4. **Section 43 : configuration SQLite renforcée.** Les propriétés du pilote appliquent WAL, foreign_keys, busy_timeout=5000 et synchronous=FULL à chaque connexion. Les performances en charge et les pannes brutales restent à tester.
5. **Sections 19, 42, 47 : Entreprise incomplet.** Pas encore de paramètres facture, d'audit ni de suivi des modifications pour le backup.
6. **Sections 51, 66, 74, 92–93 : récupérabilité encore incomplète.** Le refus de démarrage et le rollback d'une migration SQLite volontairement invalide sont testés. Snapshot cohérent, restauration et reprise après crash restent absents.

## Ordre de développement et critères d'acceptation

La demande utilisateur du 06/10/2026 fixe la priorité au backend et à ses API, puis au frontend. La section 103 exige une fondation desktop testable avant les nouveaux modules métier : les étapes 1 et 2 précèdent donc leur développement. Pour chaque module : contrat API → migration → service transactionnel → validations/permissions → tests → consommation frontend lors de l'étape d'intégration.

| Étape | État | Travail et critère de sortie |
| --- | --- | --- |
| 0. Audit et continuité | Vérifié | Spécification lue, code inventorié, commandes de validation exécutées, suivi et instructions de reprise créés. |
| 1. Socle backend local | Vérifié dans le périmètre backend | Santé, validation, token, stockage, reconnexion/rollback/redémarrage, logs et préparation de l'arrêt vérifiés. Le cycle desktop complet et les sauvegardes restent dans les étapes suivantes. |
| 2. Fondation Electron | Partiel | Prototype/runtime et erreurs de ressources du package vérifiés localement. Étape 2.3 : installation/mise à jour MSIX, profil conservé après redémarrage, mono-instance et arrêt vérifiés sur ce PC. Restent Windows vierge, premier lancement sans réseau système et format `.msixupload`. |
| 3. Entreprise et utilisateurs | Partiel | Compléter Entreprise ; onboarding premier OWNER unique, mots de passe hashés, login/logout, sessions et permissions backend. Sortie : bootstrap protégé, rôles testés et API documentées. |
| 4. Catalogue | À faire | Catégories, marques, produits génériques, attributs et modèle compatible variantes ; SKU/code-barres uniques, pagination, indexes, désactivation. Sortie : API et tests d'unicité, recherche, validation et permissions. |
| 5. Médias | À faire | Import validé, limites taille/MIME/dimensions, EXIF, WebP et miniatures, UUID, chemins contrôlés, jobs en arrière-plan. Sortie : fichiers et références cohérents, images invalides rejetées, aucune image en BLOB. |
| 6. Stock | À faire | Dépôt initial, StockMovement historique, StockBalance, stock initial et ajustements traçables. Sortie : transactions, mouvements inverses, cohérence historique/solde et concurrence testées. |
| 7. Clients | À faire | Clients génériques, données personnelles optionnelles quand possible, recherche et pagination. Préparer les références nécessaires aux ventes. Sortie : API, contraintes et permissions validées. |
| 8. Ventes et paiements | À faire | DRAFT/CONFIRMED/CANCELLED, lignes et totaux exacts ; confirmation atomique avec paiement et stock, annulation par opérations inverses. Sortie : tests de calcul, rollback, double confirmation, annulation et permissions. |
| 9. Factures | À faire | Séquence transactionnelle unique, données figées à émission, PDF personnalisé, corrections traçables. Sortie : numérotation concurrente testée et PDF reproductible sans modification silencieuse. |
| 10. Sauvegarde locale | À faire | Dirty state persistant, délais configurables 5 min d'inactivité/15 min maximum, snapshot SQLite cohérent, manifest/checksum, sécurité avant migrations, restauration. Sortie : restauration comparée aux données sources, erreurs et crashs testés. |
| 11. Google Drive | À faire | OAuth desktop, stockage sécurisé des tokens, queue/retry, médias séparés, 3 backups DB après vérification, chiffrement et clé de récupération. Sortie : travail offline indépendant de Drive et restauration sur PC vierge validée. |
| 12. Licence | À faire | Serveur distant limité aux licences, installationId, activation signée et cache offline, accès certification. Sortie : validité/expiration et indisponibilité réseau testées selon une politique explicitée. |
| 13. Interface métier | À faire | Organisation par features, consommation des API stabilisées, onboarding, catalogue, stock, ventes, factures, état sauvegarde/licence et erreurs lisibles. Sortie : workflows frontend et E2E passant dans Electron. |
| 14. Stabilisation et livraison | À faire | CI tests/lint/build/package, tests catastrophe et volumes de référence, MSIX, installation/mise à jour, confidentialité et dossier Store. Sortie : tests sur Windows vierge, conservation des données après mise à jour et exigences Store revérifiées lors de la soumission. |
| 15. Après V1 | À faire | Fournisseurs avancés, achats/réceptions, retours avancés, multi-dépôts/transferts, scanner, tickets, statistiques, import/export et modèles de facture avancés selon section 97. Découper chaque fonctionnalité en étapes avant implementation. |

L'audit, la sécurité, les transactions, les migrations et l'évaluation backup/restauration sont transversaux : les ajouter avec chaque opération métier concernée, sans attendre la stabilisation finale. Les achats et fournisseurs restent dans la cible produit ; la spécification les positionne après stabilisation de la V1.

## Prochaine étape concrète

**Reprise après stabilisation locale du démarrage Java/SQLite du 08/10/2026.** Les ajouts de tests de la session interrompue sont conservés. Le second PC a permis des essais fonctionnels hors ligne réussis, puis une alerte après réinstallation ; il est désormais indisponible. Compléter les critères restants ultérieurement avant de déclarer la recette acquise.

1. Priorité à l'alerte d'ouverture de base après réinstallation : conservation locale, refus d'accès persistant et reprise après verrou temporaire sont couverts, mais la cause sur le second PC reste inconnue. Quand ce PC redeviendra accessible, inspecter ses journaux et l'existence/les droits du fichier `%LOCALAPPDATA%\JBStock\data\jbstock.db` sans le remplacer. L'utilisateur demande de poursuivre le travail local sans solliciter ce PC maintenant. Le budget JVM améliore les mesures locales Java ; le ralentissement général distant reste à diagnostiquer. Compléter les autres éléments de [TEST_WINDOWS_VIERGE.md](TEST_WINDOWS_VIERGE.md) ultérieurement.
2. Collecter les résultats réels avant de valider ce critère. Le nouveau NSIS est construit mais n'a pas été installé dans cette session ; l'essai automatisé local lance sa source `win-unpacked`.
3. Préparer séparément signature/confiance puis installation/mise à jour du MSIX `0.0.1.2` sur la machine de test. Il est actuellement non signé. Conserver le MSIX `0.0.1.1` installé et les données existantes tant qu'aucune nouvelle installation n'est demandée.
4. Poursuivre les critères restants de l'étape 2.4 et du Store : prochain contrôle local, alerte native `DATABASE_ERROR` en anglais/arabe sur une base de test inaccessible, avec vérification des fichiers et récupération après libération. Les alertes après perte de Java sont maintenant vérifiées. Mono-instance étendue vérifiée ; surveiller le retour inattendu à l'anglais observé une fois et documenté au journal. Le test prototype bloque HTTP(S) dans Chromium ; le test packaged ne coupe pas le réseau système. Aucun des deux ne remplace la recette du second PC.

Ne pas ouvrir de nouveau module métier tant que les critères desktop restent non vérifiés. Conserver les ressources centralisées pour les futurs écrans ; devise et langue des factures restent à ajouter au module Entreprise.

**Étape 2.4 — Valider le desktop sur Windows vierge et couvrir les échecs de démarrage.**

Prérequis local désormais automatisé : `npm.cmd --prefix desktop run test:runtime` vérifie le Java/JAR empaqueté, les chemins avec espaces/accents, le stockage par défaut dans un LOCALAPPDATA temporaire et la persistance après déplacement des fichiers applicatifs. Deux cycles réussis le 07/10/2026, sans arrêt forcé. Ce test ne valide pas une mise à jour MSIX ni les scénarios du main Electron ci-dessous.

- Étape 2.3 locale réalisée : MSIX `0.0.1.1` installé, profil conservé après mise à jour puis redémarrage. Signature de test approuvée jusqu'au 05/01/2027. Les scripts et preuves locales sont décrits dans [le guide MSIX](PACKAGING_MSIX.md). L'application a été fermée en fin de validation.
- Rejouer les MSIX signés de `desktop/release/msix-validation/` dans une VM Windows vierge sans Java/Node, y compris le premier lancement sans réseau. Réutiliser uniquement des données fictives et le certificat public ; ne pas transférer les captures/profils réels du PC de développement.

- Rejouer `desktop/release/JBStock-0.0.1-setup.exe` dans une VM Windows propre sans Java ni Node ; vérifier démarrage, arrêt gracieux, redémarrage et absence de processus/ports résiduels. Le smoke test local isolé a déjà réussi, mais n'est pas une validation machine vierge.
- Contrôler la transition depuis une ancienne base hors MSIX ; ne pas supposer que la virtualisation MSIX conserve les données après désinstallation. Fermeture/réouverture et mise à jour MSIX sont désormais vérifiées sur ce PC.
- Scénarios locaux du main empaqueté vérifiés le 08/10 : six erreurs de ressources et deux alertes de perte Java en anglais/arabe, installation/profil avec espaces/accents, huit cycles dont crash du main, deux crashes Java et récupérations. Mono-instance étendue sur le build courant : second lancement pendant démarrage puis fenêtre réduite/brouillon, deux passages instrumentés complets réussis ; retour à l'anglais isolé non expliqué, consigné au journal. Restent alertes natives sur erreur SQLite de démarrage, premier démarrage avec réseau système déconnecté et compléments de recette sur le second PC.
- L'utilisateur a confirmé que le nom n'est pas encore réservé dans Partner Center. Utiliser l'identité de développement pour les essais ; renseigner ultérieurement l'identité officielle et les logos, puis générer/valider un `.msixupload` sans publication.
- Garder l'étape 2 partielle jusqu'à validation Windows vierge et du format Store. Ensuite reprendre l'étape 3 (Entreprise/utilisateurs).

### Étape 2.1 terminée — Prototype Electron

Le processus principal conserve le token ; le preload expose `getCompany`, `saveCompany` et, depuis le 08/10, `getLanguage`/`setLanguage`, limités à `en`/`ar`. La frame principale et l'URL `jbstock://app/index.html` sont vérifiées pour chaque message IPC. La CSP bloque les connexions réseau du renderer ; le main communique exclusivement avec son backend local. React n'a ni Node ni accès au secret. La fenêtre refuse navigation, nouvelles fenêtres, webviews, téléchargements et permissions.

Le backend est démarré avec un pipe stdin privé et `jbstock.desktop.stdin-control=true`. La fermeture envoie `JBSTOCK_SHUTDOWN`, attend jusqu'à 30 secondes, puis force uniquement l'enfant direct si nécessaire. Un crash désactive les appels et demande de relancer l'application. L'arrêt contrôlé et la persistance sur deux vrais processus Java ont été vérifiés. Le package autonome puis le MSIX installé ont également passé des contrôles locaux ; Windows vierge reste à valider.

Lancement depuis la racine après builds :

```powershell
npm.cmd --prefix desktop start
```

Ce prototype nécessite encore Java 21 sur le poste de développement. Sa base fictive est `Jbstock-backend/target/desktop-dev/data/jbstock.db`, distincte du lanceur navigateur et supprimable par `mvn clean`. Voir le guide desktop pour reconstruire les artefacts.

### Étape 2.2 — Runtime embarqué et packaging Windows (partielle)

**État trouvé :** chemins packaged prévus par Electron, mais aucun runtime ni assemblage configuré. Le JDK initial était Oracle et n'a pas été distribué. Les changements non commités préexistants ont été préservés.

**Réalisé :** ajout d'electron-builder (mis à jour à 26.17.0 après audit) et configuration des ressources packagées (frontend, JAR, runtime), builds Windows x64 dossier et NSIS. `desktop/scripts/prepare-jdk.ps1` télécharge le JDK versionné et valide sa somme SHA-256 publiée par Microsoft ; `build-runtime.ps1` assemble un runtime `jlink` depuis Microsoft Build of OpenJDK 21 x64 et refuse un fournisseur ou une version différente. Le main vérifie les ressources et le backend empaqueté utilise la résolution `%LOCALAPPDATA%\JBStock` sans surcharger `JBSTOCK_HOME`. `.tools`, `.build` et `release` sont ignorés par Git.

**Décisions :** le runtime est redistribuable sous GPLv2 avec Classpath Exception ; les dossiers légaux du runtime réduit sont conservés. NSIS est un installateur de validation. Pas d'identité Partner Center, MSIX/`.msixupload`, signature de production, icône ni publication Store. Microsoft recommande `.msixupload` pour les soumissions Windows 10 et ultérieures.

**Validation :** `npm run build` frontend réussi ; téléchargement Microsoft OpenJDK 21.0.12.1 x64 comparé à la somme officielle SHA-256 `192441A9D27DA813BADA974BB88B4CF64D37A9589ED37F204374D411CA5CE07F` ; `prepare:jdk`, `jlink` et `java -version` réussis ; builds Windows x64 dossier et NSIS réussis. Installateur d'environ 247 MB. Smoke tests manuels décrits dans les continuations ci-dessous ; ils ne remplacent pas des tests automatisés ou une VM propre.

**Limites :** aucun scénario de premier démarrage empaqueté, migration de données, redémarrage, fermeture, mono-instance ou Store n'a été validé. L'audit npm initial (electron-builder 26.3.2) signalait 8 vulnérabilités hautes et 1 critique, notamment `tar`; après mise à jour à 26.17.0, aucune haute/critique ne subsiste, mais 8 vulnérabilités modérées restent signalées dans la chaîne de packaging (`@electron/get`/`global-agent`/`roarr`/`sprintf-js`). Elles ne sont pas des dépendances applicatives de production, mais doivent rester suivies avant livraison. Le build courant est un installateur NSIS non signé pour publication ; il n'y a pas de MSIX/`.msixupload`, identité Partner Center, signature de production ni icône de marque.

**Prochaine action concrète :** exécuter l'installateur dans une VM Windows propre sans Java/Node et vérifier persistance, mise à jour, scénarios de panne et absence de processus résiduels. Ensuite configurer l'identité Store et générer/valider un `.msixupload` sans publication. Garder le suivi des 8 vulnérabilités npm modérées.

### Continuation — Audit des dépendances desktop

**Réalisé :** `npm audit` a identifié 8 vulnérabilités hautes et 1 critique dans la version initiale electron-builder 26.3.2, dont plusieurs avis sur `tar`. Mise à jour vers 26.15.3 puis 26.17.0 (version stable récente du même majeur) ; le lockfile conserve electron-builder 26.17.0, `tar` 7.5.22 et builder-util-runtime 9.7.0. Les builds Windows x64 dossier et NSIS ont réussi après cette mise à jour ; l'installateur actuel pèse 247 332 130 octets.

**État de l'audit :** `npm audit` signale encore 8 vulnérabilités modérées dans la chaîne de packaging, transitivement via `@electron/get` 3.1.0, `global-agent` 3.0.0, `roarr` 2.15.4 et `sprintf-js` 1.1.3. Elles sont liées aux dépendances de développement/assemblage ; aucun niveau haut ou critique ne reste. Je n'ai pas forcé de surcharges majeures potentiellement incompatibles. `npm audit` termine avec le code 1 en raison de ces alertes modérées.

**Validation et limites :** `npm run build:windows:dir` et `npm run build:windows:nsis` réussis avec electron-builder 26.17.0 ; `node --check` sur les fichiers Electron et `git diff --check` réussis. Aucun test automatique n'a été ajouté ou exécuté. L'installateur n'a pas été lancé sur cette machine et le format Store reste à réaliser.

**Prochaine action :** installer le package sur une machine Windows propre sans Java/Node, valider démarrage, arrêt et persistance, puis préparer l'identité MSIX et un `.msixupload`. Réévaluer les vulnérabilités modérées avant distribution.

### Continuation — Smoke test installé Windows et démarrage autonome

**Réalisé :** mise à jour d'electron-builder vers 26.17.0. Le main Electron utilise maintenant `%LOCALAPPDATA%\JBStock\electron-profile` pour le profil Chromium en mode empaqueté, sous réserve d'un chemin `LOCALAPPDATA` absolu, et journalise des codes stables pour les échecs mono-instance/démarrage sans révéler l'erreur brute.

**Validation :** exécution du JAR avec le runtime Microsoft embarqué, sans Java dans `PATH` : `/health` UP, `/api/company` authentifiée, arrêt `JBSTOCK_SHUTDOWN` code 0. Deux cycles du package `win-unpacked` ont démarré l'interface, créé puis réutilisé la même base SQLite, fermé proprement le backend Java et rendu le contrôle à code 0. L'installateur NSIS a terminé son installation silencieuse temporaire ; l'application installée a également démarré sans Java/Node dans `PATH`, créé la base sous `%LOCALAPPDATA%\JBStock\data`, puis fermé Electron et Java proprement. Les données de test étaient dans `desktop/.verification-profile` et ont été supprimées après validation.

**Limites :** le test utilise la session Windows disponible avec profils et répertoires isolés, pas une VM propre ; il ne vérifie ni upgrade/migration depuis une ancienne version, ni ports résiduels, ni MSIX. Aucun test automatisé n'a été ajouté ou exécuté dans cette continuation. `npm audit` conserve 8 alertes modérées dans des dépendances de packaging, zéro haute/critique. L'étape 2.2 reste partielle.

**Prochaine action :** valider le package sous VM Windows propre, puis réaliser les scénarios de mise à jour et d'erreurs ; préparer la configuration MSIX/Partner Center après obtention de l'identité Store.

Références : [téléchargements Microsoft OpenJDK](https://learn.microsoft.com/en-us/java/openjdk/download), [licence Microsoft OpenJDK](https://learn.microsoft.com/en-us/java/openjdk/faq), [formats de soumission Microsoft Store](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/upload-app-packages).

### Étape 1.4 terminée — Journaux et cycle backend

Le [contrat backend/desktop](CONTRAT_BACKEND_DESKTOP.md) détaille la configuration et ses limites : fichier actif de 10 MB, archives quotidiennes compressées, historique de 14 jours et plafond d'archives de 100 MB ; encodeur excluant messages libres et valeurs sensibles ; signal READY avec port, diagnostic d'échec sans secret et code de sortie 1 ; arrêt gracieux HTTP de 20 secondes par phase. Le pilotage de cet arrêt sous Windows reste à réaliser dans Electron.

### Étape 1.3 — Contrat de stockage local

Le bean `LocalStorage` est la source commune des chemins de fichiers. Les répertoires sont créés avant la datasource ; aucune donnée existante n'est effacée ni déplacée.

| Configuration | Comportement |
| --- | --- |
| `JBSTOCK_HOME` / `jbstock.storage.home` | Racine absolue explicite, à transmettre par Electron ou les tests. |
| `JBSTOCK_DATABASE_PATH` / `jbstock.storage.database-path` | Fichier SQLite explicite conservé ; chemin relatif accepté pour compatibilité, résolu depuis le répertoire de travail. Préférer un chemin absolu en production. |
| `spring.datasource.url` explicite | Prioritaire pour le fichier DB ; uniquement `jdbc:sqlite:<chemin fichier>`. Pas de mode mémoire, URI `file:` ni paramètres `?`. |
| Pas de racine explicite, DB explicite | Racine déduite du parent de la DB ; si ce parent s'appelle `data`, utiliser son parent. Aucun retour vers les données utilisateur pour les fichiers annexes. |
| Aucune surcharge | Racine `%LOCALAPPDATA%/JBStock`, DB `data/jbstock.db`. Si LOCALAPPDATA manque ou n'est pas absolu, demander JBSTOCK_HOME et arrêter le démarrage. |

Arborescence créée : `data`, `media/products/originals`, `media/products/thumbnails`, `invoices`, `backups`, `logs`, `config`, ainsi que le parent d'une DB explicitement placée ailleurs. Les futurs services doivent utiliser ce bean au lieu de recalculer les chemins.

Compatibilité : avant d'utiliser le défaut LOCALAPPDATA, vérifier l'ancien fichier `${user.home}/AppData/Local/JBStock/data/jbstock.db`. S'il existe ailleurs, arrêter avec une indication pour renseigner `JBSTOCK_DATABASE_PATH`. Une surcharge explicite constitue le choix du chemin par l'opérateur. Ne pas déplacer manuellement une base en cours d'utilisation ni copier seulement le fichier DB lorsque WAL est actif.

Le pilote reçoit les réglages sur chaque connexion : `foreign_keys=ON`, `journal_mode=WAL`, `busy_timeout=5000`, `synchronous=FULL` (valeur 2). Hikari conserve un maximum d'une connexion et un délai d'acquisition de 30 secondes. Le démarrage vérifie que WAL est effectivement actif. FULL est le choix initial de durabilité ; aucune promesse de latence ni de résistance à toutes les pannes matérielles n'est déduite des tests fonctionnels.

Le lanceur de développement fixe JBSTOCK_HOME à `Jbstock-backend/target/dev-data` et conserve sa DB à `target/dev-data/jbstock.db` (sans déplacer vers `data/jbstock.db`). Tous les fichiers de développement restent supprimables par `mvn clean`. Les tests isolent leur racine, indépendamment de LOCALAPPDATA.

### Étape 1.2 terminée — Contrat de sécurité locale

- Le lanceur transmet `JBSTOCK_LOCAL_SESSION_TOKEN` dans l'environnement des processus. Format : 32 octets aléatoires encodés en 64 caractères hexadécimaux minuscules. Aucun secret par défaut ; le contexte Spring refuse de démarrer s'il manque ou si son format est invalide.
- Chaque requête applicative doit fournir une seule valeur `X-JBStock-Local-Token`. Valeur absente, incorrecte ou dupliquée : HTTP 401, code `LOCAL_SESSION_UNAUTHORIZED`, sans renvoyer le secret. Comparaison via `MessageDigest.isEqual`.
- Seuls GET `/health` et GET `/actuator/health` sont exemptés du contrôle. Les GET/PUT Entreprise sont autorisés après contrôle ; les autres routes restent refusées même avec un token valide (HTTP 403 vérifié sur `/api/users`, `/actuator/env` et `/unknown`).
- Le filtre appartient uniquement à la chaîne Spring Security, avant CSRF. L'exemption CSRF existante de `/api/company` reste limitée à cette route ; le token de transport est exigé pour ses écritures. Réexaminer CSRF lors de l'ajout de sessions utilisateurs.
- Pas de cookie de session créé pour les rejets testés ; politique HTTP stateless, cache de requêtes désactivé, aucun utilisateur Spring par défaut.
- En développement, Vite injecte le secret côté serveur, écrase une valeur entrante et cible uniquement une origine HTTP `127.0.0.1`. React ne reçoit pas le secret. Le proxy exige Host `127.0.0.1:5173`, `Sec-Fetch-Site: same-origin` et, si Origin est présent, `http://127.0.0.1:5173` ; CORS désactivé et écoute loopback.
- Ce proxy est réservé au développement : un programme local peut fabriquer les en-têtes HTTP du navigateur. Il ne doit pas être livré en production. Le futur Electron devra gérer le secret et le transport local selon les sections 7–8. Le token ne constitue pas une identité utilisateur.

## Contrat API actuellement vérifié

| Méthode | Route | Résultat |
| --- | --- | --- |
| GET | `/health` | Même contrôle qu'Actuator, HTTP 200 et `{"status":"UP"}` lorsque le backend et SQLite sont disponibles. |
| GET | `/actuator/health` | Sonde existante conservée. Détails techniques masqués par configuration. |
| GET | `/api/company` | Profil unique avec `name`, `address`, `phone`, `email`, `fiscalIdentifiers`. |
| PUT | `/api/company` | Remplace les champs du profil et la liste ordonnée des identifiants ; renvoie le profil enregistré. |

Exemple de corps PUT :

```json
{
  "name": "Entreprise de démonstration",
  "address": "Adresse fictive",
  "phone": "",
  "email": "contact@example.com",
  "fiscalIdentifiers": [{ "label": "Identifiant fiscal", "value": "DEMO-001" }]
}
```

Contraintes : nom non blanc, 255 caractères maximum ; adresse 2000 ; téléphone 50 ; email valide si renseigné, 254 maximum ; liste fiscale obligatoire, éventuellement vide, 20 entrées maximum ; chaque entrée non nulle, libellé non blanc de 100 caractères maximum et valeur de 255 maximum. Les champs textuels optionnels nuls sont normalisés en chaîne vide à l'enregistrement.

Exemple d'erreur HTTP 400 :

```json
{"code":"VALIDATION_ERROR","message":"Veuillez vérifier les champs indiqués.","fields":["name"]}
```

JSON illisible : `INVALID_JSON`, message générique et liste `fields` vide. Aucune valeur rejetée n'est renvoyée par ces handlers. Les autres familles d'erreurs restent à traiter. Les routes Entreprise exigent désormais le token local ; l'authentification des utilisateurs reste à développer.

## Commandes et vérifications

Depuis `Jbstock-backend` :

```powershell
mvn.cmd -o test
```

Dernière exécution le 07/10/2026 : **44 tests, 0 échec, 0 erreur**. Java 21.0.8 et Maven local 3.9.9. Le mode offline fonctionne ici grâce aux dépendances déjà présentes ; sur un nouveau poste utiliser `mvn.cmd test` ou `./mvnw.cmd test` avec les téléchargements nécessaires. Le wrapper déclaré utilise Maven 3.9.16 mais n'a pas été utilisé pour cette validation.

Les tests HTTP démarrent un vrai serveur sur un port aléatoire et créent une racine sous `target/sqlite-foundation-<UUID>/` à chaque exécution. Les tests de chemins et de redémarrage utilisent des répertoires temporaires JUnit supprimés à leur fermeture. Ils ne ciblent pas la base utilisateur. Les fichiers sous `target` restent ignorés par Git.

Couverture vérifiée : démarrage, deux routes santé, token local, pragmas SQLite et leur maintien après éviction de connexion, violation de clé étrangère, initialisation Flyway, lecture/écriture Entreprise, validations et absence de modification après requête invalide. Le rollback après échec SQL au deuxième identifiant fiscal et la persistance après fermeture/réouverture du contexte backend sont testés. Au redémarrage : même profil, identifiants conservés, fichier média témoin intact, trois migrations sans réapplication, quick_check=ok. Ce test ne simule pas une coupure électrique ni un crash de processus.

Depuis l'étape 1.4 : rotation réelle avec seuil réduit en test, absence de valeurs sensibles fictives dans le fichier actif et les archives, échec explicite si le fichier de log est inutilisable, classification des erreurs, base invalide conservée, chemin inutilisable refusé et migration invalide annulée. Une requête HTTP authentifiée en cours termine avant fermeture de la datasource. Un sous-processus Java réel vérifie le code de sortie 1 et l'absence d'un secret invalide dans stdout/stderr. La rétention longue durée de 14 jours et le plafond de 100 MB sont configurés, sans test de vieillissement sur 14 jours ni saturation disque.

Depuis `Jbstock-frontend` :

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run test:dev-proxy
```

Le 07/10/2026 : **build TypeScript/Vite, lint et tests du proxy réussis**. Le test du proxy utilise un backend HTTP simulé et le port Vite 5173 (qui doit être libre) ; il vérifie l'injection du token, les refus d'origine/Host, le démarrage sans secret, le rejet des cibles distantes et l'absence du token dans un build en mémoire. Le test Electron séparé vérifie désormais le formulaire réel via preload et SQLite.

Depuis `desktop` après construction du frontend et `mvn.cmd -o package` côté backend :

```powershell
npm.cmd test
npm.cmd run test:backend
npm.cmd run test:electron
```

Le 07/10/2026 : **8 tests Node réussis**, **1 test d'intégration réel réussi** (deux processus Java successifs), **test Electron réussi** (fenêtre masquée, saisie/enregistrement/relecture, absence de Node exposé, rejet de payload invalide, arrêt Java non forcé). Capture générée : `Jbstock-backend/target/desktop-smoke.png`. Electron 44.6.0 installé avec versions verrouillées. Le build backend `mvn.cmd -o package` a également réexécuté les **44 tests Java avec succès**.

Pour lancer le prototype depuis la racine (Java 21, Maven, Node et dépendances frontend installés) :

```powershell
node scripts/dev.mjs
```

Ouvrir `http://127.0.0.1:5173` puis Ctrl+C pour arrêter. Le lanceur génère un secret neuf, lance Maven sur 127.0.0.1:8080, attend une réponse authentifiée de l'API Entreprise (90 s maximum), puis lance Vite. Il refuse un port backend déjà occupé. Vite refuse de changer automatiquement de port si 5173 est occupé.

La base de développement est `Jbstock-backend/target/dev-data/jbstock.db` : elle est distincte des données utilisateur et peut être supprimée par `mvn clean`. Ne pas y mettre de données commerciales. Le lanceur ne sauvegarde et n'affiche pas le secret. Il arrête les processus qu'il a lancés ; sous Windows le nettoyage peut forcer leur arrêt, ce n'est pas le futur cycle de fermeture desktop avec sauvegarde.

Pour un lancement séparé avancé : fournir le même secret aléatoire via `JBSTOCK_LOCAL_SESSION_TOKEN` aux deux processus ; surcharger `JBSTOCK_DATABASE_PATH` pour isoler la base et éventuellement `JBSTOCK_BACKEND_URL` (HTTP 127.0.0.1 uniquement). Ne pas utiliser de variable `VITE_*`, de secret commité ou d'argument de ligne de commande contenant le secret. `npm run build` n'exige pas de token et `npm run preview` n'est pas un lanceur de l'application complète.

Le lanceur a été testé sur Windows avec le vrai backend : santé 200, appel direct Entreprise sans token 401, appel via proxy de même origine 200 et origine étrangère 403. Après Ctrl+C, les deux ports étaient fermés. La fenêtre navigateur et le formulaire n'ont pas été vérifiés visuellement.

## Journal des sessions

### 2026-10-06 — Audit initial et première consolidation backend

**Demande :** analyser le projet par rapport à la spécification, créer un suivi durable et avancer étape par étape en commençant par le backend.

**État trouvé avant intervention :**

- Socle Spring Boot/SQLite/Flyway, formulaire React et module Entreprise déjà présents ; ne pas attribuer leur création à cette session.
- Modifications non commitées déjà présentes : `SecurityConfiguration.java`, `JbstockApplicationTests.java`, `App.tsx`, `vite.config.ts` ; dossier `company/` et migrations V2/V3 non suivis.
- `docs/CURRENT_PHASE.md` et `docs/DECISIONS.md` déjà supprimés dans l'arbre de travail. Suppressions conservées ; ce nouveau suivi décrit le code actuel, sans reconstituer des étapes historiques non vérifiées.
- Six tests existants réussissaient, mais le test du nom vide attendait 403, masquant une erreur de validation par la sécurité du dispatch d'erreur.

**Réalisé :**

- Lecture de la spécification et inventaire du backend, du frontend, des migrations, des tests et de l'absence d'Electron/CI.
- Ajout de `common/HealthController.java` : `/health` transfère vers Actuator pour réutiliser son contrôle et son statut HTTP.
- Autorisation de cette route dans `SecurityConfiguration.java`.
- Ajout de `common/ApiExceptionHandler.java` : réponses 400 structurées pour validation et JSON illisible, sans détail d'exception.
- Ajustement de `CompanyProfileRequest.java` : rejet des éléments fiscaux nuls et suppression d'un import doublonné.
- Tests enrichis dans `JbstockApplicationTests.java` ; base SQLite neuve par exécution et vérification des requêtes invalides sans modification du profil.
- Création de ce suivi et de `AGENTS.md` pour orienter les prochaines sessions vers la spécification et l'état vérifié.

**Validation :** 12 tests backend réussis ; build et lint frontend réussis. Aucun changement de schéma, aucune nouvelle dépendance, aucun déploiement ni commit effectué pendant cette session.

**Limites :** sécurité métier/desktop, Electron, UI complète, sauvegardes et packaging restent à développer ; aucune certification Store ni exigence réglementaire n'a été validée pendant cet audit. Les politiques externes devront être revérifiées au moment des intégrations et de la publication.

**Reprise :** étape 1.2, token de session local, puis chemins persistants et robustesse SQLite. Préserver les travaux utilisateur déjà présents.

### 2026-10-06 — Étape 1.2 : token de session local

**État trouvé :** modifications de la session précédente conservées ; prototype sans token. Aucune modification de la spécification ni du schéma DB.

**Réalisé :** filtre `security/LocalSessionTokenFilter.java`, configuration Spring Security/stateless et variable d'environnement dans `application.properties`. Adaptation des tests métier au token ; ajouts des refus HTTP, des doublons et des échecs de démarrage sans secret valide. Configuration Vite limitée au loopback, proxy avec secret côté serveur, vérification d'origine. Ajout de `scripts/dev.mjs`, du script `test:dev-proxy` et actualisation du présent suivi.

**Décisions :** secret obligatoire sans profil de contournement, génération 256 bits par lancement, GET santé public, aucune identité métier associée au token, aucun compte Spring implicite. Proxy de développement réservé à cet usage ; production Electron toujours à faire.

**Tests :** Maven offline : 24 tests réussis ; build et lint réussis ; contrôles proxy réussis ; lancement réel backend/Vite et vérification des statuts 200/401/403 réussis ; ports fermés après arrêt. Une assertion initiale sur Host utilisait `fetch`, qui ne transmettait pas l'en-tête voulu ; le test utilise désormais une requête HTTP bas niveau pour vérifier le véritable Host reçu.

**Limites :** comptes/rôles, cycle Electron, fermeture avec sauvegarde, rotation des logs et persistance/reconnexion SQLite restent à développer. La génération et la rotation production du secret dépendent du futur lanceur Electron. Aucune migration, dépendance supplémentaire, publication ni commit.

**Prochaine action :** étape 1.3, chemins persistants et robustesse SQLite.

Références techniques consultées : [chaîne de filtres Spring Security](https://docs.spring.io/spring-security/reference/servlet/architecture.html) et [configuration du serveur Vite](https://vite.dev/config/server-options).

### 2026-10-07 — Étape 1.3 : stockage persistant et SQLite

**État trouvé :** travaux non commités des sessions précédentes conservés. Chemin DB historique basé sur user.home ; timeout SQLite appliqué uniquement au démarrage ; pas de test de reconnexion ou de redémarrage.

**Réalisé :** `storage/LocalStorage.java` et `config/LocalStorageConfiguration.java` centralisent chemins et création de l'arborescence. `SqliteDataSourceConfiguration.java` utilise SQLiteConfig pour les réglages par connexion et vérifie WAL. `application.properties` expose les surcharges sans ancien chemin par défaut. `scripts/dev.mjs` fixe une racine isolée en conservant son fichier DB actuel. Tests ajoutés dans `storage/LocalStorageTests.java`, `storage/StorageRestartTests.java` et `JbstockApplicationTests.java`.

**Décisions :** priorité URL JDBC explicite → fichier DB explicite → DB de la racine ; racine explicite → racine déduite de la DB → LOCALAPPDATA. Arrêt si ancien emplacement ambigu, répertoire inutilisable ou LOCALAPPDATA absent sans surcharge. Aucun déplacement automatique. synchronous=FULL pour la durabilité, sans benchmark de charge à ce stade.

**Validation :** `mvn.cmd -o test` : 36 tests réussis (21 intégration HTTP/SQLite, 5 sécurité, 9 chemins, 1 double cycle backend). `node --check scripts/dev.mjs` réussi ; vérification des espaces par `git diff --check` réussie. Frontend inchangé, ses build/lint/tests proxy du 06/10 restent les derniers contrôles ; ils n'ont pas été réexécutés. Le lanceur complet n'a pas été relancé dans cette session.

**Limites :** fermeture/réouverture testée dans la même JVM ; pas de crash brutal, performance disque, restauration, migration échouée ou test MSIX. Dossiers logs/backups créés mais leurs services ne sont pas implémentés. Aucune migration SQL, dépendance ajoutée, modification de données utilisateur, publication ni commit.

**Reprise :** étape 1.4, rotation des journaux et contrat de lancement/arrêt pour Electron. Étape 1.3 vérifiée ; socle backend global encore partiel.

Sources techniques : [SQLite — synchronous](https://www.sqlite.org/pragma.html#pragma_synchronous), [configuration du pilote SQLite JDBC 3.50.2.0](https://github.com/xerial/sqlite-jdbc/blob/3.50.2.0/src/main/java/org/sqlite/SQLiteConfig.java).

### 2026-10-07 — Étape 1.4 : diagnostics et préparation Electron

**État trouvé :** socle de stockage/SQLite validé, dossier logs vide de service, sorties framework non filtrées et arrêt Spring implicite. Toutes les modifications préexistantes et suppressions documentaires conservées.

**Réalisé :** `diagnostics/SafeLogEncoder.java`, `TechnicalLog.java`, `StartupFailureListener.java`, `config/DiagnosticsConfiguration.java`, `logback-spring.xml` et `META-INF/spring.factories`. La datasource dépend de l'ouverture du journal, dont la fermeture intervient après celle du pool. `application.properties` explicite l'arrêt gracieux (20 s par phase), désactive les détails de requêtes et l'affichage SQL. `JbstockApplication.main` termine avec code 1 sans trace brute supplémentaire sur erreur RuntimeException. Signal stdout `JBSTOCK_READY <port>` après démarrage ; stderr `JBSTOCK_STARTUP_FAILED <code>` sur erreur. Ajout de `docs/CONTRAT_BACKEND_DESKTOP.md`.

**Décisions :** rotation quotidienne/10 MB, archives gzip, 14 jours et 100 MB d'archives ; pas de repli de journal dans le dossier d'installation. Exclure les messages libres, arguments et messages d'exception plutôt que prétendre reconnaître tous les secrets par expressions régulières. Conserver codes stables et emplacements des piles pour le diagnostic ; journal métier/audit distinct, toujours à développer.

**Tests :** `mvn.cmd -o test` : **44 réussis, aucun échec**, dont les 36 précédents. Nouveaux fichiers : `diagnostics/TechnicalLogTests.java`, `GracefulShutdownTests.java`, `MainProcessTests.java`, `storage/StartupFailureTests.java`. Rotation effective et contenu des archives inspectés par tests ; requête Entreprise en cours achevée en 200 avant fermeture SQLite ; vrai processus Java en échec terminé en 1 avec sortie sans secret. Migration délibérément invalide testée avec rollback des changements. `git diff --check` réussi. Frontend inchangé : ses contrôles du 06/10 n'ont pas été répétés.

**Corrections pendant validation :** le contexte Logback isolé de test nécessitait son MDCAdapter ; le test d'arrêt initial utilisait la sonde santé, qui peut légitimement passer en 503 pendant la fermeture. Le test final utilise une vraie requête Entreprise authentifiée.

**Limites :** pas encore de supervision Electron, de commande d'arrêt Windows contrôlée, de snapshot avant migration ni de backup à la fermeture. L'arrêt testé ferme le contexte Spring ; un kill forcé Windows ne lui est pas équivalent. Les fichiers de log ne couvrent pas les erreurs antérieures à la résolution du stockage ; stdout/stderr permettent de les signaler. Les traces sont volontairement moins détaillées ; sorties JVM natives hors encodeur. Aucune nouvelle dépendance, migration SQL, modification des données utilisateur, publication ou commit.

**Reprise :** étape 2.1, fondation Electron et transport local sécurisé ; lire le contrat backend/desktop avant de développer. Ne pas commencer les nouveaux modules métier avant le premier build desktop testable.

### 2026-10-07 — Étape 2.1 : prototype Electron et transport sécurisé

**État trouvé :** backend préparé et 44 tests existants, frontend limité au formulaire Entreprise, aucun dossier desktop. Modifications et suppressions préexistantes préservées.

**Réalisé :** création de `desktop/` avec manifeste/lockfile Electron 44.6.0, main, superviseur Java, preload limité, protocole local et règles de sécurité. Service `Jbstock-frontend/src/services/company.ts` ajouté, formulaire adapté au transport desktop en conservant le mode navigateur. Ajout backend de `desktop/DesktopControl.java` pour fermer Spring via le pipe stdin privé activé explicitement. Guide desktop et contrat de lancement actualisés.

**Décisions :** aucun serveur Vite dans la fenêtre Electron, uniquement le build React servi par `jbstock://app`. Le renderer n'a ni token, ni Node, ni IPC générique. Secret et HTTP loopback dans le main. Java est un enfant direct, sans shell ; port attribué par le système, santé et accès authentifié vérifiés avant ouverture. Timeout READY 90 s, requêtes 15 s, fermeture contrôlée 30 s avant arrêt forcé de secours. Données de prototype isolées sous `target/desktop-dev`, sans déplacement des anciennes bases.

**Validation :** `mvn.cmd -o package` : JAR construit et 44 tests réussis ; frontend build/lint/test:dev-proxy réussis ; `npm test` desktop : 8 tests réussis ; `test:backend` : profil conservé sur deux processus Java, chacun fermé sans force ; `test:electron` : formulaire réel fonctionnel dans Electron masqué, écriture/relecture SQLite, payload invalide refusé, Node absent du renderer, arrêt contrôlé réussi. Capture inspectée visuellement. Vérifications de syntaxe main/shell et `git diff --check` réussies.

**Limites :** pas de runtime Java embarqué, de build autonome, d'installation MSIX, de sauvegarde à la fermeture ni de comptes/rôles. Le test Electron exerce la fenêtre partagée, IPC et le superviseur ; les boîtes d'erreur et la garde mono-instance du main nécessitent encore un scénario complet avec le futur package. Le chemin packaged est préparé mais non validé. Le signal EOF parent perdu est pris en charge par le code ; le crash du parent Electron n'a pas été simulé. Aucune migration SQL, donnée utilisateur modifiée, publication ou commit.

**Reprise :** étape 2.2, runtime redistribuable embarqué, assemblage du package Windows et validation sans Java/Node externes. Ne pas démarrer les nouveaux modules métier avant cette validation.

Références consultées : [sécurité Electron](https://www.electronjs.org/docs/latest/tutorial/security), [protocoles locaux](https://www.electronjs.org/docs/latest/api/protocol), [IPC et preload](https://www.electronjs.org/docs/latest/tutorial/ipc).

### 2026-10-07 — Reprise 2.3 : validation reproductible du runtime empaqueté

**État trouvé :** NSIS et MSIX de développement présents ; installation MSIX, mise à jour et Windows vierge non vérifiés. Nombreuses modifications non commitées préexistantes, toutes préservées. Spécification et suivi confrontés au code desktop et au statut Git. L'exception Git `safe.directory` est passée uniquement à la commande, sans modifier la configuration globale.

**Réalisé :** ajout de `desktop/test/runtime.integration.cjs` et de `test:runtime` dans `desktop/package.json` ; guides `desktop/README.md`, `docs/PACKAGING_MSIX.md` et présent suivi actualisés. Le test utilise le runtime/JAR du package existant, dans une copie temporaire aux chemins avec espaces/accents. Environnement enfant minimal, PATH limité à System32, LOCALAPPDATA isolé, aucune surcharge JBSTOCK_HOME. Vérification du chemin `JBStock/data/jbstock.db`, de l'enregistrement/relecture du profil et de ses identifiants fiscaux, du maintien d'un média témoin après déplacement des fichiers applicatifs, de deux arrêts non forcés et de leurs traces `LOGGING_STOPPED`. Nettoyage limité au répertoire temporaire créé par le test ; environnement du runner restauré.

**Tests :** `npm.cmd --prefix desktop run test:runtime` : **1 test réussi**, environ 46 s, deux vrais processus Java embarqués ; `npm.cmd --prefix desktop test` : **8 tests réussis** ; `npm.cmd --prefix desktop run test:msix` : **413 fichiers applicatifs identiques par SHA-256**, identité, manifeste, assets et block map contrôlés. Aucune modification du backend ou du frontend ; leurs suites n'ont pas été répétées.

**Décisions / limites :** validation locale de la séparation installation/données (sections 5, 9, 89, 103), pas une simulation de mise à jour de version. Aucun lancement du main Electron dans le nouveau test, aucun contrôle de ports résiduels, aucune coupure réseau ni VM vierge. Le test vérifie les artefacts présents, pas leur fraîcheur par rapport aux sources. Aucun certificat créé, confiance Windows modifiée, package installé, migration SQL, donnée commerciale modifiée ou commit. L'étape 2 reste partielle.

**Prochaine action :** disposer d'une VM Windows ou d'un compte de test dédié pour préparer la signature/confiance de développement, installer le MSIX, relever les chemins effectifs et tester une mise à jour conservant les données fictives. Les scénarios mono-instance/ressources absentes du main empaqueté et la validation Windows vierge restent ouverts.

### 2026-10-07 — Étape 2.3 : installation, mise à jour et persistance MSIX locales

**Demande et autorisation :** poursuivre la prochaine étape. L'utilisateur a explicitement choisi son compte habituel sur ce PC pour installer le MSIX. Les accès au magasin de certificats, la confiance machine via UAC, l'installation et la mise à jour ont été autorisés. Aucun changement des modifications préexistantes du backend/frontend.

**Travail réalisé :** `build-msix.ps1` accepte une révision réservée aux essais et un dossier de sortie ; `verify-msix.ps1` accepte la version attendue. Ajout de `create-msix-test-certificate.ps1`, `sign-msix-test.ps1`, `trust-msix-test-certificate.ps1`, `activate-msix-test.ps1`, `stop-msix-test.ps1`, `test/msix-ui.cjs` et `test/msix-db.cjs`. Guide MSIX actualisé. Certificat RSA/SHA-256 non exportable, usage signature de code, durée 90 jours, sujet strict de développement ; seuls `.cer` et métadonnées publiques sont exportés. Signature de copies MSIX `0.0.1.0` et `0.0.1.1` ; clé conservée dans CurrentUser/My, certificat public approuvé dans LocalMachine/TrustedPeople après UAC. Empreinte/expiration documentées dans le guide.

**Validation :** MakeAppx a construit la révision 1 ; vérification de 413 fichiers applicatifs identiques par SHA-256 pour cette révision avant et après signature. SignTool a signé les deux packages ; Windows a accepté installation puis mise à jour avec famille stable `JBStock.Development_yrahyscxc0a2p`. Activation par identité MSIX, Java embarqué sous WindowsApps, `/health` UP. Deux activations de la première version ont laissé une seule fenêtre/un seul Java. Le profil trouvé renseigné a été conservé : le mode seed a refusé de l'écraser, puis les comparaisons inspect/check ont réussi après mise à jour et après redémarrage. Base arrêtée sauvegardée avant mise à jour ; chemin physique sous Packages/LocalCache/Local/JBStock inchangé et SHA-256 DB identique entre les deux premières fermetures. SQLite en lecture seule : quick_check=ok, aucune violation de clé étrangère, trois migrations réussies, une entreprise. Arrêts par fermeture normale de fenêtre, sortie des processus du package et ports HTTP/diagnostic inaccessibles contrôlés. `npm.cmd --prefix desktop test` : **8 tests réussis** ; parsing PowerShell des scripts MSIX et syntaxe Node des deux helpers réussis. Suites backend/frontend non répétées car leur code n'a pas changé.

**Corrections pendant validation :** contrôle EKU du certificat effectué via l'extension X509 plutôt qu'une propriété PowerShell non conforme. Les endpoints TCP de cette machine renvoient parfois un état vide ; contrôle adapté par propriétaire/port distant nul, santé HTTP puis tentative TCP après fermeture. Aucune erreur d'application n'a été déduite de ces erreurs de scripts.

**Données et limites :** aucun écrasement du profil trouvé ; valeurs et captures conservées uniquement dans `desktop/release/msix-validation/`, ignoré par Git, jamais dans les docs ni les fixtures. La copie de sécurité du dossier data a été faite après arrêt complet, pas pendant WAL actif. Ce n'est pas le futur service automatique de backup. Version de package changée sans migration ni changement métier. MSIX 0.0.1.1 et certificat restent installés ; la session de diagnostic est fermée. Pas de Windows vierge, redémarrage du PC, coupure Internet, désinstallation, migration hors MSIX, signature Store ou `.msixupload` validés. Aucun commit ni publication.

**Prochaine action :** étape 2.4, reproduire sur Windows vierge et couvrir ressources absentes/premier lancement offline ; conserver l'étape 2 globale partielle. L'identité Partner Center et la soumission Store restent distinctes.

### 2026-10-07 — Arrêt de session et exigence multilingue

**Demande :** arrêter le développement à ce point et inscrire pour la prochaine session une application multilingue arabe/anglais dans le suivi et les instructions à respecter.

**Décision :** anglais (`en`) par défaut, arabe (`ar`) disponible via sélecteur, choix local persistant hors ligne, interface arabe RTL et anglaise LTR. Traductions centralisées des interfaces et messages ; formats localisés sans altération des données métier. Mise en œuvre prioritaire à la prochaine reprise sur le socle existant, puis retour à l'étape 2.4.

**Fichiers modifiés :** `AGENTS.md`, `docs/SUIVI_PROJET.md`, spécification fonctionnelle (section 19.1 et règle 13 de la section 100). Modifications précédentes préservées.

**Validation et limites :** modification documentaire uniquement ; cohérence des trois fichiers contrôlée, aucun test applicatif requis ou exécuté. Le multilingue reste **à faire** ; aucune modification du code, des packages installés ou des données. Aucun commit ni publication. Prochaine action : inventorier les textes du formulaire Entreprise et des dialogues Electron pour implémenter les ressources `en`/`ar`.

### 2026-10-08 — Socle multilingue Entreprise et Electron

**État trouvé :** quatre documents de `docs/` consultés, spécification (notamment 19.1, 100 et 103), suivi, code et statut Git comparés. Textes du formulaire anglais, erreurs de transport et dialogues français en dur ; aucune infrastructure multilingue. Nombreuses modifications non commitées et suppressions documentaires préexistantes conservées. Exception Git `safe.directory` limitée aux commandes de cette session.

**Réalisé :** catalogues `desktop/src/locales/en.json` et `ar.json` communs au main Electron et au build React ; `desktop/src/language.cjs` pour lecture anticipée et écriture atomique de la préférence, options de dialogues traduites et bouton Fermer localisé. `main.cjs`, `shell.cjs`, `preload.cjs` ajoutent seulement deux méthodes IPC de langue, avec contrôle de l'émetteur et valeurs autorisées. `Jbstock-frontend/src/i18n.ts`, `main.tsx`, `App.tsx`, `services/company.ts`, `index.css` et `tsconfig.app.json` : initialisation avant rendu, sélecteur, traductions, RTL/LTR, police système compatible arabe, validations explicites sans bulles natives dépendantes de la langue Windows. Les erreurs restent des codes/clés jusqu'à l'affichage et changent de langue immédiatement. Champs libres en direction automatique ; téléphone/email en LTR. Numérotation accessible des identifiants via Intl ; helpers de date/devise prêts pour les futurs écrans, aucune nouvelle valeur financière affichée.

**Persistance / décisions :** langue de l'interface distincte des futures préférences Entreprise/facture. En développement : `target/desktop-dev/config/language.json`. En package : `app.getPath('userData')/settings/language.json`, sous le profil Electron existant. En navigateur : clé localStorage `jbstock.language`. Anglais si aucun choix ; fichier invalide laissé intact avec alerte, jusqu'au choix explicite d'une langue. Une écriture échouée conserve la dernière langue persistée et affiche une alerte. Aucun réseau ni dépendance ajoutée. Aucun changement du backend, de schéma SQLite ou des valeurs métier.

**Tests :** `npm.cmd --prefix Jbstock-frontend run build`, `run lint` et `run test:dev-proxy` réussis ; `npm.cmd --prefix desktop test` : **12 tests réussis**. `npm.cmd --prefix desktop run test:i18n` : **1 scénario réussi sur deux vrais processus Electron/Java**, environ 30 s : anglais initial, arabe RTL, validations nom/email/identifiant et erreurs de backend traduites, bascule sans perte du brouillon, écriture/relecture SQLite, préférence arabe restaurée, retour LTR, valeurs mixtes arabe/latin et zéros initiaux inchangés, payload de langue invalide rejeté, aucun Node exposé, deux arrêts Java non forcés. HTTP(S) Chromium bloqué dès avant le chargement ; requête témoin refusée avec `ERR_BLOCKED_BY_CLIENT`. Tests de préférences : fichier absent, invalide, langue interdite, échec d'écriture et nouvelle instance ; clés/placeholders des catalogues et contenus/options de tous les dialogues comparés dans les deux langues. Fichiers : `desktop/test/language.test.cjs`, `i18n.integration.cjs`, `i18n-smoke.cjs` ; commande ajoutée dans `desktop/package.json`. Smoke existant adapté aux nouvelles méthodes ; helper MSIX rendu indépendant des libellés et compatible avec ancien/nouveau preload.

**Contrôle visuel :** captures `Jbstock-backend/target/desktop-i18n-first.png` (arabe RTL) et `desktop-i18n-restart.png` (anglais LTR) inspectées : textes lisibles, disposition inversée, données mixtes conservées. Le test attend le rafraîchissement de la fenêtre masquée avant capture pour éviter une image du formulaire antérieur. Guides `desktop/README.md`, contrat backend/desktop, suivi et `AGENTS.md` actualisés.

**Contrôles finaux :** `node --check` sur main, shell, preload, langue et helpers smoke/MSIX réussi ; `git diff --check` avec reconnaissance des fins de ligne CRLF réussi, aucune modification de configuration Git globale. Un premier contrôle avec `core.autocrlf=false` signalait les CRLF préexistants comme espaces ; aucun fichier n'a été normalisé pour ces faux positifs.

**Corrections pendant validation :** le runner supprime réellement `ELECTRON_RUN_AS_NODE` au lieu de lui affecter une chaîne vide. Les premiers contrôles réseau fondés sur `navigator.onLine` puis l'émulation de session ne prouvaient pas une coupure effective ; le scénario final utilise un blocage HTTP(S) explicite et vérifié. Tests graphiques exécutés hors bac à sable avec autorisation, données fictives et répertoires temporaires isolés.

**Limites :** pas de nouvelle installation ni mise à jour des packages existants ; pas de VM vierge, coupure réseau système ou contrôle graphique des dialogues natifs. La persistance navigateur est implémentée mais n'a pas de scénario E2E dédié. Les formats date/montant ne sont pas encore exercés dans un écran métier. Traduction arabe à faire relire lors de la recette utilisateur. Tests Java non répétés car le backend n'a pas changé ; les tests Electron utilisent son JAR existant. Aucun commit ni publication ; l'étape desktop globale reste partielle.

**Prochaine action :** reconstruire et vérifier le package intégrant le multilingue, tester erreurs de ressources et messages natifs dans les deux langues, puis poursuivre l'étape 2.4 sur Windows vierge.

Références techniques : [préférences dans userData Electron](https://www.electronjs.org/docs/latest/api/app#appgetpathname), [dialogues et libellés des boutons](https://www.electronjs.org/docs/latest/api/dialog).

### 2026-10-08 — Continuation : package multilingue et dialogues Windows réels

**Demande et état :** utilisateur approuvant la reconstruction et les validations restantes. Documents, code et Git revérifiés ; modifications préexistantes conservées. Le second PC Windows existe mais n'est pas disponible avant plusieurs heures selon l'utilisateur. Aucun nouvel environnement Windows vierge accessible pendant cette session.

**Réalisé :** frontend et JAR reconstruits, nouveau `win-unpacked` et installateur NSIS `JBStock-0.0.1-setup.exe`, MSIX de développement non signé `JBStock.Development-0.0.1.2-x64.msix`. Versions précédentes MSIX conservées ; installation 0.0.1.1 et certificats inchangés. Ajout de `desktop/test/packaged.integration.cjs`, `test/native-dialog.ps1` et commande `test:packaged`. Le test compare sources/catalogues ASAR, index frontend et JAR aux fichiers courants, puis lance la vraie application packagée dans une copie temporaire avec espaces/accents, profil isolé et PATH limité à System32. Deux cycles anglais → arabe → relance vérifient données, préférence sous `electron-profile/settings/language.json`, fermeture normale, deux fins de journal Java et ports de diagnostic fermés. Six autres lancements retirent temporairement Java/JAR/frontend uniquement dans cette copie : messages et action de fermeture contrôlés dans les deux langues ; base fictive inchangée par SHA-256 après chaque échec.

**Défaut visuel corrigé :** sur Windows LTR, les fragments Java/JBStock désorganisaient l'affichage des messages arabes malgré les bonnes chaînes. `desktop/src/language.cjs` encadre le message arabe avec les caractères Unicode de direction RTL, sans modifier les traductions ni données. Les captures finales montrent l'ordre correct. Le cadre natif et l'icône conservent la disposition système. Assertions adaptées dans `test/language.test.cjs` et `i18n-smoke.cjs`.

**Tests et résultats :** `mvn.cmd -o -f Jbstock-backend/pom.xml package` : **44 tests réussis**, JAR reconstruit ; frontend `npm.cmd --prefix Jbstock-frontend run build` réussi ; `npm.cmd --prefix desktop test` : **12 tests réussis** après correction RTL ; build NSIS réussi. `npm.cmd --prefix desktop run test:packaged` final : **1 scénario réussi**, environ 47 s, deux lancements normaux et six erreurs de ressources. Six captures natives inspectées, puis trois captures arabes revérifiées après correction RTL ; capture du formulaire empaqueté au redémarrage inspectée. `build:windows:msix:test -- -TestRevision 2` et vérification `test:msix -- -PackagePath release/JBStock.Development-0.0.1.2-x64.msix -ExpectedVersion 0.0.1.2` : assemblage et **413 fichiers identiques par SHA-256**. Syntaxe Node et parsing PowerShell contrôlés. Preuves et rapport synthétique : `desktop/release/packaged-validation/`, ignoré par Git.

**Artefacts finaux :** NSIS **247 336 313 octets**, SHA-256 `FDD7838B4D08CB3F157A189F9029ACD5CDD21B214F9F77E611E663CC7220B76F`. MSIX 0.0.1.2, SHA-256 `D55E43D9FE63CA372A10E02A3E459B7BDCEC537341F027EB14BA5ECD49789EFF`. Ces empreintes sont propres à ce build. Fiche `docs/TEST_WINDOWS_VIERGE.md` créée pour le transfert et la recette hors ligne ; guides desktop/MSIX et instructions de reprise actualisés.

**Corrections des outils de test :** extraction ASAR avec séparateurs Windows ; dialogues lancés sans masquer leur première fenêtre ; UI Automation de cette version Windows expose l'action comme `Pane`, sans InvokePattern. Le helper vérifie libellé, position et identifiant du contrôle appartenant au processus testé puis utilise `TDM_CLICK_BUTTON` si nécessaire. Les premiers échecs de ces assertions étaient des erreurs de test, distinctes du défaut bidi constaté visuellement. Maven et le téléchargement/cache de composants de packaging étaient refusés dans le bac à sable ; exécutions hors bac à sable autorisées. Les tests normaux se ferment proprement ; la terminaison de secours ne vise que l'enfant direct créé par un test en échec.

**Limites :** nouveau NSIS assemblé mais non installé pendant cette session ; nouveau MSIX non signé/non installé ; aucune publication, modification de confiance ou de données utilisateur. Pas de Windows vierge, coupure Internet système, redémarrage du PC, nouvelle mise à jour MSIX, restauration ou migration testés. Le contrôle des ports de ce nouveau test concerne le diagnostic Chromium ; le port HTTP Java n'y est pas relevé (arrêt vérifié par `LOGGING_STOPPED`). Aucun changement backend, migration SQL ou dépendance applicative ; aucun commit. Étape 2 globale toujours partielle.

**Prochaine action :** lorsque le second PC sera disponible, appliquer la fiche de recette et enregistrer ses résultats, puis réaliser la validation MSIX distincte.

Références : [dialogues Electron](https://www.electronjs.org/docs/latest/api/dialog), [UI Automation InvokePattern](https://learn.microsoft.com/dotnet/api/system.windows.automation.invokepattern), [message Windows TDM_CLICK_BUTTON](https://learn.microsoft.com/en-us/windows/win32/controls/tdm-click-button).

### 2026-10-08 — Reprise du diagnostic interrompu : arrêt Java après crash Electron

**État trouvé et comparaison :** spécification (sections 100/103), suivi, contrat desktop, fiche Windows vierge et code confrontés au statut Git. Nombreuses modifications et suppressions documentaires préexistantes, ainsi que tout `desktop/` non suivi par Git, conservées. Git exige une exception de propriété dans le bac à sable : `-c safe.directory=C:/Users/jaiba/IdeaProjects/JBStock` utilisé seulement pour les commandes, sans configuration globale. La session précédente avait ajouté les quatre phases et les contrôles processus/ports dans `desktop/test/packaged.integration.cjs` et `packaged-processes.ps1`, après le dernier résultat consigné. Ces ajouts restent présents. Le journal antérieur décrivant deux cycles et le seul port de diagnostic correspond au test antérieur, pas au test renforcé. Aucun correctif applicatif de ce défaut n'était présent dans `backend.cjs`.

**Diagnostic vérifié :** `npm.cmd --prefix desktop run test:packaged` sur le package antérieur échoue en environ **49 s**, après deux fermetures normales réussies. Après terminaison du seul main Electron, Java disparaît et les ports se ferment, mais le journal n'atteint pas `LOGGING_STOPPED`. `DesktopControl` traite déjà EOF/IOException en fermant Spring. Le lancement Java était sans `detached` ; l'hypothèse Windows est confortée par ce résultat puis par le succès du même scénario après correction. Le mécanisme Windows exact n'a pas été instrumenté séparément.

**Correction et fichiers :** `desktop/src/backend.cjs` ajoute `detached: process.platform === 'win32'`, conserve `windowsHide`, les trois pipes, la référence du processus et l'attente de sortie, sans `unref()`. Pas de changement Java, SQLite, migration, dépendance ou texte d'interface. `desktop/test/packaged.integration.cjs` inclut désormais `backend.cjs` dans les comparaisons ASAR/source. Contrôle négatif effectué avant reconstruction : refus immédiat avec `Stale packaged source: backend.cjs`. Aucune modification du helper `packaged-processes.ps1` n'a été nécessaire. Guides `desktop/README.md`, `docs/CONTRAT_BACKEND_DESKTOP.md`, `PACKAGING_MSIX.md`, `TEST_WINDOWS_VIERGE.md`, suivi et instructions de reprise actualisés.

**Tests et builds :** `npm.cmd --prefix desktop test` : **12/12 réussis**, dont arrêt forcé après délai, crash Java, timeout, authentification et langue. `node --check` sur lanceur/test packaged et parsing PowerShell du helper réussis. `build:windows:nsis` échoue dans le bac à sable par refus réseau `EACCES`, puis réussit hors bac à sable avec autorisation. Le package reconstruit passe `test:packaged` : **1 scénario réussi en environ 94 s**, quatre démarrages avec PATH limité à System32, profils fictifs isolés avec accents/espaces, données et arabe RTL conservés, un seul Java enfant et `/health` UP. Fermetures normales et arrêt brutal du seul main Electron : quatre `LOGGING_STOPPED`, tous les processus de la copie sortis, ports Java et Chromium diagnostic fermés. Le quatrième lancement vérifie la récupération après crash. Six dialogues natifs contrôlés et fermés, base inchangée par SHA-256 après chaque erreur de ressource. Captures produites automatiquement ; pas de nouvelle revue visuelle manuelle, dispositions et traductions applicatives inchangées. Preuves courantes dans `desktop/release/packaged-validation/summary.json` et `lifecycle-{first,restart,parent-crash,recovery}.json` (ignorés par Git).

**MSIX et artefacts :** `npm.cmd --prefix desktop run build:windows:msix:test -- -TestRevision 2`, puis `test:msix -- -PackagePath release/JBStock.Development-0.0.1.2-x64.msix -ExpectedVersion 0.0.1.2` réussis : identité/manifest/assets/block map contrôlés, **413 fichiers applicatifs identiques par SHA-256**. Révision non signée `0.0.1.2` reconstruite avec le correctif ; anciennes versions signées conservées. NSIS `desktop/release/JBStock-0.0.1-setup.exe` : **247 336 569 octets**, SHA-256 `FD87882F1A7065A9AEDCEA75F6017DD301065FEA3AF2889EEC6778C4EA47730E`. MSIX : **296 393 056 octets**, SHA-256 `3C64A258BBFF4F55902379E38A8B323FD01B26B68EC8AB1BC1F3ECAE30525453`. Ces empreintes remplacent celles du build précédent pour le transfert ; empreintes historiques du journal conservées.

**Limites et décision :** correctif du scénario crash du main vérifié localement ; étape desktop globale toujours partielle. Ni installation NSIS, ni signature/installation MSIX, ni modification de l'installation `0.0.1.1`, des certificats ou des données utilisateur. Aucun nouveau module métier, commit ou publication. Backend/frontend et runtime inchangés : leurs suites complètes et builds réutilisés de la validation précédente, pas relancés. Un arrêt brutal de Java ou de tout l'arbre, une coupure électrique, les sauvegardes/restaurations et toutes les versions Windows ne sont pas couverts. Pas de réseau système déconnecté, Windows vierge ou redémarrage PC validés dans cette session.

**Prochaine action concrète :** transférer le NSIS corrigé et contrôler son empreinte, puis réaliser [TEST_WINDOWS_VIERGE.md](TEST_WINDOWS_VIERGE.md) sur le second PC dès sa disponibilité. Recueillir les résultats réels avant de conclure ; préparer ensuite la recette MSIX distincte et les autres critères desktop/Store.

**Contrôles finaux :** statut Git revérifié, changements préexistants conservés ; `git -c safe.directory=C:/Users/jaiba/IdeaProjects/JBStock -c core.whitespace=cr-at-eol diff --check` réussi pour les fichiers suivis (avertissements LF/CRLF existants, aucune normalisation). Recherche des espaces de fin de ligne dans les fichiers de cette session, dont les fichiers non suivis : aucun. Syntaxe Node du lanceur et du test packaged revérifiée après les changements.

Référence : [Node.js — options.detached et suivi du processus](https://nodejs.org/download/release/v25.9.0/docs/api/child_process.html#optionsdetached).

### 2026-10-08 — Retour utilisateur : premier essai sur le second PC

**Résultat rapporté :** l'utilisateur a transféré `desktop/release/JBStock-0.0.1-setup.exe` vers un autre PC sans données JBStock, réussi l'installation sans connexion Wi-Fi/Internet, puis changé la langue avec succès. Le second PC est désormais disponible. Ce sont des observations utilisateur, pas des tests exécutés par l'agent.

**Traçabilité :** statut Git et suivi revérifiés, exigences desktop des sections 100/103 conservées. Mise à jour documentaire uniquement dans `docs/SUIVI_PROJET.md` et `docs/TEST_WINDOWS_VIERGE.md` ; aucun code, package, profil ou changement préexistant modifié. Aucun test applicatif relancé pour ce retour manuel.

**Limites :** persistance des données/langue après fermeture et redémarrage Windows non encore rapportée. Version Windows, présence préalable de Java/Node, empreinte du fichier transféré, contrôles RTL/LTR, validations et mono-instance non renseignés. Installation hors ligne confirmée ; maintien de la déconnexion pendant le premier lancement à préciser. Aucun résultat MSIX externe rapporté. Recette Windows vierge et étape desktop globale toujours partielles.

**Prochaine action :** compléter les confirmations et essais restants sur le même PC selon la fiche, en priorité l'enregistrement de données fictives et la conservation des données/langue après relance puis redémarrage Windows hors ligne. Ne pas recommencer l'installation déjà réussie.

### 2026-10-08 — Second PC : persistance hors ligne confirmée

**Résultat utilisateur :** après les trois étapes demandées (enregistrer des données fictives et choisir l'arabe, fermer/relancer, puis redémarrer Windows et rouvrir JBStock, toujours sans Internet), l'utilisateur confirme : « j'ai realisé ces étape tous ca marche ». Conservation des données et de la langue après relance et redémarrage Windows désormais validée par son retour manuel. Installation hors ligne et changement de langue avaient déjà été rapportés comme réussis.

**Changements :** `docs/SUIVI_PROJET.md` et `docs/TEST_WINDOWS_VIERGE.md` actualisés, journal précédent conservé. Documents, statut Git et lanceur desktop déjà inspectés lors de la reprise ; statut Git revérifié. Aucun changement de code, package, installation ou donnée ; aucune suite applicative relancée pour une confirmation utilisateur. Contrôle documentaire des espaces de fin de ligne effectué.

**Limites / prochaine action :** ce retour valide les scénarios effectués sur ce PC, sans accès direct de l'agent. Version Windows, présence préalable de Java/Node et empreinte copiée restent inconnues ; validations UI détaillées et mono-instance non rapportées. Compléter ces éléments, puis poursuivre les validations desktop restantes et la recette MSIX distincte. Ne pas déclarer toute la fondation desktop ou la recette complète terminée.

### 2026-10-08 — Second PC : Windows 11 autonome et ralentissement signalé

**Retour reçu :** Windows 11, ni Java ni Node.js préinstallés. Installation et persistance hors ligne déjà réussies ; scénario autonome désormais confirmé par l'utilisateur. Léger ralentissement du PC signalé pendant l'installation, puis confirmé aussi au démarrage de JBStock. Aucun ralentissement continu en utilisation n'est établi à ce stade.

**Examen ciblé :** statut Git revérifié, références précédemment lues conservées. `desktop/src/main.cjs` attend le démarrage backend avant de créer la fenêtre ; `backend.cjs` lance Java sans réglages JVM explicites de mémoire. Spring initialise ses composants, Hibernate et SQLite avant READY. Sans mesure sur le second PC, ces éléments n'établissent pas la cause du ralentissement. Taille NSIS locale : 247 336 569 octets ; fichiers `win-unpacked` : 545 494 950 octets / 413 fichiers, dont runtime Java 86 262 684 octets / 334 fichiers (mesures de fichiers, pas de RAM). Décompression/écritures disque et analyses antivirus sont des pistes pour l'installation ; initialisation Electron/Java/Spring, disponibilité CPU/RAM/disque et antivirus sont des pistes pour le démarrage. Aucune cause ni optimisation validée.

**Changements et vérification :** suivi et fiche de recette uniquement ; code, packages et toutes les modifications préexistantes conservés. Pas de test applicatif relancé, pas de benchmark ni profilage sur le second PC. Documentation relue et espaces de fin de ligne contrôlés. La recherche d'un fichier `builder-effective-config.yaml` n'a pas abouti ; aucune configuration de compression précise déduite de ce fichier absent.

**Prochaine action :** obtenir la durée du ralentissement, CPU/RAM et SSD/HDD ; distinguer attente d'ouverture et ralentissement général du PC, puis mesurer les processus JBStock/Java/antivirus et le disque lors d'un démarrage si nécessaire. Ne pas modifier les réglages JVM ni le packaging avant des mesures pertinentes. Validations desktop/MSIX restantes conservées, aucun nouveau module métier.

Références : [NSIS electron-builder](https://www.electron.build/docs/nsis/), [analyse des performances Microsoft Defender](https://learn.microsoft.com/en-us/defender-endpoint/tune-performance-defender-antivirus).

### 2026-10-08 — Précision : ralentissement général au démarrage

**Signalement confirmé :** le démarrage de JBStock ralentit tout le second PC pendant quelques secondes, pas seulement l'apparition de la fenêtre. Cause et saturation CPU/RAM/disque inconnues ; comportement après ouverture du formulaire encore à préciser. Les validations fonctionnelles hors ligne restent acquises dans leur périmètre, mais la performance desktop reste à diagnostiquer avant de conclure.

**Action et limites :** fiche `docs/TEST_WINDOWS_VIERGE.md` et suivi actualisés après relecture et contrôle Git ; modifications existantes conservées, aucun changement applicatif ni test relancé. Prochaine action : relever Processeur/Mémoire/Disque et le processus dominant dans le Gestionnaire des tâches déjà ouvert avant le lancement, puis vérifier le retour à la fluidité. Ne pas attribuer le défaut à Java, au matériel ou à l'antivirus sans observation. Contrôle des espaces de fin de ligne des deux documents effectué.

### 2026-10-08 — Alerte base après réinstallation : conservation et diagnostics

**Demande / état trouvé :** après installation hors ligne et persistance réussies sous Windows 11 sans Java/Node, l'utilisateur a désinstallé puis réinstallé et reçu une alerte « cannot open the db ». Il demande si les fichiers sont conservés et indique que le second PC n'est plus disponible ; poursuivre les travaux locaux sans lui demander de nouveaux essais maintenant. Spécification (100/103), suivi, statut Git, stockage, datasource, logs, lanceur et templates NSIS confrontés ; modifications et suppressions préexistantes conservées.

**Conservation examinée :** la base NSIS est normalement sous `%LOCALAPPDATA%\JBStock\data\jbstock.db`, hors du dossier d'installation par défaut. Les templates NSIS locaux ne suppriment pas ce dossier métier lors d'une désinstallation normale ; l'application ne remplace pas une base invalide au démarrage. Cette règle et les tests locaux ne prouvent pas que les fichiers du second PC existent ou sont intègres. Pas de suppression, reset, réparation automatique ni migration de données utilisateur ; sauvegarde/restauration automatique toujours absente.

**Implémentation :** `SqliteFailure.java` déduit des codes fixes du résultat SQLite, y compris codes étendus via l'octet bas. `SqliteDataSourceConfiguration.java` consigne le code avant fermeture du journal sur échec d'initialisation. `SafeLogEncoder.java` autorise uniquement une liste fermée pour `com.jbstock.database` ; chemins, SQL, données et messages d'exception restent filtrés. Codes : BUSY, READONLY, IOERR, CORRUPT, FULL, CANTOPEN, NOTADB, OTHER, DATABASE_FAILURE. Contrat stderr `DATABASE_ERROR`, dialogues/traductions et schéma inchangés. Cela améliore l'observabilité ; ce n'est pas un correctif prouvé de l'alerte distante. Tests `TechnicalLogTests.java` et `StartupFailureTests.java` renforcés : filtrage, classification et code NOTADB sur vraie base invalide sans remplacement.

**Tests desktop ajoutés :** `desktop/test/nsis.integration.cjs` et scripts `build:windows:nsis:validation`/`test:nsis` construisent/installent seulement `JBStockLifecycleTest`, identité `com.jbstock.validation.lifecycle`, exécutable distinct, sans raccourcis ni lancement automatique, profil fictif et chemins accentués. L'installation JBStock habituelle n'est pas remplacée. Rapport dans `desktop/release/nsis-lifecycle/validation.json`. `database-failure.integration.cjs`, `lock-database.ps1` et `test:database-access` tiennent un fichier SQLite de test en accès exclusif sans modifier ses permissions ou octets ; démarrage refusé, `SQLITE_CANTOPEN`, hash inchangé après libération puis profil relu. Ces tests ne diagnostiquent pas la machine distante.

**Résultats établis :** suite Maven `mvn.cmd -o -f Jbstock-backend/pom.xml package` : **46 tests réussis**, JAR reconstruit ; tests Node **12 réussis**. Test d'accès exclusif : **1 scénario réussi**, environ **43 s**, deux arrêts normaux et erreur de démarrage contrôlée entre les deux. `test:packaged` du nouveau `win-unpacked` : **1 scénario réussi**, environ **87 s**, quatre cycles, crash du main/récupération, processus/ports arrêtés et six dialogues natifs. Premier cycle NSIS fermé avant désinstallation : **1 scénario réussi**, environ **79 s**, SHA-256 base/langue/média inchangés après suppression et réinstallation, données relues et `quick_check=ok`/clés étrangères contrôlés. Identité de test désinstallée à la fin ; aucun package utilisateur remplacé. Test NSIS étendu à la désinstallation pendant ouverture : résultat final consigné ci-dessous. Les mesures de délai du runner sont indicatives et ne constituent pas un benchmark du second PC.

**Corrections des outils pendant validation :** première attente CDP trop précoce corrigée en attendant le document final avant mutation. Contexte Logback du nouveau test initialisé avec l'adaptateur MDC, comme les tests précédents. L'attribut Windows lecture seule n'a pas empêché l'ouverture pour lecture dans la fixture : hypothèse de test abandonnée, remplacée par un verrou exclusif déterministe. Helper PowerShell bloqué par la politique du compte sandbox, test exécuté hors bac à sable avec autorisation. Avec `_?=`, le désinstallateur de test en place se tuait lui-même lors de la fermeture des processus du dossier ; le runner le copie désormais hors installation, comme la relocalisation normale NSIS. Ces échecs étaient des erreurs de test, pas une reproduction de l'incident du second PC.

**Builds / limites :** NSIS principal reconstruit sans l'installer, MSIX non signé `0.0.1.2` reconstruit, installation MSIX `0.0.1.1` inchangée. Assemblage MSIX sandbox réussi en staging mais finalisation bloquée ; seul son helper identifié a été arrêté, puis build relancé hors bac à sable avec autorisation. Contrôle MSIX initial lancé trop tôt sur l'ancien artefact : refus du JAR périmé, sans conclusion applicative ; revérification après fin du build nécessaire et consignée ci-dessous. Frontend/runtime et traductions inchangés, builds réutilisés. Guides desktop, contrat, fiche Windows et suivi actualisés. Pas de correction de performance, réparation de la base distante, nouvelle validation Windows vierge/MSIX installée, commit ou publication. Fondation desktop et incident distant restent ouverts.

**Prochaine action :** conserver ces tests pour toute évolution desktop. Lorsque la machine concernée sera accessible, lire les journaux et vérifier accès/intégrité sur une copie après arrêt complet, avant toute décision de récupération. Continuer uniquement les validations desktop et le diagnostic de performance ; aucun module métier nouveau.

**Résultats finaux et artefacts :** test NSIS étendu **réussi en environ 136 s** : quatre lancements, désinstallation à application fermée puis ouverte, réinstallation dans les deux cas, données/langue retrouvées, média conservé, intégrité SQLite correcte. Identité de test désinstallée et profil temporaire supprimé après réussite. Cette fixture NSIS a été construite avant les ajouts de diagnostics Java, avec le même code de stockage/datasource antérieur ; elle reproduit le comportement de conservation du package initial. Le nouveau JAR avec diagnostics est validé par Maven, le test d'accès exclusif et le nouveau main empaqueté. Pas de preuve de correction de l'incident distant. Vérification MSIX après fin du build : **413 fichiers identiques**. NSIS courant **247 338 471 octets**, SHA-256 `83C79DFB05294B74F5F9956F1F6029D29A952A083D6F26312B26F1CDB77FAC0A`. MSIX courant **296 394 365 octets**, SHA-256 `C750B4034318BF226FE92A455429AFB2501AF6736AA9D05128F6A90DA056A6DD`. Fiche de transfert et guide MSIX mis à jour ; les empreintes historiques restent dans le journal. Aucun installateur principal exécuté dans cette session. Syntaxe Node/PowerShell des helpers et contrôles Git/espaces de fin de ligne effectués.

Références : [NSIS — commandes de désinstallation et relocalisation](https://nsis.sourceforge.io/Docs/Chapter3.html), [options NSIS electron-builder](https://www.electron.build/docs/nsis/).

### 2026-10-08 — Stabilisation locale : reprise SQLite et budget JVM

**Demande et reprise :** l'utilisateur autorise l'étape suivante après l'explication de la priorité desktop. Spécification et sections 100/103, architecture incluant Spring Data JPA, suivi, statut Git et code ciblé confrontés. Toutes les modifications/suppressions préexistantes conservées ; aucune installation principale ni donnée commerciale ciblée. Aucun nouveau module métier ouvert.

**Changements :** `SqliteDataSourceConfiguration.java` retente uniquement l'ouverture du même fichier sur BUSY/LOCKED/CANTOPEN, trois tentatives au maximum, attentes 250/500 ms. `SqliteFailure.java` classe les erreurs potentiellement transitoires ; `SafeLogEncoder.java` autorise `DATABASE_OPEN_RETRY` pour le logger fixe. Les délais propres SQLite/Hikari s'ajoutent, sans garantie de démarrage en 750 ms. Corruption, NOTADB, lecture seule et autres causes ne sont pas reprises. Aucun reset, remplacement, changement de chemin ou repair Flyway. `StartupFailureTests.java` vérifie qu'une base invalide reste intacte et ne déclenche pas de reprise ; `TechnicalLogTests.java` vérifie la classification.

**Réglages Java :** `desktop/src/backend.cjs` applique `-Xms32m -Xmx512m` et `-XX:ActiveProcessorCount` au plus 2 (1 si seul disponible). GC par défaut, Spring/JPA, pipes, `windowsHide`, détachement Windows et suivi sans `unref` conservés. Ce budget dimensionne les pools internes ; il ne limite pas le CPU Windows ni toute la mémoire Java/Electron. `packaged-processes.ps1` contrôle les arguments réels du Java enfant sans exposer la ligne de commande ou le secret.

**Mesure reproductible :** ajout de `desktop/scripts/measure-startup.cjs`, `measure-java.ps1` et `measure:startup`. Runtime embarqué, copie unique du JAR, profils fictifs, santé et GET/PUT Entreprise protégés, arrêt privé et `LOGGING_STOPPED`. Comparaison finale : deux démarrages par configuration, base neuve puis réutilisée, ordre inversé au second tour, sans build concurrent. Machine locale : 16 processeurs logiques, 16 GiB RAM ; JAR copié SHA-256 `b5d826d16ba377587086ee18254b04a5a29443544f215ebe3e5f7d908e33e475`. Rapport `desktop/release/startup-validation/comparison.json` (ignoré par Git).

| Mesure Java locale | JVM par défaut | Budget retenu |
| --- | --- | --- |
| Santé + lecture Entreprise, moyenne | 10 382 ms | 7 398 ms |
| Pic working set, moyenne | environ 394 MiB | environ 294 MiB |
| Temps CPU observé, moyenne | 33 945 ms | 16 898 ms |
| Pic de threads échantillonné, moyenne | 61 | 41 |

**Limites des mesures :** deux échantillons seulement ; mémoire/CPU relevés sur le cycle Java jusqu'à l'arrêt, threads et mémoire privée échantillonnés toutes les 50 ms avec overhead de supervision. Ce n'est pas une mesure d'Electron, de l'installateur, d'une future charge métier ou du PC de l'utilisateur. Premier benchmark exploratoire (six lancements, variante Serial GC non retenue et chevauchement d'un build en fin de série) conservé dans `initial-comparison.json` ; seul le comparatif final sur snapshot identique fonde les chiffres ci-dessus. Les améliorations locales ne démontrent pas la résolution du ralentissement général distant. Référence : [options Java 21](https://docs.oracle.com/en/java/javase/21/docs/specs/man/java.html).

**Validations exécutées :** `mvn.cmd -o -f Jbstock-backend/pom.xml '-Dtest=TechnicalLogTests,StartupFailureTests' package` : 8 tests ciblés réussis ; puis `mvn.cmd -o -f Jbstock-backend/pom.xml package` : **46 tests réussis**, JAR final construit. `npm.cmd --prefix desktop test` : **12 tests réussis**. `npm.cmd --prefix desktop run test:database-access` : **2 scénarios Windows réussis**, environ 46 s ; refus après exactement deux reprises sous verrou persistant avec hash conservé, et démarrage sur la même base après libération du verrou temporaire. Fixtures isolées et nettoyées. Syntaxe Node/PowerShell des nouveaux outils et `git diff --check` contrôlés.

**Exécutable final :** `npm.cmd --prefix desktop run build:windows:nsis` réussi, sans installation. `npm.cmd --prefix desktop run test:packaged` : **1 scénario réussi en environ 77 s**, quatre cycles dont crash du main/récupération, langue/données conservées, quatre `LOGGING_STOPPED`, aucun processus/port résiduel, six dialogues natifs anglais/arabe. Arguments JVM contrôlés sur les quatre Java réels : heap 32/512 MiB, processeurs déclarés 2. Rapports dans `release/packaged-validation/`. NSIS : **247 339 643 octets**, SHA-256 `54D14F3C28CFDF71432C9DEDF324AD6C8B532708E51BC0DB618E372A69CC8B18`.

**Finalisation MSIX :** malgré l'exécution autorisée hors sandbox, MakeAppx a terminé mais `Move-Item -Force` est resté bloqué avant remplacement de l'ancien artefact. Seul le helper de ce build, identifié par PID et ligne de commande, a été arrêté ; aucun processus applicatif ciblé. `desktop/scripts/build-msix.ps1` finalise désormais avec `System.IO.File.Replace` et sauvegarde temporaire dans le staging unique (ou `File.Move` si l'artefact est absent). Première variante avec backup `$null` refusée par Windows PowerShell, qui le convertit en chemin vide ; remplacée par un vrai chemin de staging. Ancien artefact resté intact sur ces échecs. Résultat final du rebuild et contrôle MSIX consignés ci-dessous ; installation existante `0.0.1.1` inchangée.

**Documentation et périmètre :** contrat backend, README desktop, fiche Windows, guide MSIX, instructions de reprise et suivi actualisés. Frontend/runtime et traductions inchangés, réutilisés. L'essai NSIS de conservation réalisé à l'étape précédente reste valable dans son périmètre ; il n'est pas rejoué ici, et sa fixture doit être reconstruite avant un nouvel essai sur ce lanceur. Aucune nouvelle preuve de réinstallation sur le PC distant.

**MSIX final :** `npm.cmd --prefix desktop run build:windows:msix:test -- -TestRevision 2` terminé avec succès après correction de finalisation. `npm.cmd --prefix desktop run test:msix -- -PackagePath release/JBStock.Development-0.0.1.2-x64.msix -ExpectedVersion 0.0.1.2` réussi : identité, entry point, capacité, assets, block map et **413 fichiers identiques par SHA-256**. Artefact non signé : **296 396 296 octets**, SHA-256 `6F86AAAB847A932A69D12036761F2DB41C21C2A67779FEDD1B15A667161F97C9`. Empreintes de transfert remplacées, historique conservé. La branche même volume de la finalisation est vérifiée par ce build ; compatibilité d'un `OutputDirectory` sur autre volume conservée par `File.Copy` non atomique, sans essai sur un autre disque. Aucun test d'installation/mise à jour de ce MSIX, aucune signature/publication ni installation principale effectuée.

**Prochaine action concrète :** poursuivre les critères desktop restant vérifiables localement, notamment le comportement mono-instance du main empaqueté, puis préparer séparément la recette MSIX. Lorsque le second PC sera accessible, diagnostic en lecture sur ses journaux et copie de base avant récupération, et recette/performance du nouveau package. Incident distant et fondation desktop globale restent ouverts ; ne pas déclarer terminée la recette Windows vierge ni commencer les modules métier.

### 2026-10-08 — Validation mono-instance du main empaqueté

**Reprise :** spécification (100/103), suivi, statut Git et code main/shell/langue confrontés. Verrou `requestSingleInstanceLock` et traitement `second-instance` déjà présents ; pas de correction applicative nécessaire démontrée. Modifications/suppressions préexistantes préservées. L'ancien suivi mentionnait un contrôle mono-instance local ; cette étape complète sa couverture sur le package courant au démarrage et avec fenêtre réduite/brouillon.

**Fichiers :** extension de `desktop/test/packaged.integration.cjs` ; ajout de `desktop/test/packaged-window.ps1`. Le premier second lancement intervient après `LOGGING_READY` et avant `BACKEND_READY`. Le second intervient après enregistrement Entreprise, passage en arabe et saisie d'un brouillon, puis réduction de la fenêtre. Les deux copies doivent sortir en code 0 avec le marqueur de refus du verrou ; leurs ports CDP restent fermés. Helper Win32 limité au PID de la copie isolée : une fenêtre visible, réduction vérifiée, restauration et premier plan du même handle. Un seul Java enfant sur le même port, un seul démarrage dans le journal, données, brouillon et langue conservés. Profils temporaires et données fictives uniquement. Rapports `single-instance.json`, `single-instance-language-trace.json` et `summary.json` dans `desktop/release/packaged-validation/`.

**Essais et écarts :** première tentative interrompue par le contrôle de fenêtre visible avec l'ancien `windowsHide` du runner. Le cycle concerné est désormais lancé explicitement visible, avec attente bornée de fenêtre ; les autres scénarios gardent leurs options antérieures. Deuxième essai : restauration, même backend et brouillon réussis, mais langue passée à l'anglais ; cause non établie, aucune correction frontend déduite de cette seule observation. Traces ajoutées aux étapes avant/après brouillon, réduction et second lancement : langue/direction, sélecteur, préférence persistée et événements de changement (dont `isTrusted`). Premier essai instrumenté complet **réussi**, environ **74 s**, arabe conservé à toutes les étapes et aucun événement de changement parasite relevé. Nouveau passage exécuté pour évaluer la reproductibilité ; résultat final consigné ci-dessous. Ce journal conserve l'échec intermittent au lieu de prétendre l'avoir corrigé.

**Périmètre :** code applicatif, migrations, traductions, JAR, frontend et packages inchangés ; aucune reconstruction nécessaire pour ces fichiers de test hors payload. Empreintes NSIS/MSIX de l'entrée précédente inchangées ; aucune installation principale/signature/publication. Les tests de crash/récupération, quatre arrêts Java et six dialogues natifs restent dans le scénario complet. Syntaxe Node/PowerShell et documentation contrôlées. README, fiche Windows, reprise et suivi actualisés.

**Résultat final :** `npm.cmd --prefix desktop run test:packaged` instrumenté **réussi deux fois**, environ **74 s puis 68 s**. Sur chaque passage : deux copies secondaires refusées, leurs ports CDP fermés, une seule fenêtre restaurée au premier plan, même Java/port, brouillon/langue/données conservés ; quatre cycles, crash/récupération, quatre arrêts propres `LOGGING_STOPPED`, absence de processus/ports résiduels et six dialogues anglais/arabe réussis. Premier rapport/trace réussis copiés dans `summary-first-pass.json` et `single-instance-language-trace-first-pass.json`, second passage dans les fichiers courants. Syntaxe Node/PowerShell et espaces de fin de ligne vérifiés, `git diff --check` réussi (avertissements CRLF de fichiers préexistants uniquement). Aucun test Maven ou rebuild réexécuté pour cette étape de tests desktop.

**Limites / prochaine action :** fondation globale et recette Windows vierge toujours partielles ; ni mono-instance sous identité MSIX ni cas entre comptes Windows distincts testés. L'alerte SQLite et le ralentissement sur le second PC restent sans diagnostic confirmé. Poursuivre la validation desktop des alertes après perte du backend Java, en anglais/arabe et sur données fictives ; conserver les traces de langue et rechercher toute reproduction du retour inattendu à l'anglais. Préparer la recette MSIX séparée sans remplacer l'installation existante. Aucun nouveau module métier.

Références : [verrou mono-instance Electron](https://www.electronjs.org/docs/latest/api/app#apprequestsingleinstancelockadditionaldata), [état réduit d'une fenêtre Win32](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-isiconic).

### 2026-10-08 — Perte Java : alertes natives et récupération dans les deux langues

**Reprise / périmètre :** spécification 100/103, suivi, statut Git, `main.cjs`, `backend.cjs`, tests empaquetés et helper natif confrontés. Le code applicatif existant traite déjà `unexpected-exit` avec le message centralisé `BACKEND_EXITED`, puis fermeture après validation. Modifications préexistantes conservées. Aucun code applicatif, schéma, traduction, build frontend/JAR ou installation modifié ; packages et empreintes de la stabilisation JVM inchangés.

**Implémentation du test :** `desktop/test/packaged.integration.cjs` mutualise l'invocation du helper de dialogue, conserve tous les scénarios précédents et ajoute quatre cycles : crash Java puis relance, pour `en` puis `ar`. Préférence préparée dans la fixture avant chaque langue ; profil Entreprise déjà enregistré, affichage et données contrôlés. `packaged-processes.ps1` ajoute `terminate-java` et `no-java`. Avant terminaison : chemin exact du runtime dans une racine `jbstock-packaged-*`, PID parent, un seul Java, arguments JVM et listener loopback vérifiés. Seul ce Java de test est terminé ; aucun arbre, Java installé ou processus utilisateur ciblé. Contrôle sans Java et main toujours présent pendant l'alerte, puis message/action lus et capture enregistrée avant fermeture. PID/processus et ports doivent disparaître. Pas de redémarrage automatique Java observé au contrôle.

**Arrêts / données :** le Java tué ne doit pas ajouter de `LOGGING_STOPPED`, contrairement au Java de récupération fermé normalement. Langue et profil précédemment enregistrés retrouvés en anglais/arabe après relance. Après fermeture, ouverture SQLite Node `DatabaseSync` en lecture seule : `PRAGMA quick_check` retourne `ok`, `foreign_key_check` ne retourne aucune violation. La relance peut normalement traiter WAL ; le test ne demande pas un hash identique au fichier principal après crash/reprise. Il ne couvre ni écriture interrompue, ni toutes les erreurs matérielles, ni coupure électrique.

**Validation :** `npm.cmd --prefix desktop run test:packaged` **réussi**, 1 scénario complet, environ **124 s**. Huit lancements avec Java : quatre cycles initiaux (dont crash main/récupération), deux crashes Java et deux récupérations. **Six arrêts Java gracieux**, deux terminaisons forcées explicitement attendues, **huit dialogues** (six ressources manquantes et deux pertes Java), mono-instance/brouillon, persistance, processus/ports et intégrité réussis. Rapports `release/packaged-validation/summary.json`, `java-crash-en.json`, `java-crash-ar.json`. Captures `BACKEND_EXITED-en.png` et `BACKEND_EXITED-ar.png` inspectées : messages et boutons lisibles, arabe avec fragments latins cohérents. Trace mono-instance de ce passage : arabe conservé, aucun événement parasite ; l'échec anglais antérieur reste inexpliqué. Avertissement expérimental Node SQLite attendu, déjà utilisé par le test NSIS. Syntaxe Node/PowerShell et contrôles d'espaces/Git effectués. Un essai statique a identifié l'incompatibilité PowerShell de `Split-Path -LiteralPath -Parent` ; gardes de chemin remplacées par les méthodes `System.IO.Path` avant exécution du test.

**Documentation / limites :** README desktop, suivi et reprise actualisés. Pas de rebuild, de suite Maven inutile, de signature, de commit/publication ou de remplacement de l'installation MSIX `0.0.1.1`. La recette Windows vierge et l'exécution sous identité MSIX restent distinctes et partielles. L'alerte SQLite après réinstallation et le ralentissement sur le second PC restent sans cause établie ; ce test de perte Java ne les diagnostique pas.

**Prochaine action concrète :** vérifier les dialogues natifs `DATABASE_ERROR` au démarrage dans les deux langues avec une base de fixture verrouillée, fichier préservé et données retrouvées après libération. Réutiliser le helper de verrou existant, sans toucher aux données utilisateur. Puis préparer séparément la recette MSIX et compléter la recette externe quand le PC sera accessible. Aucun nouveau module métier avant validation desktop.

### 2026-10-08 — Point d'arrêt demandé : commits et push

**Demande utilisateur :** enregistrer le travail par commits et pousser, puis arrêter à ce point. Aucun nouveau développement ou test applicatif entrepris. Statut Git et liste des fichiers suivis/non suivis examinés ; tous les changements existants sont conservés, y compris les suppressions préexistantes de `docs/CURRENT_PHASE.md` et `docs/DECISIONS.md`, remplacés dans le suivi actuel par ce journal de reprise. Regroupement prévu : backend local/Entreprise/diagnostics, desktop/frontend multilingue et outils, puis documentation/reprise. Branche `main`, dépôt `origin` : `mouhssine07/JBStock`.

**Périmètre Git :** sources, migrations, tests, lockfile desktop, scripts et documentation. Les packages, runtimes téléchargés, captures, rapports, certificats et profils de test sous `release`, `.build`, `.tools`, `target` et autres sorties ignorées restent locaux. Aucun fichier de base commerciale ou clé privée repéré dans les fichiers candidats. Les empreintes des packages restent celles documentées ; leur envoi comme release GitHub n'est pas demandé.

**Commits de code créés :** `e160fd5` — backend local, API Entreprise et lifecycle ; `1a368e0` — shell anglais/arabe, packaging et validations Windows. Le présent point d'arrêt accompagne le commit documentaire séparé. Contrôles `git diff --cached --check` réussis avant les commits ; résultat du push communiqué en fin de session et vérifiable sur `origin/main`.

**État au point d'arrêt :** dernier scénario empaqueté réussi en environ 124 s : huit lancements avec backend, huit dialogues natifs, deux terminaisons Java attendues et six arrêts propres, mono-instance, récupération et intégrité SQLite vérifiées localement. Résultats Maven/Node et benchmarks précédents conservés, sans relance inutile pour un commit. Fondation globale et recette Windows vierge/MSIX restent partielles ; incident SQLite/performance du second PC et retour à l'anglais isolé restent sans diagnostic confirmé.

**Reprise uniquement à la demande de l'utilisateur :** prochaine action technique inchangée : dialogues `DATABASE_ERROR` avec fixture SQLite verrouillée dans les deux langues, fichiers préservés et récupération après libération. Puis validations MSIX/externes distinctes. Ne pas ouvrir de nouveau module métier ni intervenir sur l'installation existante pendant cet arrêt.

### Modèle à ajouter pour chaque prochaine session

```text
Date :
Étape :
État trouvé / modifications préexistantes :
Travail réalisé et fichiers concernés :
Décisions et sections de référence :
Migrations / impact données :
Tests exécutés et résultats :
Limites ou blocages :
Prochaine action concrète :
```
