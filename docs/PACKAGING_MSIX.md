# JBStock — préparation MSIX

Le premier MSIX de développement est assemblé avec le SDK Windows à partir du build Electron `desktop/release/win-unpacked`. Il contient Electron, le frontend, le JAR et Java embarqué. Cette étape ne compile pas ces composants : reconstruire `win-unpacked` après toute modification de l'application.

**Build multilingue du 08/10/2026 :** nouvelle révision de test `desktop/release/JBStock.Development-0.0.1.2-x64.msix`, construite avec `npm.cmd --prefix desktop run build:windows:msix:test -- -TestRevision 2`. Vérifier avec `npm.cmd --prefix desktop run test:msix -- -PackagePath release/JBStock.Development-0.0.1.2-x64.msix -ExpectedVersion 0.0.1.2`. Cette révision est non signée et non installée ; les anciennes copies signées `0.0.1.0`/`0.0.1.1` et l'installation existante sont conservées. Les essais sur le second PC commenceront avec l'installateur NSIS selon [la procédure dédiée](TEST_WINDOWS_VIERGE.md), puis une validation MSIX séparée.

Révision `0.0.1.2` reconstruite avec la correction d'arrêt Java sur crash du main Electron, la reprise SQLite bornée et le budget JVM : **296 396 296 octets**, SHA-256 `6F86AAAB847A932A69D12036761F2DB41C21C2A67779FEDD1B15A667161F97C9`. Vérification d'assemblage réussie : **413 fichiers identiques par SHA-256** au `win-unpacked` testé. Ce scénario de crash est vérifié sur la copie isolée du package Electron ; il n'a pas été rejoué dans une installation sous identité MSIX. Les essais de désinstallation/réinstallation NSIS avec conservation de données concernent une identité de test distincte et ne valident pas la désinstallation MSIX.

La finalisation du script remplace l'ancien artefact avec `System.IO.File.Replace` sur le même volume, avec sauvegarde dans son staging unique jusqu'au nettoyage, ou `File.Move` si la destination est absente. Pour un `OutputDirectory` sur un autre volume, le remplacement utilise une copie non atomique ; ce cas n'a pas été rejoué localement. Aucun package n'est installé par le build.

## Construire et vérifier le package de test

Prérequis : les builds frontend/backend/runtime décrits dans [le guide desktop](../desktop/README.md), Node/npm sur le poste de build et un SDK Windows contenant `x64/makeappx.exe` (SDK 10.0.19041.0 utilisé ici).

Depuis la racine :

```powershell
npm.cmd --prefix desktop run build:windows:dir
npm.cmd --prefix desktop run build:windows:msix:test
npm.cmd --prefix desktop run test:msix
```

La sortie actuelle est `desktop/release/JBStock.Development-0.0.1.0-x64.msix`, accompagnée du manifeste XML. La version est dérivée de `desktop/package.json` en ajoutant une révision `.0`. Le script utilise `MakeAppx pack` avec sa validation active, puis calcule le SHA-256 du package. La commande de vérification contrôle le manifeste et compare chaque fichier applicatif au build source par SHA-256, sans installer l'application.

Le nom `JBStock.Development`, l'éditeur `CN=JBStock Development` et les trois logos géométriques sont réservés aux essais. Le build produit un package non signé ; la signature de test est une opération séparée. Le 07/10/2026, les révisions `0.0.1.0` et `0.0.1.1` ont été signées, installées successivement et testées sur le PC de développement, dans le compte habituel choisi explicitement par l'utilisateur. Cela ne constitue pas une validation Windows vierge ni une soumission Store.

## Signature et scénario de mise à jour local

Les scripts supplémentaires sont réservés à l'identité de développement :

- `build-msix.ps1 -TestIdentity -TestRevision 1 -OutputDirectory desktop/release/msix-validation` construit `0.0.1.1` sans modifier `package.json`. La révision non nulle est refusée pour une identité officielle.
- `create-msix-test-certificate.ps1` crée un certificat de signature de code valable 90 jours dans `CurrentUser/My`. La clé privée est non exportable ; seul le certificat public `.cer` est exporté. Le fichier local `release/msix-validation/certificate.json` conserve son empreinte et le compte de signature. Réutiliser ce certificat pour les deux versions.
- `sign-msix-test.ps1 -PackagePath <msix> -CertificateThumbprint <empreinte>` vérifie l'identité et l'usage du certificat puis produit une copie `-signed.msix`. Il ne modifie pas la confiance Windows.
- `trust-msix-test-certificate.ps1 -CertificatePath <cer> -ExpectedThumbprint <empreinte>` doit être exécuté en administrateur sur la machine choisie. Il contrôle le sujet, l'empreinte et la validité avant import dans `LocalMachine/TrustedPeople`.

Le certificat créé dans cette session porte l'empreinte `A347EB2E632FC7FF5EBAC1D6F27AFBF7FFAF3CC7`, expire le **05/01/2027** et reste approuvé sur le PC à la fin des essais. Aucun PFX ni clé privée n'est écrit dans le dépôt. Les artefacts et rapports sont sous `desktop/release/msix-validation/`, ignoré par Git. Les captures et profils de comparaison peuvent contenir des données renseignées par l'utilisateur : ils restent locaux et ne doivent pas être publiés.

Après signature et confiance explicite, installer avec `Add-AppxPackage -Path <msix-signé>`. Contrôler `Get-AppxPackage -Name JBStock.Development` et `signtool verify /pa <msix-signé>`.

Pour reproduire le cycle depuis la racine, dans le compte ayant installé le package :

```powershell
powershell.exe -NoProfile -File desktop/scripts/activate-msix-test.ps1 -DebugPort 9337
node desktop/test/msix-ui.cjs inspect 9337 desktop/release/msix-validation/baseline
powershell.exe -NoProfile -File desktop/scripts/stop-msix-test.ps1 -ReportPath desktop/release/msix-validation/before-update-lifecycle.json
# Créer une copie de sécurité des fichiers data seulement après l'arrêt confirmé.
Add-AppxPackage -Path desktop/release/msix-validation/JBStock.Development-0.0.1.1-x64-signed.msix
powershell.exe -NoProfile -File desktop/scripts/activate-msix-test.ps1 -DebugPort 9337
node desktop/test/msix-ui.cjs check 9337 desktop/release/msix-validation/after-update desktop/release/msix-validation/baseline.json
powershell.exe -NoProfile -File desktop/scripts/stop-msix-test.ps1 -ReportPath desktop/release/msix-validation/after-update-lifecycle.json
```

`activate-msix-test.ps1` lance l'identité installée via `IApplicationActivationManager` ; le diagnostic Chromium loopback n'est activé que pour ce lancement de test. `msix-ui.cjs` utilise le formulaire/preload réel, capture la fenêtre et compare le profil. Le mode `seed` est réservé à une entreprise entièrement vide ; il refuse d'écraser un profil renseigné. Le scénario de cette session a utilisé `inspect` puis `check` pour préserver le profil trouvé. Le mode `check` sans fichier baseline attend la fixture du mode `seed`.

`stop-msix-test.ps1` vérifie le Java du package, `/health`, la fenêtre unique, la sortie des processus et l'inaccessibilité TCP des ports relevés après fermeture normale. Il n'effectue aucun kill. Une anomalie locale de remontée de l'état TCP Windows impose de sélectionner les endpoints par processus et port distant nul, puis de confirmer par HTTP/TCP. Après arrêt, `node desktop/test/msix-db.cjs <chemin-db>` utilise `node:sqlite` en lecture seule pour contrôler intégrité, clés étrangères et migrations (Node disposant de ce module requis, uniquement pour le test).

**Résultat local :** installation `0.0.1.0`, seconde activation avec une seule fenêtre/un seul Java, mise à jour `0.0.1.1`, profil identique après mise à jour puis après redémarrage, arrêts gracieux et ports fermés. SQLite : `quick_check=ok`, aucune violation de clé étrangère, trois migrations. La mise à jour change la version du package mais pas le schéma ni le code métier.

**Chemin physique observé :** `%LOCALAPPDATA%\Packages\JBStock.Development_yrahyscxc0a2p\LocalCache\Local\JBStock\data\jbstock.db`. Windows virtualise le chemin logique `%LOCALAPPDATA%\JBStock`. Cette conservation après mise à jour ne prouve pas la conservation après désinstallation. Une copie de sécurité de `data`, effectuée application arrêtée avant mise à jour, reste dans le sous-dossier `backups/before-msix-update-20261007-213249` du stockage MSIX. Ce contrôle manuel ne remplace pas le futur service de sauvegarde.

Références techniques : [certificat de signature MSIX](https://learn.microsoft.com/en-us/windows/msix/package/create-certificate-package-signing), [activation d'une application installée](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-iapplicationactivationmanager-activateapplication).

## Renseigner l'identité officielle plus tard

Le propriétaire du projet a confirmé le 07/10/2026 que JBStock n'est pas encore réservé dans Partner Center. Après réservation, copier `desktop/msix/identity.example.json` dans un fichier de configuration et y renseigner les valeurs exactes de Partner Center : `name`, `publisher`, `publisherDisplayName` et le nom affiché `displayName`.

Préparer aussi les logos PNG définitifs : `StoreLogo.png` (50 × 50), `Square44x44Logo.png` (44 × 44), `Square150x150Logo.png` (150 × 150). Les valeurs d'exemple sont rejetées ; les logos temporaires ne sont générés qu'avec `-TestIdentity`.

```powershell
npm.cmd --prefix desktop run build:windows:msix -- -IdentityFile C:\chemin\identity.json -AssetsDirectory C:\chemin\logos
```

`-MakeAppxPath` permet de sélectionner explicitement un SDK. Le manifeste déclare une application Windows desktop x64, Windows 10 build 19041 minimum et la capacité `runFullTrust` nécessaire au processus Electron/Java. Ces déclarations ne prouvent pas la compatibilité sur toutes les versions de Windows.

## Validation restante

Contrôle local préalable reproductible : `npm.cmd --prefix desktop run test:runtime` utilise le Java et le JAR de `win-unpacked`, avec espaces/accents et PATH limité à System32. Il vérifie deux cycles gracieux, le chemin SQLite par défaut dans un profil temporaire et la conservation de données fictives après déplacement du dossier applicatif. Réussi le 07/10/2026 ; ce contrôle n'exerce pas l'identité MSIX, Electron ni une mise à jour de version.

- Rejouer l'installation/mise à jour MSIX sur une VM Windows vierge ; les contrôles locaux ci-dessus sont réussis.
- Tester premier démarrage offline, erreurs de ressources et mise à jour avec une vraie évolution de schéma protégée par sauvegarde. Le verrou mono-instance a été observé sur le package installé.
- Rejouer les tests sur une VM Windows vierge sans Java/Node. Windows Sandbox n'est pas disponible sur le poste inspecté.
- Renseigner l'identité Partner Center, ajouter les visuels définitifs, préparer le `.msixupload`, puis exécuter les validations de certification. Aucune publication n'a été effectuée.

Références : [composants MSIX pour une application desktop](https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-manual-conversion), [MakeAppx et ses limites pour le format upload](https://learn.microsoft.com/en-us/windows/msix/package/create-app-package-with-makeappx-tool). MakeAppx produit le `.msix` ; le `.msixupload` est une étape distincte.
