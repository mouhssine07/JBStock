# Instructions de reprise — JBStock

Avant toute intervention, lire :

1. `docs/StockManager -- Spécification Fonctionnelle et architecture technique de référence.md` : référence fonctionnelle et technique, notamment les sections 100 et 103.
2. `docs/SUIVI_PROJET.md` : état vérifié, écarts, étapes et prochaine action.

Comparer ces documents au code et au statut Git avant de développer. Préserver les modifications déjà présentes. L'architecture reste Electron + React/TypeScript/Vite + Spring Boot/Java + SQLite ; les données commerciales sont locales, Google Drive sert à la sauvegarde.

Avancer par étapes vérifiables, en commençant par le backend selon la demande utilisateur. Valider la fondation desktop avant d'ajouter les nouveaux modules métier. Ne pas confondre présence de code, tests réussis et fonctionnalité livrable.

Exigence multilingue du 07/10/2026 : JBStock doit proposer l'arabe (`ar`) et l'anglais (`en`), avec l'anglais comme langue initiale par défaut. Prévoir un sélecteur de langue, mémoriser le choix localement et le restaurer au redémarrage, y compris hors ligne. L'arabe utilise une interface de droite à gauche (RTL), l'anglais de gauche à droite (LTR). Centraliser les traductions ; ne pas ajouter de textes d'interface en dur, y compris validations et messages Electron. Localiser les formats d'affichage sans modifier les valeurs métier stockées ni traduire les données saisies. Le socle Entreprise/desktop, sa persistance et six dialogues natifs ont été vérifiés dans le package le 08/10/2026 ; NSIS et MSIX 0.0.1.2 reconstruits, installation existante inchangée. À la prochaine session, suivre `docs/SUIVI_PROJET.md` et `docs/TEST_WINDOWS_VIERGE.md` pour la recette sur le second PC Windows de l'utilisateur, disponible plus tard, puis reprendre les validations desktop restantes. Ne pas confondre ce socle avec une livraison multilingue complète.

Le 08/10/2026, le défaut d'arrêt Java après terminaison brutale du seul main Electron a été reproduit puis corrigé : Java détaché sous Windows, pipes et suivi conservés sans unref. Quatre cycles du package, récupération après crash, fins de journal et absence de processus/ports résiduels vérifiés ; six dialogues rejoués. NSIS et MSIX non signé `0.0.1.2` reconstruits avec nouvelles empreintes dans `docs/TEST_WINDOWS_VIERGE.md`. L'installation `0.0.1.1` reste inchangée ; la recette du second PC et la validation du correctif sous identité MSIX restent à réaliser.

À la fin de chaque étape, mettre à jour `docs/SUIVI_PROJET.md` : changements, fichiers concernés, commandes et résultats des tests, limites, décisions et prochaine action concrète. Conserver le journal des sessions. Ne jamais déclarer une étape terminée si ses critères d'acceptation restent non vérifiés.

Dernier retour utilisateur du 08/10 : essai Windows 11 sans Java/Node réussi hors ligne, langue/données conservées après relance et redémarrage ; ralentissement général au démarrage puis alerte d'ouverture de base après désinstallation/réinstallation. Le second PC est désormais indisponible. Tests locaux NSIS sous identité distincte : conservation et récupération après désinstallation à application fermée/ouverture vérifiées ; test de refus d'accès exclusif avec fichier inchangé réussi. Diagnostics SQLite filtrés ajoutés, packages reconstruits et empreintes actualisées. Cause de l'alerte distante, état des fichiers du second PC et performance non résolus : ne pas déclarer ces incidents corrigés et ne pas remplacer/réinitialiser les données. Suivre le journal actuel plutôt que les anciennes attentes de disponibilité.

## Optimisation Codex — Qualité et consommation

Stabilisation locale supplémentaire du 08/10 : reprise d'ouverture SQLite sur le même fichier, au plus trois tentatives pour BUSY/LOCKED/CANTOPEN ; verrou temporaire surmonté et refus persistant sans remplacement vérifiés. Budget JVM desktop : heap initial 32 MiB/maximal 512 MiB, au plus deux processeurs déclarés aux pools internes, GC par défaut. Mesures locales Java améliorées, sans preuve de résolution du ralentissement du second PC. Mono-instance du main empaqueté vérifiée sur deux passages instrumentés : démarrage, fenêtre réduite/restaurée au premier plan, même Java/port, brouillon/données/arabe conservés. Un retour à l'anglais observé une fois reste inexpliqué et documenté. Prochain critère local : alertes après perte du backend Java dans les deux langues. Conserver les limites de recette Windows/MSIX et l'interdiction de réinitialiser une base en erreur.

Dernière validation du 08/10 : perte brutale du Java enfant vérifiée en anglais/arabe sur copie isolée, alertes natives et récupération des données/langue réussies, intégrité SQLite contrôlée. Le scénario empaqueté compte huit cycles avec backend, six arrêts propres et deux terminaisons Java forcées attendues, huit dialogues natifs. Prochaine action locale : dialogues `DATABASE_ERROR` au démarrage avec une base de fixture verrouillée, puis récupération après libération. Ne pas assimiler ces tests à une réparation de l'incident distant ou à la recette complète Windows/MSIX.

### Objectif

Maintenir une qualité de développement professionnelle tout en limitant la consommation inutile du quota Codex.

### Utilisation des modèles

Le modèle actif est défini par la configuration Codex CLI, et non par ce fichier.

- Tâches simples : privilégier un modèle léger tel que GPT-6-Luna.
- Développement standard : privilégier GPT-6.1-Sol Medium.
- Tâches critiques : privilégier GPT-6-Astra High lorsque nécessaire.

Les tâches critiques comprennent notamment :

- Sécurité, authentification et autorisations.
- Migrations SQLite et intégrité des données.
- Sauvegarde et restauration Google Drive.
- Architecture Electron, Spring Boot et communication interprocessus.
- Packaging, installation et mises à jour Windows.
- Bugs complexes pouvant entraîner une perte de données.

Si le modèle actif semble insuffisant, expliquer brièvement pourquoi un modèle plus puissant serait préférable. Ne jamais prétendre avoir changé de modèle sans confirmation.

### Optimisation des ressources

- Consulter les documents de référence obligatoires sans les analyser intégralement à chaque intervention si seules certaines sections sont pertinentes.
- Examiner uniquement les fichiers de code nécessaires à la tâche.
- Éviter les recherches répétitives et les analyses globales injustifiées.
- Réutiliser les résultats des validations précédentes lorsqu'ils restent pertinents.
- Exécuter les tests ciblés avant d'envisager des suites complètes.
- Éviter les modifications non demandées.
- Ne pas multiplier les sous-agents lorsque la tâche peut être exécutée efficacement par un seul agent.

### Qualité obligatoire

Quel que soit le modèle utilisé :

- Respecter les spécifications et les décisions existantes.
- Ne pas inventer de résultats de tests.
- Préserver les fonctionnalités déjà vérifiées.
- Vérifier les conséquences des modifications sur les autres modules.
- Respecter les exigences de fonctionnement hors ligne.
- Préserver la compatibilité anglais/arabe et LTR/RTL.
- Ne jamais compromettre la sécurité ou l'intégrité des données pour économiser du quota.

### Traçabilité

Continuer à mettre à jour `docs/SUIVI_PROJET.md` selon les instructions de reprise existantes.

Ne pas déclarer une fonctionnalité terminée sans validation de ses critères d'acceptation.
