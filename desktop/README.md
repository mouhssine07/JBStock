# JBStock Desktop — prototype et packaging Windows

Electron charge le build React local, lance le JAR Java sur un port loopback attribué par le système et garde le secret de session dans son processus principal. Le preload expose `getCompany`, `saveCompany`, `getLanguage` et `setLanguage` ; les deux dernières méthodes acceptent seulement `en`/`ar`. Aucun proxy Vite n'est utilisé dans la fenêtre desktop.

## Lancer sous Windows

Prérequis de développement : Node/npm, Java 21 et Maven. Depuis la racine du dépôt :

```powershell
mvn.cmd -f Jbstock-backend/pom.xml package
npm.cmd --prefix Jbstock-frontend ci
npm.cmd --prefix Jbstock-frontend run build
npm.cmd --prefix desktop ci
npm.cmd --prefix desktop start
```

Les constructions sont à refaire lorsque le code ou les dépendances changent. Les builds `win-unpacked`, NSIS et MSIX `0.0.1.2` du 08/10/2026 contiennent le multilingue ; l'installation MSIX `0.0.1.1` du 07/10 reste inchangée. `npm.cmd --prefix desktop start` utilise les sources desktop et le build frontend local.

Electron est fixé par package-lock.json. Son binaire peut être téléchargé à la première exécution. Le Java de développement est choisi via JAVA_HOME, sinon via le PATH. Les versions installées ne sont pas une exigence pour les clients finaux : le runtime sera embarqué à l'étape 2.2.

**Données de ce prototype :** `Jbstock-backend/target/desktop-dev/data/jbstock.db`, avec médias et logs dans la même racine `desktop-dev`. Cette base est distincte de celle du lanceur navigateur `scripts/dev.mjs` et des données utilisateur Windows. Elle peut être supprimée par `mvn clean` ; utiliser uniquement des données fictives.

## Construire un package Windows autonome

Le build inclut l'interface, `Jbstock-backend.jar` et un runtime Java 21 réduit. Il ne demande donc ni Java ni Node sur le PC client. Sur le poste de build, `prepare:jdk` télécharge Microsoft Build of OpenJDK 21 x64, compare le SHA-256 officiel et décompresse la version épinglée 21.0.12.1 :

```powershell
npm.cmd --prefix Jbstock-frontend ci
npm.cmd --prefix Jbstock-frontend run build
mvn.cmd -DskipTests -f Jbstock-backend/pom.xml package
npm.cmd --prefix desktop ci
npm.cmd --prefix desktop run prepare:jdk
npm.cmd --prefix desktop run build:runtime
npm.cmd --prefix desktop run build:windows:dir
npm.cmd --prefix desktop run build:windows:nsis
```

Le runtime est produit dans `desktop/.build/runtime`. Les sorties sont `desktop/release/win-unpacked` et `desktop/release/JBStock-0.0.1-setup.exe`. Le JDK est téléchargé depuis Microsoft et sa licence GPLv2 avec Classpath Exception ainsi que les fichiers légaux générés sont conservés dans le runtime. Les dossiers `.tools`, `.build` et `release` sont des artefacts locaux ignorés par Git.

Ce package de développement n'est pas encore une soumission Store : il n'a pas d'identité Partner Center ni de fichier `.msixupload`. L'installateur NSIS sert à valider l'assemblage desktop. Un premier MSIX non signé avec identité de test peut également être produit avec `npm.cmd --prefix desktop run build:windows:msix:test`, puis vérifié avec `npm.cmd --prefix desktop run test:msix`. Voir [la préparation MSIX](../docs/PACKAGING_MSIX.md) pour les prérequis, l'identité officielle et les validations restantes.

En mode empaqueté, Electron stocke son profil Chromium dans `%LOCALAPPDATA%\JBStock\electron-profile`. Les données commerciales backend restent séparées sous `%LOCALAPPDATA%\JBStock\data`.

Sous MSIX, Windows redirige ces chemins : stockage physique observé sous `%LOCALAPPDATA%\Packages\JBStock.Development_yrahyscxc0a2p\LocalCache\Local\JBStock`. L'installation et la mise à jour locale `0.0.1.0 → 0.0.1.1` conservent le profil après redémarrage. Les scripts de signature, activation et validation MSIX sont décrits dans [le guide MSIX](../docs/PACKAGING_MSIX.md).

Fermer la fenêtre déclenche une commande privée `JBSTOCK_SHUTDOWN` sur stdin du processus Java enfant. Electron attend sa sortie, puis applique un arrêt forcé si nécessaire après 30 secondes. Le backend ferme son contexte Spring ; le timeout HTTP reste de 20 secondes par phase. Aucune sauvegarde de fermeture n'est encore implémentée.

## Validation

### Langues

Les catalogues uniques sont `desktop/src/locales/en.json` et `ar.json`, importés également par Vite. Ajouter chaque texte d'interface dans les deux fichiers. Les valeurs saisies et codes métier ne sont jamais traduits ; les erreurs sont localisées à l'affichage. `Jbstock-frontend/src/i18n.ts` centralise le changement de langue, la direction et les formats Intl (devise fournie par l'appelant).

Anglais au premier lancement. Préférence desktop : `userData/settings/language.json` dans le package, `Jbstock-backend/target/desktop-dev/config/language.json` dans le prototype. Elle est chargée avant Java pour les erreurs de démarrage, écrite via fichier temporaire puis renommage, et accessible uniquement par IPC validé. Un fichier illisible/invalide déclenche le repli anglais avec une alerte ; un échec d'écriture conserve la langue persistée. Le mode navigateur utilise séparément localStorage (`jbstock.language`). Cette préférence ne définit pas encore la langue des factures.

### Commandes

Depuis `desktop` après construction du backend et du frontend :

```powershell
npm.cmd test
npm.cmd run test:backend
npm.cmd run test:runtime
npm.cmd run test:electron
npm.cmd run test:i18n
npm.cmd run test:packaged
```

- Tests Node : superviseur, erreur de démarrage, timeout, authentification, crash, arrêt forcé, validation IPC et chemins d'assets.
- Test backend réel : deux processus Java successifs, profil conservé et arrêts non forcés sur une racine temporaire.
- Test runtime Windows : nécessite `release/win-unpacked`, copie son Java et son JAR dans un répertoire temporaire avec espaces et accents, limite le PATH à System32 et vérifie le stockage par défaut sous un LOCALAPPDATA isolé. Deux démarrages séparés par un déplacement des fichiers applicatifs conservent le profil Entreprise, ses identifiants fiscaux et un fichier média témoin ; les deux arrêts doivent être gracieux. Ce test ne lance pas Electron et ne simule ni une mise à jour de version ni une installation MSIX. Il n'est pas exécuté sur les autres systèmes.
- Test Electron : fenêtre masquée, formulaire réel, contrôle de l'absence de Node dans le renderer, validation IPC, écriture SQLite et arrêt Java. Capture dans `Jbstock-backend/target/desktop-smoke.png`.
- Test multilingue : deux processus Electron/Java avec profils temporaires ; anglais initial, arabe RTL, validations traduites, bascule sans perte du brouillon, sauvegarde puis relance avec langue et données conservées. HTTP(S) Chromium bloqué avant chargement et refus vérifié ; aucun changement réseau Windows. Captures `Jbstock-backend/target/desktop-i18n-first.png` (arabe) et `desktop-i18n-restart.png` (retour anglais). Réussi le 08/10/2026 ; captures inspectées. Les dialogues natifs et le main empaqueté sont couverts séparément par `test:packaged`.

Le test Electron requiert une session Windows graphique utilisable. Les tests ne ciblent pas une base commerciale. Les fichiers et processus temporaires sont nettoyés après exécution normale.

`test:packaged` nécessite `release/win-unpacked` à jour et une session Windows graphique. Il compare les sources desktop/catalogues du fichier ASAR, y compris `backend.cjs`, l'index frontend et le JAR au build courant, copie le package dans un dossier temporaire avec espaces/accents, puis lance son véritable main. Le processus applicatif reçoit un PATH limité à System32 et des profils isolés. Quatre cycles couvrent le premier lancement, la relance, l'arrêt brutal du seul main Electron et la récupération : langue/données conservées, un seul Java enfant, santé HTTP sur loopback, sortie de tous les processus de la copie, ports Java/diagnostic fermés et quatre fins de journal `LOGGING_STOPPED`. Six lancements supplémentaires retirent temporairement Java, le JAR ou l'index frontend de cette copie, dans les deux langues. Le helper `test/native-dialog.ps1` lit le message et l'action traduite via UI Automation, capture le dialogue puis active cette action. Quand Windows expose un panneau sans InvokePattern, le helper utilise `TDM_CLICK_BUTTON` avec l'identifiant du contrôle trouvé. La base de test doit rester identique par SHA-256 après chaque échec de ressource.

Quatre cycles complémentaires couvrent l'arrêt brutal de Java puis la récupération, séparément en anglais et arabe : huit dialogues natifs au total, huit lancements avec backend, six fins de journal propres. `test/packaged-processes.ps1` relève processus/port et, uniquement en mode `terminate-java`, termine le Java direct du main après vérification de son chemin exact dans une fixture `jbstock-packaged-*`, de sa filiation, de ses arguments et du listener local. Les modes de contrôle restent sans terminaison. Le test confirme l'absence de Java à l'instant du contrôle pendant l'alerte `BACKEND_EXITED`, puis la fermeture de la copie et de ses ports. Le Java tué ne doit pas ajouter de `LOGGING_STOPPED` ; celui de récupération doit le faire. Données déjà enregistrées et langue sont relues après relance ; `quick_check` et `foreign_key_check` sont exécutés en lecture seule après fermeture. Rapports `java-crash-en.json`/`java-crash-ar.json` et captures `BACKEND_EXITED-en.png`/`BACKEND_EXITED-ar.png`. Aucun arrêt n'intervient pendant une écriture métier ; ce test ne simule pas une coupure électrique.

Les preuves locales sont dans `release/packaged-validation/`. Le texte des dialogues arabes reçoit un encadrement Unicode RTL pour préserver l'ordre des fragments contenant Java/JBStock sur un Windows LTR ; le cadre et l'icône restent des éléments natifs Windows. Ce test ne lance pas l'installateur et ne coupe pas le réseau système. La procédure du second PC est dans [TEST_WINDOWS_VIERGE.md](../docs/TEST_WINDOWS_VIERGE.md).

Le scénario mono-instance lance une deuxième copie pendant l'initialisation Java puis une autre après réduction de la fenêtre, avec un brouillon non enregistré. Les copies secondaires doivent sortir sur refus du verrou, sans ouvrir leur port de diagnostic. `test/packaged-window.ps1` ne manipule que la fenêtre du PID main isolé : réduction contrôlée, puis vérification de la restauration au premier plan du même handle et d'une seule fenêtre visible. Le Java et son port doivent rester identiques ; données enregistrées, brouillon et langue doivent rester présents. Rapport : `release/packaged-validation/single-instance.json`. La session Windows doit permettre l'affichage et le premier plan ; ces contrôles ne remplacent pas un essai sous identité MSIX.

### Désinstallation/réinstallation et accès à la base

```powershell
npm.cmd --prefix desktop run build:windows:nsis:validation
npm.cmd --prefix desktop run test:nsis
npm.cmd --prefix desktop run test:database-access
```

`test:nsis` installe uniquement **JBStockLifecycleTest**, identité `com.jbstock.validation.lifecycle`, dans un dossier temporaire et avec un profil fictif. Ce produit a un exécutable distinct ; aucune installation JBStock habituelle n'est remplacée. Le test vérifie la conservation par SHA-256 de la base, de la préférence et d'un média après désinstallation normale, la lecture des données après réinstallation et l'intégrité SQLite. Il couvre aussi la désinstallation pendant que l'application est ouverte, suivie de réinstallation/récupération. Il supprime l'installation de test et conserve le profil de test en cas d'échec. Rapport : `release/nsis-lifecycle/validation.json`. Ces actions touchent les entrées Windows de la seule identité de test et nécessitent l'autorisation d'exécution hors bac à sable.

`test:database-access` utilise le runtime embarqué et le JAR backend courant dans des profils temporaires : un helper PowerShell tient la base en accès exclusif, sans écrire ni changer ses permissions. Un verrou persistant doit provoquer deux `DATABASE_OPEN_RETRY`, puis le refus `SQLITE_CANTOPEN` ; le fichier reste identique, puis les données sont retrouvées après libération du verrou. Un second scénario libère le verrou après le premier événement de reprise et vérifie le démarrage réussi sur les données existantes. Ces scénarios ne prouvent pas la cause d'une erreur sur une autre machine.

### Mesure du démarrage Java

`npm.cmd --prefix desktop run measure:startup` compare les réglages JVM par défaut avec `-Xms32m -Xmx512m -XX:ActiveProcessorCount=2`, deux démarrages chacun dans un ordre alterné, sur une copie unique du JAR courant. Le runtime vient de `release/win-unpacked`. Le benchmark utilise uniquement ses profils temporaires, contrôle la santé, la lecture/écriture Entreprise et l'arrêt propre. `scripts/measure-java.ps1` relève CPU, mémoire et threads du PID Java concerné ; rapport dans `release/startup-validation/comparison.json`. Éviter les builds ou autres charges simultanés pour comparer les résultats. Deux échantillons par configuration donnent une indication locale, pas une mesure représentative de tous les PC. Electron, installation et PC de l'utilisateur ne sont pas mesurés.

Le lanceur desktop applique maintenant ce budget de heap et au plus deux processeurs pour les pools internes JVM (un si un seul est disponible), en conservant le GC par défaut. Le plafond de heap n'est pas un plafond de mémoire totale et le nombre de processeurs déclaré n'est pas un quota CPU Windows. `test:packaged` contrôle ces arguments sur le Java réellement lancé, ainsi que les arrêts normaux et après crash.

La base NSIS se trouve normalement sous `%LOCALAPPDATA%\JBStock\data\jbstock.db`, hors du dossier d'installation. Une alerte d'ouverture ne justifie pas de supprimer ou remplacer cette base. Les sauvegardes/restaurations automatiques restent à réaliser ; la conservation après désinstallation n'est pas une sauvegarde. Le test NSIS ne valide pas la conservation après désinstallation MSIX.

## Sécurité et limites

- `contextIsolation=true`, `nodeIntegration=false`, `sandbox=true`, `webSecurity=true`.
- Origine locale `jbstock://app`, CSP restrictive, permissions refusées, nouvelles fenêtres/navigation/webviews/téléchargements interdits.
- Émetteur IPC limité à la frame principale de la fenêtre ; aucune fonction HTTP générique ni secret exposé au renderer.
- Validation des champs côté Electron, puis validation métier côté Spring ; les comptes et rôles restent à réaliser.
- Délai de 90 secondes pour le signal READY ; contrôles santé et accès authentifié ensuite (15 secondes maximum chacun).
- Les codes de démarrage donnent des messages explicites ; un crash ultérieur demande de relancer l'application, sans redémarrage automatique sur les données.
- Le runtime Java, NSIS et MSIX sont assemblés. Les copies MSIX 0.0.1.0/0.0.1.1 sont signées et leur installation/mise à jour ont été vérifiées localement ; le nouveau MSIX 0.0.1.2 reste non signé. Les erreurs de ressources du package sont vérifiées en anglais/arabe. Windows vierge, premier lancement sans réseau système et soumission Store restent à valider. Aucune signature de production.

Voir [suivi](../docs/SUIVI_PROJET.md) et [contrat backend](../docs/CONTRAT_BACKEND_DESKTOP.md).
