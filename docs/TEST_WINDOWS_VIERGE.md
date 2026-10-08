# JBStock — essai sur le second PC Windows

Préparé le 08/10/2026. Le second PC a permis les essais ci-dessous, puis est devenu indisponible après l'alerte SQLite. L'utilisateur rapporte une installation réussie sans Wi-Fi/Internet sur ce PC sans données JBStock, ainsi qu'un changement de langue réussi. La recette reste partielle.

## Résultats utilisateur reçus

| Vérification | Résultat rapporté |
| --- | --- |
| PC sans données JBStock | Confirmé par l'utilisateur. |
| Installation du NSIS sans Wi-Fi/Internet | Réussie selon l'utilisateur. |
| Ouverture de l'application et changement de langue | Réussis selon l'utilisateur ; choix de l'arabe et utilisation hors ligne confirmés par la réalisation des étapes proposées. Contrôle visuel RTL/LTR détaillé non rapporté. |
| Enregistrement de données fictives | Réussi selon l'utilisateur. |
| Données et langue après fermeture/relance puis redémarrage Windows sans Internet | Conservées : les trois étapes proposées ont été réalisées et fonctionnent, selon l'utilisateur. |
| Version Windows et absence préalable de Java/Node | Windows 11 ; ni Java ni Node.js préinstallés, selon l'utilisateur. Build Windows exact non renseigné. |
| Empreinte du fichier transféré | Non renseignée. |
| Performance | Ralentissement de tout le PC confirmé au démarrage de JBStock, pendant quelques secondes ; également signalé pendant l'installation. Ressource saturée, durée exacte et configuration matérielle non mesurées ; cause non établie. |
| Désinstallation puis réinstallation | L'utilisateur rapporte ensuite une alerte « cannot open the db ». Échec d'ouverture à diagnostiquer ; conservation des fichiers du second PC non inspectée. Le second PC n'est plus disponible. |

Ce retour constitue une validation manuelle rapportée par l'utilisateur, sans accès direct au second PC. Les autres vérifications ci-dessous restent à effectuer ou à confirmer ; aucun essai MSIX n'a été rapporté.

## Fichier à transférer

Copier seulement `desktop/release/JBStock-0.0.1-setup.exe` sur une clé USB, puis sur le PC de test. Cet installateur de validation embarque Electron, Java et le logiciel : ne pas installer Java, Node.js ou Maven pour cet essai. Ne pas copier le dossier de données du PC de développement.

Build courant du 08/10/2026 (arrêt Java après crash du main Electron, reprise SQLite bornée et budget JVM) : **247 339 643 octets**. SHA-256 :

```text
54D14F3C28CFDF71432C9DEDF324AD6C8B532708E51BC0DB618E372A69CC8B18
```

La commande PowerShell `Get-FileHash .\JBStock-0.0.1-setup.exe -Algorithm SHA256` permet de vérifier la copie. Cette empreinte concerne ce build précis ; la recalculer après toute reconstruction.

Le MSIX de développement `0.0.1.2` est un artefact distinct, reconstruit avec la reprise SQLite et le budget JVM, non signé à ce stade ; ne pas l'utiliser pour cette première procédure NSIS. Il pèse **296 396 296 octets**, SHA-256 `6F86AAAB847A932A69D12036761F2DB41C21C2A67779FEDD1B15A667161F97C9`. La validation MSIX sur Windows vierge fera l'objet d'un essai séparé. L'installation existante `0.0.1.1` reste inchangée.

Ces empreintes concernent le dernier build local. Les retours utilisateur ci-dessus précèdent cette reconstruction ; l'empreinte du fichier effectivement testé sur le second PC n'a pas été relevée. Les diagnostics ajoutés ne constituent pas une réparation de sa base.

## Préparer le test

**Diagnostic du ralentissement rapporté :** ouvrir le Gestionnaire des tâches (`Ctrl` + `Maj` + `Échap`) avant de lancer JBStock, puis observer les pourcentages Processeur, Mémoire et Disque pendant le ralentissement. Noter la colonne qui augmente fortement et le processus qui arrive en tête en triant cette colonne. Relever aussi si le PC retrouve sa fluidité une fois le formulaire ouvert. Cette observation ne nécessite ni réinstallation ni suppression des données.

1. Utiliser Windows 10/11 x64 et un compte sans installation ni données JBStock existantes. Si des données existent, arrêter cette procédure et les signaler.
2. Noter la version de Windows, et si Java ou Node.js étaient déjà installés. Un PC qui les possède ne valide pas à lui seul le scénario « sans Java/Node ».
3. Déconnecter le Wi-Fi ou le câble réseau **avant l'installation et le premier lancement**.
4. Lancer l'installateur, terminer l'installation puis ouvrir JBStock. C'est un build de développement sans signature de production ; noter tout avertissement ou blocage Windows, sans désactiver les protections du PC.

## Vérifications à effectuer

| Action | Résultat attendu |
| --- | --- |
| Premier lancement sans Internet | Écran Entreprise en anglais, aucun téléchargement de composant requis. |
| Choisir العربية | Interface arabe, titre et formulaire orientés de droite à gauche. |
| Enregistrer un formulaire vide | Message de validation en arabe. |
| Saisir `Demo متجر 123` comme nom et `Adresse de test` comme adresse | Valeurs conservées telles que saisies. |
| Ajouter un identifiant avec libellé `TEST` et valeur `001234` | Zéros initiaux conservés. |
| Basculer vers English puis العربية avant d'enregistrer | Aucun champ ni identifiant perdu ; interface LTR puis RTL. |
| Enregistrer | Confirmation arabe, aucune demande Internet. |
| Fermer normalement, attendre quelques secondes, relancer | Langue arabe et données fictives restaurées. |
| Fermer puis redémarrer Windows, toujours sans réseau ; relancer | Même langue et mêmes données. |
| Ouvrir JBStock une seconde fois | Une seule fenêtre applicative. |
| Réduire la fenêtre avec un brouillon non enregistré, puis relancer JBStock | La même fenêtre revient au premier plan ; brouillon et langue conservés. |
| Revenir à English et fermer/relancer | Anglais mémorisé, données inchangées. |

Conserver l'installation pour la suite des essais. Ne pas désinstaller et ne pas supprimer les fichiers de données pendant ce scénario.

## Résultats à transmettre

- Version Windows et présence/absence préalable de Java/Node.
- Installation et premier lancement sans Internet : réussi ou message exact du blocage.
- Anglais/arabe, RTL, validations et conservation du brouillon : réussi/échoué.
- Langue et données après relance puis redémarrage Windows : réussi/échoué.
- Éventuelles captures avec les données fictives uniquement.

Le stockage NSIS attendu est `%LOCALAPPDATA%\JBStock` (base sous `data`, journaux sous `logs`, préférence sous `electron-profile\settings\language.json`). La virtualisation MSIX utilise un autre emplacement ; ne pas les confondre.

Les erreurs de ressources manquantes sont testées sur des copies isolées par les scripts du dépôt. Il n'est pas nécessaire de retirer Java ou de modifier l'installation du second PC pour les reproduire.
