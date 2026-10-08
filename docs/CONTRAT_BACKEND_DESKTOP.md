# Contrat de lancement du backend pour Electron

État : prototype Windows empaqueté le 07/10/2026 avec runtime Microsoft OpenJDK 21, NSIS et MSIX de développement. Installation et mise à jour MSIX avec persistance et arrêts gracieux vérifiées localement ; Windows vierge et Store restent à valider. Voir le guide MSIX pour la virtualisation du stockage sous Packages/LocalCache.

## Lancement

Electron lance directement Java avec le JAR, sans shell intermédiaire. En développement, il utilise le Java local ; en package Windows, il utilise `resources/runtime/bin/java.exe`, sans dépendre du PATH client.

```text
<runtime>/bin/java.exe -Xms32m -Xmx512m -XX:ActiveProcessorCount=2 -jar <application>/Jbstock-backend.jar --server.address=127.0.0.1 --server.port=0
```

Le port 0 laisse le système choisir un port disponible. Le backend annonce le port effectivement ouvert après initialisation complète. Une valeur explicite reste possible en développement.

Le lanceur desktop réserve initialement 32 MiB de heap et plafonne le heap Java à 512 MiB. `ActiveProcessorCount` vaut au plus 2 (1 si un seul processeur est disponible) pour dimensionner les pools internes JVM. Il ne constitue pas un quota CPU Windows ; le heap ne représente pas toute la mémoire Java, et Electron utilise une mémoire distincte. Le collecteur par défaut est conservé. Ces réglages ont été comparés sur le socle Entreprise local, pas sur de futurs volumes métier. Référence : [options Java 21](https://docs.oracle.com/en/java/javase/21/docs/specs/man/java.html).

À l'initialisation de la datasource seulement, `SQLITE_BUSY` (y compris LOCKED) et `SQLITE_CANTOPEN` autorisent au maximum trois tentatives sur le même fichier : attente de 250 ms puis 500 ms entre les tentatives. Les délais internes SQLite/Hikari s'y ajoutent ; 750 ms n'est pas une limite globale de démarrage. `DATABASE_OPEN_RETRY` indique chaque nouvelle tentative dans le journal filtré. Corruption, fichier non SQLite, lecture seule et autres erreurs ne déclenchent pas cette reprise. Un verrou persistant aboutit au refus existant ; aucun fichier n'est remplacé et aucune base de secours n'est créée. Une erreur CANTOPEN peut aussi être permanente : cette reprise bornée ne prouve pas sa cause.

Variables d'environnement à transmettre au seul processus enfant :

| Variable | Usage |
| --- | --- |
| `JBSTOCK_HOME` | Racine absolue explicitement transmise en développement/tests ; le package la supprime de l'environnement hérité pour utiliser `%LOCALAPPDATA%/JBStock` et rechercher l'ancienne base. |
| `JBSTOCK_DATABASE_PATH` | Facultatif : fichier existant à conserver. Ne pas changer silencieusement de chemin. |
| `JBSTOCK_LOCAL_SESSION_TOKEN` | Obligatoire : 32 octets aléatoires, encodés en 64 caractères hexadécimaux minuscules ; nouveau secret par lancement. |

Ne pas placer le secret dans les arguments, le bundle React, les logs ou un fichier de configuration. Le processus principal Electron garde le token et ajoute l'en-tête aux appels HTTP ; le preload expose deux fonctions Entreprise et deux fonctions de préférence de langue (`getLanguage`/`setLanguage`, `en`/`ar` seulement). La langue est conservée côté Electron pour traduire les erreurs avant le démarrage de Java ; aucun changement du contrat backend. Les surcharges avancées et la compatibilité des anciens chemins sont décrites dans `SUIVI_PROJET.md`.

## Signaux et santé

Après migrations et initialisation, stdout contient une ligne exactement au format :

```text
JBSTOCK_READY <port>
```

Electron devra isoler cette ligne parmi les autres sorties, valider que le port est un entier de 1 à 65535, puis vérifier GET `http://127.0.0.1:<port>/health`. Cette sonde est publique et ne contient pas de données métier. Les routes applicatives exigent `X-JBStock-Local-Token`.

Le futur lanceur doit imposer un délai de démarrage et observer la sortie prématurée du processus. Une réponse de santé seule ne prouve pas l'identité du backend ; vérifier aussi un appel avec le secret de ce lancement. Aucun événement READY n'est émis après un échec de démarrage.

En cas d'échec, stderr reçoit :

```text
JBSTOCK_STARTUP_FAILED <code>
```

| Code | Interprétation et conduite du lanceur |
| --- | --- |
| `STORAGE_ERROR` | Erreur d'accès/création des fichiers. Signaler le problème de stockage ; ne pas choisir automatiquement une autre base. |
| `DATABASE_ERROR` | Échec SQLite hors migration : base illisible, invalide ou inaccessible. Préserver les fichiers. |
| `MIGRATION_ERROR` | Validation/application Flyway échouée. Préserver la base ; ne pas exécuter automatiquement repair/clean. |
| `STARTUP_ERROR` | Autre erreur de configuration/démarrage, dont secret invalide ou sélection ambiguë d'un ancien chemin. |

Ces catégories ne constituent pas un diagnostic exhaustif de chaque cause système. La méthode main termine avec le code **1** lors d'une RuntimeException de démarrage, sans laisser la JVM réimprimer les messages bruts des causes. Les tests utilisant directement SpringApplication reçoivent l'exception pour pouvoir vérifier le comportement.

## Logs

Le fichier actif est `<racine>/logs/jbstock.log`. Les archives sont `jbstock-AAAA-MM-JJ.<index>.log.gz` : rotation quotidienne ou à **10 MB**, historique **14 jours**, plafond d'archives **100 MB**. Le fichier actif s'ajoute au plafond ; la purge est effectuée par Logback au démarrage et lors des rotations, pas comme un quota disque strict et instantané.

La console et les fichiers utilisent le même encodeur prudent : date UTC, niveau, nom du logger, code stable, classes des exceptions et emplacements de pile bornés. Les messages libres, arguments, MDC, messages des causes et exceptions supprimées ne sont pas sérialisés. Cela évite de recopier un payload HTTP, du SQL avec ses paramètres ou des identifiants dans une trace d'erreur. Le coût est un diagnostic moins détaillé que les logs Spring habituels.

Codes du cycle : `LOGGING_READY`, `BACKEND_READY`, `BACKEND_STOPPING`, `LOGGING_STOPPED`. Les autres événements sont marqués `TECHNICAL_EVENT`. Pour enrichir les diagnostics, ajouter des codes fixes au lieu de messages construits à partir de données utilisateur. Ne pas créer de noms de logger à partir de données métier.

Depuis le diagnostic de réinstallation du 08/10, l'échec d'initialisation de la datasource est consigné avant fermeture du journal sous `com.jbstock.database` : `SQLITE_BUSY` (busy/locked), `SQLITE_READONLY`, `SQLITE_IOERR`, `SQLITE_CORRUPT`, `SQLITE_FULL`, `SQLITE_CANTOPEN`, `SQLITE_NOTADB`, `SQLITE_OTHER` ou `DATABASE_FAILURE`. Le code est déduit du résultat SQLite, jamais du message libre. Cette liste est autorisée explicitement par l'encodeur filtré ; le contrat stderr `JBSTOCK_STARTUP_FAILED DATABASE_ERROR` et les traductions restent inchangés. Ces codes concernent l'initialisation de la datasource, pas tous les échecs SQL pendant l'utilisation ou une migration.

Le fichier est attaché après résolution du stockage et avant la datasource, puis fermé après la datasource. Si le stockage lui-même est inutilisable, aucune écriture dans un répertoire de repli : le diagnostic reste sur stderr/console. Les erreurs après initialisation du fichier peuvent y laisser leurs traces techniques. Les sorties natives JVM et celles d'outils externes ne traversent pas cet encodeur ; ne pas activer un dump de requêtes, un dump de heap ou une configuration de logging externe contenant des données sensibles.

## Arrêt

`server.shutdown=graceful` et `spring.lifecycle.timeout-per-shutdown-phase=20s` sont explicites. Lors de la fermeture du contexte, le serveur laisse finir les requêtes actives pendant la phase d'arrêt, puis ferme la datasource et le journal. **20 secondes est un délai par phase, pas une limite absolue sur tout le processus.**

La sonde de santé peut passer à 503 pendant la fermeture. Le test d'intégration confirme qu'une requête Entreprise déjà en cours termine en 200 avant la fermeture du pool SQLite.

Sous Windows, ne pas supposer que tuer un PID déclenche un arrêt gracieux. Le lanceur Electron active `--jbstock.desktop.stdin-control=true` et conserve le pipe stdin de son enfant Java. Il transmet `JBSTOCK_SHUTDOWN` suivi d'un saut de ligne, ferme le pipe et attend la sortie du processus. `DesktopControl` ferme alors le contexte Spring. La perte du pipe (EOF) déclenche également cette fermeture ; ce mécanisme n'est actif que lorsque l'option desktop est activée.

Java est lancé avec `detached: process.platform === 'win32'`, `windowsHide: true` et trois pipes. Sous Windows, cela permet au processus Java de terminer la fermeture Spring sur EOF après un arrêt brutal du main Electron. Le superviseur conserve la référence du processus et n'appelle pas `unref()` ; la commande privée, l'attente de sortie et le secours visant uniquement cet enfant restent actifs. Voir [Node.js — options.detached](https://nodejs.org/download/release/v25.9.0/docs/api/child_process.html#optionsdetached). Ce mécanisme ne garantit pas un arrêt gracieux si Java est lui-même tué, si tout l'arbre de processus est terminé ou lors d'une coupure électrique.

Le superviseur attend jusqu'à 30 secondes puis tue uniquement son enfant Java direct en dernier recours. Deux cycles réels de lancement/écriture/fermeture/réouverture sous Windows ont été testés sans arrêt forcé. Aucun endpoint HTTP d'arrêt n'est ajouté. Le lanceur navigateur `scripts/dev.mjs` conserve son ancien mécanisme de nettoyage ; utiliser Electron pour tester le nouveau canal.

La sauvegarde locale à la fermeture appartient à l'étape sauvegardes : elle n'est pas encore implémentée. Les tests actuels ne simulent pas de coupure électrique.

Référence consultée : [arrêt gracieux Spring Boot](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html).
