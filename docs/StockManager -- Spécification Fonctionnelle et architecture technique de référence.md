# JBSTOCK

## Spécification fonctionnelle, architecture technique et règles de développement

**Version du document : 1.0**
**Date : 2 octobre 2026**
**Plateforme cible initiale : Windows Desktop**
**Type de produit : logiciel professionnel de gestion de stock et gestion commerciale**

---

# 1. Vision du projet

JBStock est un logiciel desktop professionnel destiné aux commerçants et petites/moyennes entreprises ayant besoin de gérer localement :

- leurs produits ;
- leurs images produits ;
- leurs stocks ;
- leurs mouvements de stock ;
- leurs clients ;
- leurs fournisseurs ;
- leurs ventes ;
- leurs achats ;
- leurs factures ;
- leurs paiements ;
- leurs historiques ;
- leurs sauvegardes.

Le logiciel doit rester suffisamment générique pour être utilisé dans différents secteurs :

- montres ;
- lunettes ;
- électronique ;
- vêtements ;
- accessoires ;
- cosmétiques ;
- pièces détachées ;
- commerce général ;
- etc.

JBStock ne doit donc jamais être conçu autour d'un secteur particulier.

---

# 2. Philosophie générale

Le logiciel doit respecter quatre principes fondamentaux.

## 2.1 Local First

Les données commerciales appartiennent au vendeur.

La base principale reste donc physiquement sur son ordinateur.

```text
PC DU CLIENT
│
├── JBStock
│
├── Base SQLite
├── Images
├── Factures
└── Sauvegardes locales
```

JBStock ne doit PAS utiliser une base de données centrale contenant les produits, ventes, clients ou chiffres d'affaires des différents commerçants.

Il ne s'agit donc pas d'un SaaS classique.

---

## 2.2 Offline First

Toutes les fonctions commerciales essentielles doivent fonctionner sans Internet :

```text
Produits             ✅
Stock                ✅
Ventes               ✅
Clients              ✅
Factures             ✅
Recherche             ✅
Historique            ✅
SQLite                ✅

Google Drive          ⏳
Vérification licence  selon cache local
```

La perte de connexion Internet ne doit jamais empêcher le commerçant de travailler.

---

## 2.3 Cloud Backup, pas Cloud Database

Google Drive sert exclusivement de système de protection/sauvegarde.

```text
SQLite local
     ↓
source principale

Google Drive
     ↓
backup / récupération
```

Google Drive ne doit jamais devenir la base utilisée directement par l'application.

---

## 2.4 Fiabilité avant sophistication

Les opérations financières et de stock sont prioritaires.

Une belle interface ne doit jamais être développée au détriment :

- de la cohérence du stock ;
- de l'intégrité de SQLite ;
- de la restauration ;
- des transactions ;
- de l'audit ;
- de la sécurité.

---

# 3. Technologies retenues

## Frontend

```text
React
TypeScript
Vite
```

React est responsable de toute l'interface graphique.

---

## Backend

```text
Java
Spring Boot
Spring Security
Spring Data JPA
```

Le backend tourne localement sur l'ordinateur.

Il ne doit écouter que sur :

```text
127.0.0.1
```

Il ne doit jamais exposer son API sur :

```text
0.0.0.0
```

par défaut.

---

## Base de données

```text
SQLite
```

Raisons :

- aucune installation de serveur DB ;
- fichier unique ;
- excellente performance locale ;
- transactions SQL ;
- indexes ;
- contraintes ;
- foreign keys ;
- sauvegarde simple ;
- fonctionnement hors ligne ;
- parfaitement adapté à un logiciel utilisé essentiellement sur un PC.

---

# 4. Couche Desktop

Le logiciel sera encapsulé avec :

```text
Electron
```

Architecture :

```text
┌─────────────────────────────────────┐
│             ELECTRON                │
│                                     │
│    ┌───────────────────────────┐    │
│    │      React + Vite         │    │
│    └─────────────┬─────────────┘    │
│                  │ API              │
│                  ▼                  │
│          Spring Boot local          │
│                  │                  │
│                  ▼                  │
│               SQLite                │
└─────────────────────────────────────┘
```

Electron est notamment responsable :

- du lancement du logiciel ;
- de la fenêtre Windows ;
- du lancement automatique de Spring Boot ;
- du contrôle du processus backend ;
- de la fermeture propre ;
- de l'intégration Windows ;
- du packaging.

---

# 5. Le vendeur ne doit rien installer

Le client final ne doit PAS avoir besoin d'installer :

```text
Node.js
npm
Java
Maven
SQLite
Spring Boot
```

Tous les composants nécessaires doivent être fournis avec JBStock.

Le package doit donc contenir notamment :

```text
Electron
React build
Spring Boot JAR
Java Runtime
```

Un Java Runtime réduit pourra être généré avec `jlink` afin d'éviter d'embarquer un JDK complet.

---

# 6. Architecture d'exécution

Au démarrage :

```text
Utilisateur clique JBStock
        ↓
Electron démarre
        ↓
Electron choisit un port local disponible
        ↓
Electron lance Spring Boot
        ↓
Spring Boot écoute :
127.0.0.1:<port>
        ↓
Electron vérifie /health
        ↓
React démarre
        ↓
Application prête
```

Le port ne doit idéalement pas être codé définitivement.

Electron peut choisir un port disponible et passer :

```text
--server.port=<port>
--server.address=127.0.0.1
```

au processus Spring Boot.

---

# 7. Sécurisation Electron ↔ Spring Boot

Le simple fait que l'API soit sur localhost ne suffit pas.

À chaque lancement, Electron doit générer un secret temporaire :

```text
localSessionToken
```

Le token est transmis à Spring Boot au démarrage.

React doit ensuite envoyer par exemple :

```text
X-JBStock-Local-Token
```

sur les appels locaux.

Le token change à chaque lancement.

Cela empêche un autre programme local d'appeler facilement les API JBStock.

---

# 8. Sécurité Electron

Configuration obligatoire :

```text
contextIsolation = true
nodeIntegration = false
```

Le renderer React ne doit pas obtenir un accès libre aux APIs Node.js.

Utiliser un `preload` minimal via :

```text
contextBridge
```

Uniquement les fonctions nécessaires doivent être exposées.

Utiliser également :

- Content Security Policy ;
- validation IPC ;
- interdiction d'exécuter du contenu distant arbitraire ;
- validation des URLs externes.

---

# 9. Structure locale des fichiers

Les données ne doivent jamais être enregistrées dans le dossier d'installation.

Exemple :

```text
%LOCALAPPDATA%\JBStock\
│
├── data\
│   └── jbstock.db
│
├── media\
│   └── products\
│       ├── originals\
│       └── thumbnails\
│
├── invoices\
│
├── backups\
│
├── logs\
│
└── config\
```

L'application elle-même reste séparée.

```text
Application
≠
Données utilisateur
```

Une mise à jour du programme ne doit jamais supprimer la DB ou les images.

---

# 10. Première utilisation

Lors du premier lancement, aucune donnée commerciale n'existe.

```text
Produits        0
Clients         0
Ventes          0
Factures        0
Fournisseurs    0
```

Un onboarding est affiché.

## Étape 1 — Entreprise

Demander :

- raison sociale / nom commercial ;
- logo ;
- téléphone ;
- email ;
- adresse ;
- informations fiscales configurables ;
- devise ;
- paramètres facture.

---

## Étape 2 — Administrateur

Création du premier compte local :

```text
Nom
Identifiant
Mot de passe
```

Ce compte devient :

```text
OWNER / ADMIN
```

---

## Étape 3 — Licence

L'application vérifie ou demande la licence JBStock.

---

## Étape 4 — Google Drive

Le commerçant connecte son propre compte Google.

Une information claire doit être affichée expliquant que :

> Les données principales restent sur son ordinateur et Google Drive est utilisé pour sécuriser les sauvegardes.

---

# 11. Modèle de licence

JBStock sera publié gratuitement sur Microsoft Store.

Cela signifie :

```text
Microsoft Store
JBStock
Prix téléchargement : GRATUIT
```

Mais l'utilisation professionnelle nécessite une licence JBStock.

---

# 12. Pourquoi séparer installation et licence

Cette architecture permet de décider indépendamment le prix demandé à chaque client.

Exemple :

```text
Client A
Licence offerte
0 DH

Client B
Licence négociée
300 DH

Client C
Licence négociée
600 DH

Client D
Licence annuelle
...
```

Microsoft Store n'est alors utilisé que pour :

- la découverte ;
- le téléchargement ;
- l'installation ;
- les mises à jour ;
- la signature du package.

---

# 13. Architecture du système de licences

Un petit serveur distant est nécessaire uniquement pour les licences.

IMPORTANT :

Ce serveur ne contient PAS :

- les produits ;
- les ventes ;
- les clients ;
- les images ;
- les factures ;
- le stock.

Il contient uniquement des informations de licence.

Exemple :

```text
License
-------------------------
license_key
customer_name
status
license_type
max_devices
created_at
expires_at
```

et éventuellement :

```text
LicenseDevice
-------------------------
installation_id
license_id
activated_at
last_check
```

---

# 14. Installation ID

À la première installation, JBStock génère :

```text
installationId = UUID
```

Exemple :

```text
8cc82691-fefa-45f9-a82e-...
```

Éviter d'utiliser des fingerprints matériels trop intrusifs.

Le `installationId` identifie simplement cette installation de JBStock.

---

# 15. Activation

Exemple :

```text
Entrez votre licence

SM-8FX2-KL93-PQL4
```

JBStock appelle :

```text
POST /api/licenses/activate
```

Le serveur renvoie un token/licence signé.

Ce token est ensuite conservé localement de façon sécurisée.

---

# 16. Fonctionnement hors ligne de la licence

Une perte temporaire d'Internet ne doit pas bloquer JBStock.

Après activation :

```text
Licence valide
       ↓
jeton local sécurisé
       ↓
fonctionnement offline
```

Une vérification distante peut être effectuée périodiquement lorsque Internet est disponible.

La fréquence devra être suffisamment raisonnable pour ne pas gêner l'utilisateur.

---

# 17. Utilisateurs locaux

JBStock doit prévoir plusieurs utilisateurs sur le même PC.

Rôles possibles :

```text
OWNER
ADMIN
MANAGER
SELLER
STOCK_MANAGER
READ_ONLY
```

Les permissions doivent être contrôlées côté Spring Boot.

Ne jamais se contenter de masquer un bouton dans React.

---

# 18. Authentification locale

Les mots de passe ne doivent jamais être stockés en clair.

Utiliser :

```text
Argon2id
```

ou à défaut :

```text
BCrypt
```

Les sessions applicatives sont ensuite gérées par Spring Security.

---

# 19. Module Entreprise

Entité :

```text
Company
```

Informations :

- nom ;
- logo ;
- adresse ;
- téléphone ;
- email ;
- identifiants fiscaux configurables ;
- devise ;
- langue ;
- template facture ;
- couleur facture ;
- texte pied de page.

---

## 19.1 Langues de l'application — exigence du 7 octobre 2026

JBStock doit être disponible en **arabe (`ar`) et en anglais (`en`)**, avec **l'anglais par défaut** au premier lancement. Un sélecteur permet de changer la langue ; le choix est enregistré localement et conservé au redémarrage, sans connexion Internet.

L'interface arabe doit être adaptée à la lecture de droite à gauche (**RTL**) et l'interface anglaise de gauche à droite (**LTR**), avec une typographie prenant en charge l'arabe. Les écrans, actions, validations et messages utilisateur, y compris les dialogues Electron, doivent être traduisibles via des ressources centralisées. Les dates, nombres et montants sont affichés selon la langue sélectionnée, sans modifier la devise configurée, les valeurs stockées ni les textes saisis par l'utilisateur.

Les futurs modules et documents générés doivent respecter cette exigence ; la langue des factures doit pouvoir suivre le paramètre Entreprise. La mise en œuvre commence à la prochaine session par le formulaire Entreprise et le socle desktop existants. Cette section décrit une exigence cible, pas une fonctionnalité actuellement livrée.

---

# 20. Module Produits

Le produit doit être générique.

Table logique :

```text
Product
-------------------------
id
public_id
sku
barcode
name
description
category_id
brand_id
purchase_price
selling_price
tax_rate
minimum_stock
active
created_at
updated_at
```

Ne jamais créer :

```text
WatchProduct
GlassesProduct
ComputerProduct
```

---

# 21. Attributs dynamiques

Les différentes activités ont des caractéristiques différentes.

Montre :

```text
Mouvement
Bracelet
Diamètre
Couleur
```

Lunettes :

```text
Monture
Couleur
Type
Taille
```

PC :

```text
CPU
RAM
SSD
GPU
```

Il faut donc prévoir un système générique :

```text
AttributeDefinition
AttributeValue
```

afin de ne pas changer la DB à chaque nouveau secteur.

---

# 22. Variantes produit

Prévoir dès l'architecture la possibilité de gérer :

```text
Produit
  │
  ├── Variante S / Rouge
  ├── Variante M / Rouge
  ├── Variante L / Noir
```

Chaque variante peut avoir :

```text
SKU
barcode
prix
stock
```

Même si la V1 utilise peu cette fonctionnalité, le modèle ne doit pas empêcher son ajout.

---

# 23. SKU et code-barres

Chaque produit ou variante doit pouvoir contenir :

```text
SKU
Barcode
```

Le SKU doit être unique.

Le barcode doit également pouvoir être unique.

---

# 24. Gestion des images

Les images ne sont jamais stockées directement dans SQLite.

SQLite contient uniquement :

```text
ProductImage
----------------
id
product_id
filename
position
is_primary
```

---

# 25. Nom des images

Chaque image reçoit un UUID.

Exemple :

```text
e9c8913d-4ffd-4476-a77d-b880fd938d51.webp
```

Ne jamais dépendre du nom fourni par l'utilisateur :

```text
image1.jpg
montre.jpg
IMG_4838.jpg
```

---

# 26. Conversion automatique WebP

Formats d'entrée acceptables :

```text
JPEG
JPG
PNG
WEBP
```

D'autres formats comme HEIC pourront être ajoutés après validation de la librairie utilisée.

Lors de l'import :

```text
Image
 ↓
validation MIME
 ↓
validation taille
 ↓
orientation EXIF
 ↓
redimensionnement
 ↓
conversion WebP
 ↓
compression
 ↓
UUID
 ↓
stockage
```

---

# 27. Taille recommandée images

Image produit principale :

```text
maximum environ 1600 px
sur le plus grand côté
```

Qualité WebP initiale :

```text
≈ 80–85 %
```

Ces valeurs doivent rester configurables.

---

# 28. Miniatures

Créer également une miniature.

Exemple :

```text
originals/
e9c891....webp
```

et :

```text
thumbnails/
e9c891....webp
```

La liste React charge uniquement les miniatures.

L'image HD est chargée uniquement lors de l'ouverture du produit.

Cela évite les ralentissements.

---

# 29. Stock

Le stock ne doit pas dépendre uniquement de :

```text
product.quantity
```

Le véritable historique doit être :

```text
StockMovement
```

---

# 30. StockMovement

Structure :

```text
StockMovement
-------------------------
id
product_variant_id
type
quantity
reference_type
reference_id
reason
user_id
created_at
```

Types :

```text
PURCHASE
SALE
RETURN_IN
RETURN_OUT
ADJUSTMENT_IN
ADJUSTMENT_OUT
TRANSFER_IN
TRANSFER_OUT
INITIAL_STOCK
```

---

# 31. Règle fondamentale du stock

Une opération validée ne doit pas être supprimée arbitrairement.

Exemple :

```text
Vente : -3
```

Si elle doit être annulée :

```text
Annulation : +3
```

On crée donc un mouvement inverse.

Cela permet de conserver une trace complète.

---

# 32. Stock actuel

Une table/cache pourra conserver le stock actuel pour accélérer les lectures :

```text
StockBalance
----------------
product_variant_id
warehouse_id
quantity
```

Mais :

```text
StockMovement
```

reste l'historique permettant d'expliquer comment ce stock a été obtenu.

---

# 33. Transactions

Lors d'une vente :

```text
Créer sale
Créer sale_items
Créer paiement
Créer mouvements stock
Mettre à jour stock balance
```

tout doit appartenir à UNE transaction DB.

Si une étape échoue :

```text
ROLLBACK
```

Aucun stock partiellement modifié.

---

# 34. Multi-dépôt

Même si la V1 utilise un seul magasin, prévoir :

```text
Warehouse
```

Structure :

```text
warehouse
stock_balance
stock_movement
```

afin que le logiciel puisse évoluer plus tard vers :

```text
Boutique
Dépôt
Entrepôt
```

---

# 35. Clients

Entité :

```text
Customer
```

Champs possibles :

```text
name
phone
email
address
notes
```

Tous les champs personnels doivent rester optionnels lorsque possible.

---

# 36. Fournisseurs

Entité :

```text
Supplier
```

Informations :

- nom ;
- téléphone ;
- email ;
- adresse ;
- notes.

---

# 37. Ventes

Entités :

```text
Sale
SaleItem
Payment
```

États :

```text
DRAFT
CONFIRMED
CANCELLED
```

Une vente confirmée génère les mouvements de stock correspondants.

---

# 38. Achats fournisseur

Prévoir :

```text
Purchase
PurchaseItem
```

Une réception de marchandise crée :

```text
StockMovement = PURCHASE
```

---

# 39. Facturation

JBStock doit générer des factures personnalisables.

Personnalisation :

```text
Logo
Entreprise
Adresse
Téléphone
Informations fiscales
Couleur
Footer
Conditions
```

---

# 40. Numérotation des factures

Utiliser une séquence fiable.

Exemple :

```text
FAC-2026-000001
FAC-2026-000002
```

L'incrément doit être effectué transactionnellement afin d'empêcher les doublons.

---

# 41. Facture finalisée

Après émission définitive, éviter de modifier silencieusement une facture.

Les corrections importantes doivent laisser une trace.

---

# 42. Audit Log

Table :

```text
AuditLog
--------------------------
id
user_id
action
entity_type
entity_id
old_value
new_value
created_at
```

Exemples :

```text
14:21 - Sara a créé produit P001
14:25 - Omar a modifié prix 120 → 130
14:32 - Omar a vendu 2 unités
14:37 - Admin a annulé vente V0013
```

---

# 43. SQLite — configuration

Activer :

```text
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
```

Utiliser également un `busy_timeout`.

Le niveau `synchronous` doit être choisi après tests entre :

```text
NORMAL
FULL
```

La priorité doit rester l'intégrité des données sans provoquer de latences excessives.

---

# 44. Indexes

Ajouter des indexes notamment sur :

```text
sku
barcode
product.name
category_id
created_at
customer.phone
invoice.number
stock_movement.product_variant_id
sale.created_at
```

Ne jamais supposer que SQLite restera rapide sans indexes appropriés.

---

# 45. Pagination

Ne jamais charger :

```text
50 000 produits
```

dans React en une seule requête.

Utiliser :

```text
?page=0
&size=50
```

avec recherche et filtres côté backend.

---

# 46. Sauvegarde — principe fondamental

Il faut distinguer :

```text
ENREGISTREMENT
```

et :

```text
BACKUP
```

Lorsqu'un vendeur effectue une vente :

```text
SQLite COMMIT
```

doit être immédiat.

Le vendeur ne doit jamais attendre la sauvegarde Google Drive pour que sa vente soit enregistrée.

---

# 47. Dirty State

Lorsque des données importantes changent :

```text
dirty = true
```

Exemple :

```text
vente
produit
stock
client
fournisseur
facture
paramètre
```

---

# 48. Politique de backup décidée

Créer un backup lorsque :

```text
5 minutes d'inactivité
```

OU :

```text
15 minutes maximum
depuis le dernier backup
```

si des modifications ont été effectuées.

Ces valeurs doivent être configurables.

---

# 49. Fermeture du logiciel

Lorsqu'un vendeur ferme JBStock :

```text
dirty = false
→ fermeture normale
```

Sinon :

```text
dirty = true
        ↓
snapshot SQLite immédiat
        ↓
backup local
        ↓
tentative synchronisation cloud
```

La sauvegarde locale est prioritaire.

Une mauvaise connexion Internet ne doit pas empêcher indéfiniment la fermeture.

---

# 50. Crash ou coupure électrique

Puisque chaque opération commerciale est déjà commitée dans SQLite :

```text
vente
 ↓
COMMIT
 ↓
persistée
```

une coupure brutale ne doit pas signifier la perte des opérations depuis le dernier backup.

Au prochain démarrage :

```text
DB plus récente que cloud
        ↓
backup nécessaire
```

---

# 51. Snapshot SQLite

Ne jamais copier naïvement :

```text
jbstock.db
```

pendant que SQLite effectue des écritures.

Utiliser une méthode de snapshot/backup SQLite cohérente.

Exemple logique :

```text
SQLite active
    ↓
snapshot cohérent
    ↓
snapshot.db
    ↓
compression
```

---

# 52. Maximum 3 backups

Google Drive conserve maximum :

```text
3 sauvegardes DB restaurables
```

Exemple :

```text
backup_2026-10-02_09-00
backup_2026-10-02_12-00
backup_2026-10-02_15-00
```

Lorsqu'une quatrième arrive :

```text
nouveau backup
      ↓
upload
      ↓
vérification intégrité
      ↓
seulement ensuite
      ↓
suppression du plus ancien
```

Ne jamais supprimer l'ancien AVANT d'avoir validé le nouveau.

---

# 53. Intégrité des backups

Chaque backup doit avoir :

```text
SHA-256
```

et un manifest.

Exemple :

```json
{
  "backupVersion": 1,
  "appVersion": "1.0.0",
  "databaseVersion": 5,
  "createdAt": "...",
  "installationId": "...",
  "checksum": "..."
}
```

---

# 54. Images et backups

Les images ne doivent PAS être incluses dans chacun des trois backups DB.

Sinon :

```text
4 GB images × 3
= 12 GB
```

inutilement.

---

# 55. Synchronisation médias

Structure cloud :

```text
JBStock/
│
├── DatabaseBackups/
│   ├── backup_A
│   ├── backup_B
│   └── backup_C
│
├── Media/
│   └── Products/
│       ├── UUID1.webp
│       ├── UUID2.webp
│       └── UUID3.webp
│
└── Documents/
```

Chaque image n'est uploadée qu'une seule fois.

---

# 56. Déduplication média

Le nom UUID garantit l'unicité du fichier.

Pour aller plus loin, calculer également :

```text
SHA-256(image)
```

Cela permet éventuellement de détecter si la même image physique est importée plusieurs fois.

---

# 57. File de synchronisation

Créer une table/queue :

```text
SyncQueue
```

Exemple :

```text
id
resource_type
local_path
operation
retry_count
status
created_at
```

Statuts :

```text
PENDING
UPLOADING
SUCCESS
FAILED_RETRYABLE
FAILED_PERMANENT
```

---

# 58. Google Drive en background

Les opérations Drive ne doivent jamais tourner sur le thread UI.

Architecture :

```text
React
 │
 │ continue normalement
 │
 └──────────────► Background Sync Worker
                         │
                         ├── backup
                         ├── images
                         └── Drive API
```

---

# 59. Gestion absence Internet

Si Internet est indisponible :

```text
SQLite                ✅
Backup local          ✅
Drive                  ⏳ PENDING
```

Au retour d'Internet :

```text
SyncWorker
   ↓
traite la queue
```

---

# 60. Google OAuth

Le vendeur connecte son propre compte Google.

Ne jamais demander son mot de passe Google directement.

Utiliser :

```text
OAuth 2.0
```

dans le navigateur officiel.

Pour une application desktop, utiliser le flow OAuth adapté aux applications installées.

---

# 61. Permissions Google

Demander le minimum de permissions possible.

Le scope privilégié doit être :

```text
https://www.googleapis.com/auth/drive.file
```

lorsque l'architecture le permet.

Google recommande d'utiliser des scopes limités plutôt qu'un accès à tout Drive.

---

# 62. Token Google

Les refresh tokens Google ne doivent jamais être stockés en clair dans :

```text
config.json
```

Utiliser idéalement :

```text
Windows Credential Manager
```

ou :

```text
Windows DPAPI
```

---

# 63. Déconnexion Drive

L'utilisateur doit pouvoir :

```text
Paramètres
→ Google Drive
→ Déconnecter
```

Le token local doit alors être supprimé/révoqué correctement.

---

# 64. Chiffrement des backups

Les fichiers de backup peuvent contenir :

- clients ;
- ventes ;
- prix ;
- fournisseurs ;
- informations financières.

Ils doivent idéalement être chiffrés.

Approche :

```text
snapshot DB
   ↓
compression
   ↓
AES-256-GCM
   ↓
Google Drive
```

---

# 65. Recovery Key

Le chiffrement implique une problématique importante :

Si le PC est détruit, il faut pouvoir déchiffrer la sauvegarde sur le nouveau PC.

Prévoir donc une stratégie de récupération :

```text
Recovery Key
```

ou un secret dérivé d'un mot de passe de récupération.

Ne jamais créer un système où la perte du PC rend les backups Drive inutilisables.

---

# 66. Restauration

Le logiciel doit proposer :

```text
Restaurer une sauvegarde
```

L'utilisateur voit :

```text
02/10/2026 15:00
02/10/2026 12:00
02/10/2026 09:00
```

Il sélectionne une sauvegarde.

Workflow :

```text
Télécharger backup
        ↓
vérifier checksum
        ↓
déchiffrer
        ↓
vérifier version
        ↓
backup DB actuelle de sécurité
        ↓
restaurer DB
        ↓
vérifier médias
        ↓
redémarrer backend
```

---

# 67. Restauration sur nouveau PC

Scénario critique :

```text
ancien PC détruit
       ↓
nouveau PC
       ↓
Microsoft Store
       ↓
installer JBStock
       ↓
activer licence
       ↓
connecter Google Drive
       ↓
détecter backup
       ↓
restaurer
```

Cela doit être testé avant toute commercialisation.

---

# 68. Dashboard backup

Afficher discrètement :

```text
☁ Google Drive connecté
Dernier backup : 14:32
État : Protégé
```

ou :

```text
☁ Synchronisation en attente
```

Le vendeur doit comprendre l'état sans être dérangé.

---

# 69. Logs

JBStock doit générer des logs techniques.

Exemple :

```text
logs/
jbstock-2026-10-02.log
```

Les logs ne doivent pas contenir :

```text
mot de passe
token Google
numéro carte bancaire
secret licence
```

Utiliser une rotation automatique.

---

# 70. Gestion des erreurs

Prévoir des messages métier.

Mauvais :

```text
SQLException HY000
```

Bon :

```text
Impossible d'enregistrer cette vente.
Aucune donnée n'a été modifiée.
```

Le détail technique va dans les logs.

---

# 71. Gestion d'espace disque

Avant :

- import média important ;
- création backup ;
- restauration ;

vérifier l'espace disque disponible.

Afficher une alerte lorsqu'il devient insuffisant.

---

# 72. Corruption SQLite

Au démarrage, prévoir éventuellement une vérification légère :

```text
PRAGMA quick_check
```

et des contrôles plus complets lorsque nécessaire.

Si une corruption est détectée :

```text
ne pas continuer silencieusement
```

Proposer la restauration du dernier backup valide.

---

# 73. Migrations DB

Utiliser :

```text
Flyway
```

ou un outil équivalent.

Exemple :

```text
V1__initial_schema.sql
V2__add_product_attributes.sql
V3__add_invoice_settings.sql
```

Ne jamais modifier la DB d'un client manuellement lors d'une mise à jour.

---

# 74. Migration sécurisée

Avant une migration importante :

```text
backup local automatique
        ↓
migration
        ↓
validation
```

Si la migration échoue :

```text
rollback / restauration
```

---

# 75. API backend

Structure indicative :

```text
/api/auth
/api/company
/api/users

/api/products
/api/categories
/api/brands
/api/media

/api/stock
/api/stock-movements
/api/warehouses

/api/customers
/api/suppliers

/api/sales
/api/purchases
/api/payments

/api/invoices

/api/backups
/api/sync

/api/license

/api/settings
/audit
```

---

# 76. Organisation Spring Boot

Exemple :

```text
backend/
└── src/main/java/...
    │
    ├── auth/
    ├── company/
    ├── product/
    ├── category/
    ├── inventory/
    ├── customer/
    ├── supplier/
    ├── sale/
    ├── purchase/
    ├── invoice/
    ├── media/
    ├── backup/
    ├── drive/
    ├── license/
    ├── audit/
    ├── security/
    └── common/
```

Préférer une organisation par domaine métier plutôt qu'un énorme dossier :

```text
controller/
service/
repository/
```

contenant toute l'application mélangée.

---

# 77. Organisation frontend

Exemple :

```text
frontend/src/
│
├── app/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── products/
│   ├── stock/
│   ├── sales/
│   ├── purchases/
│   ├── customers/
│   ├── suppliers/
│   ├── invoices/
│   ├── backup/
│   └── settings/
│
├── components/
├── hooks/
├── services/
├── types/
└── utils/
```

---

# 78. Monorepo recommandé

```text
jbstock/
│
├── frontend/
│
├── backend/
│
├── desktop/
│
├── docs/
│
├── scripts/
│
├── installer/
│
└── README.md
```

---

# 79. États et suppression

Éviter de supprimer physiquement des éléments déjà référencés.

Par exemple :

```text
Product
active = false
```

au lieu de supprimer un produit déjà utilisé dans 500 ventes.

---

# 80. Ventes annulées

Ne jamais faire :

```text
DELETE FROM sale
```

pour une vente validée.

Faire :

```text
status = CANCELLED
```

et créer les opérations de stock inverses.

---

# 81. Performance

L'application doit rester fluide même avec de grandes quantités de données.

Objectifs de test :

```text
20 000 produits
50 000 mouvements
30 000 ventes
10 000 clients
plusieurs milliers d'images
```

Les chiffres ne constituent pas une limite fixe ; ils servent à tester le comportement.

---

# 82. Stratégies performance

Utiliser :

- pagination ;
- indexes ;
- requêtes optimisées ;
- lazy loading ;
- miniatures ;
- background workers ;
- caching raisonnable ;
- virtualisation de longues listes si nécessaire.

---

# 83. Opérations background

Doivent notamment être asynchrones :

```text
conversion images
génération thumbnails
génération PDF
backup
compression
chiffrement
Google Drive
nettoyage médias
```

La navigation React ne doit pas se bloquer.

---

# 84. Microsoft Store

Modèle choisi :

```text
Microsoft Store
        ↓
JBStock GRATUIT
        ↓
installation
        ↓
licence JBStock
```

Pour les applications PC non-jeux, les politiques Microsoft Store actuellement publiées permettent l'utilisation d'une API de paiement tierce sécurisée pour des biens ou services numériques intégrés. La politique 7.20 est publiée le 15 septembre 2026 et prend effet le 22 octobre 2026. Ces règles devront être revérifiées au moment de la soumission.

---

# 85. Description Store

Ne jamais tromper l'utilisateur avec :

```text
100 % gratuit
```

si une licence est nécessaire.

Description claire :

> Téléchargement gratuit. Une licence JBStock est nécessaire pour activer les fonctionnalités professionnelles.

---

# 86. Licence certification Microsoft

L'équipe Microsoft doit pouvoir tester l'application.

Prévoir une licence spéciale :

```text
MICROSOFT-CERTIFICATION-TEST
```

ou un compte/test équivalent.

Elle active toutes les fonctionnalités sans paiement.

Les informations doivent être fournies dans les notes de certification.

---

# 87. Confidentialité

Une Privacy Policy publique doit expliquer au minimum :

- quelles données restent locales ;
- quelles données sont envoyées vers Google Drive ;
- quelles données vont vers le serveur de licences ;
- pourquoi elles sont utilisées ;
- comment retirer Google Drive ;
- comment contacter le support.

---

# 88. MSIX

Cible de production Microsoft Store :

```text
MSIX
```

Pour une distribution MSIX via Microsoft Store, Microsoft signe le package lors de la publication ; un certificat CA personnel n'est donc pas nécessaire pour ce canal.

Pendant le développement, un certificat auto-signé peut être utilisé pour les tests locaux sur des machines qui lui font explicitement confiance.

---

# 89. Mises à jour

Le Microsoft Store doit gérer les mises à jour de l'application distribuée par le Store.

Exemple :

```text
1.0.0
 ↓
1.1.0
 ↓
1.2.0
```

Les mises à jour applicatives ne doivent jamais supprimer :

```text
SQLite
images
factures
configurations
```

---

# 90. Versioning

Utiliser Semantic Versioning :

```text
MAJOR.MINOR.PATCH
```

Exemples :

```text
1.0.0
1.1.0
1.1.1
2.0.0
```

---

# 91. Tests obligatoires

## Tests unitaires

Tester :

- calculs ;
- stock ;
- factures ;
- validations ;
- services métier.

---

## Tests intégration

Tester :

```text
Spring Boot
+
SQLite
```

notamment les transactions.

---

## Tests frontend

Tester les workflows principaux.

---

## Tests E2E

Exemple :

```text
Créer produit
→ importer image
→ créer stock initial
→ effectuer vente
→ vérifier stock
→ générer facture
→ fermer
→ rouvrir
→ données présentes
```

---

# 92. Tests catastrophe

Obligatoires avant commercialisation :

```text
Internet coupé
Google token expiré
Google token révoqué
Drive plein
disque local presque plein
backup corrompu
fermeture brutale
Spring Boot crash
Electron crash
PC redémarré
migration échouée
image invalide
énorme image
```

---

# 93. Test restauration

Le scénario suivant doit être testé régulièrement :

```text
Machine A
      ↓
création données
      ↓
backup Drive
      ↓

Machine B vierge
      ↓
installation
      ↓
connexion Drive
      ↓
restauration
      ↓
comparaison données
```

---

# 94. CI/CD

Utiliser Git.

Branches possibles :

```text
main
develop
feature/*
fix/*
```

Pipeline automatisé :

```text
backend tests
frontend tests
lint
build React
build Spring Boot
build desktop
package
```

---

# 95. Données de test

Ne jamais utiliser les données réelles d'un commerçant dans :

```text
GitHub
logs publics
screenshots publics
tests automatisés
```

Créer des fixtures fictives.

---

# 96. Première V1

La V1 ne doit pas essayer de tout faire.

Priorités :

```text
1. Desktop stable
2. SQLite stable
3. Entreprise
4. Auth utilisateurs
5. Produits
6. Catégories
7. Images WebP
8. Stock
9. Mouvements
10. Clients
11. Ventes
12. Factures
13. Backup local
14. Google Drive
15. Restaurations
16. Licence
17. Audit
18. Microsoft Store
```

---

# 97. Phase suivante

Après stabilisation :

```text
Fournisseurs avancés
Achats
Multi-dépôts
Transferts
Retours
Scanner code-barres
Impression ticket
Statistiques
Export Excel
Import Excel
Notifications stock faible
Templates facture avancés
```

---

# 98. Extensions futures possibles

Le modèle doit laisser la porte ouverte à :

```text
application mobile
API externe
e-commerce
Telegram
synchronisation multi-PC
multi-boutiques
analytics avancés
```

Mais aucune de ces fonctionnalités ne doit compliquer inutilement la V1.

---

# 99. Ce que le projet ne doit PAS devenir

Interdictions architecturales sans décision explicite préalable :

```text
❌ Base commerciale centrale cloud
❌ PostgreSQL obligatoire chez le client
❌ JSON utilisé comme DB métier principale
❌ Images stockées en BLOB SQLite
❌ Sauvegarde complète avec images après chaque modification
❌ Dépendance à WinRAR
❌ API Spring exposée sur le LAN
❌ Internet obligatoire pour vendre
❌ Suppression des mouvements historiques
❌ Suppression silencieuse des ventes
❌ Mot de passe stocké en clair
❌ Token Google stocké en clair
❌ UI bloquée pendant un upload Drive
```

---

# 100. Règles d'or pour l'assistant IA de développement

Tout assistant IA travaillant sur ce projet doit respecter les règles suivantes.

### Règle 1

Ne jamais changer l'architecture principale sans demander explicitement l'autorisation.

Architecture officielle :

```text
Electron
+
React/Vite
+
Spring Boot
+
SQLite
```

---

### Règle 2

La base commerciale reste locale.

Ne jamais transformer le projet en SaaS sans autorisation.

---

### Règle 3

Toute opération métier importante doit être transactionnelle.

---

### Règle 4

StockMovement est la source historique du stock.

---

### Règle 5

Aucune image dans SQLite.

---

### Règle 6

Toutes les images produits doivent être normalisées en WebP et recevoir un identifiant unique.

---

### Règle 7

Les tâches longues doivent être exécutées en arrière-plan.

---

### Règle 8

Une panne Google Drive ne doit pas bloquer l'application.

---

### Règle 9

Avant toute modification de schéma DB :

```text
migration versionnée
```

---

### Règle 10

Ne jamais modifier une facture, vente ou mouvement finalisé de façon silencieuse.

Créer une trace/audit ou une opération inverse.

---

### Règle 11

Toute nouvelle fonctionnalité doit être évaluée selon :

```text
sécurité
performance
fiabilité
offline
backup
migration
restauration
```

---

### Règle 12

Avant d'écrire du code complexe, l'assistant doit vérifier si une infrastructure équivalente existe déjà dans le projet afin d'éviter les doublons.

---

### Règle 13 — Multilingue obligatoire

Respecter l'exigence arabe/anglais de la section 19.1 : anglais par défaut, choix local persistant, arabe RTL et anglais LTR. Toute nouvelle interface doit utiliser des traductions centralisées ; ne pas introduire de nouveaux textes utilisateur en dur. Les codes d'erreur et les données métier restent stables ; leur présentation est localisée. Vérifier les deux langues et les deux directions lors de l'intégration frontend/desktop.

---

# 101. Architecture finale synthétique

```text
                     MICROSOFT STORE
                           │
                           │ installation/update
                           ▼
┌──────────────────────────────────────────────────┐
│                 PC DU COMMERÇANT                 │
│                                                  │
│                   ELECTRON                       │
│                      │                           │
│             ┌────────┴────────┐                  │
│             │                 │                  │
│        React + Vite     Spring Boot              │
│             │                 │                  │
│             └──── API locale ─┘                  │
│                               │                  │
│                            SQLite                │
│                               │                  │
│              ┌────────────────┼────────────┐     │
│              │                │            │     │
│           Produits         Stock       Ventes    │
│              │                │            │     │
│           Images          Mouvements    Factures │
│              │                                  │
│           WebP                                   │
│                                                  │
│                    Backup Manager                │
│                          │                       │
└──────────────────────────┼───────────────────────┘
                           │
                    Internet disponible
                           │
               ┌───────────┴───────────┐
               │                       │
               ▼                       ▼
        GOOGLE DRIVE             LICENSE SERVER
               │                       │
        backups / images         licence uniquement
        du commerçant            aucune donnée métier
```

---

# 102. Résumé final du produit

JBStock doit être :

**Local-first**

Les données principales sont conservées sur le PC du commerçant.

**Offline-first**

Le vendeur peut continuer à travailler sans Internet.

**Sécurisé**

Mots de passe hashés, API locale protégée, tokens sécurisés, backups chiffrables.

**Fiable**

Transactions SQL, historique des mouvements, audit, migrations et restaurations.

**Rapide**

SQLite local, indexes, miniatures, pagination et workers background.

**Économe en espace**

Images converties en WebP, miniatures, déduplication et absence de répétition dans les backups.

**Protégé contre la perte du PC**

Trois backups récents de la DB sur Google Drive et médias synchronisés séparément.

**Professionnel**

Factures personnalisées, utilisateurs, permissions, journal d'activité.

**Distribuable**

Application Windows via Microsoft Store sous MSIX.

**Commercialisable**

Téléchargement Store gratuit mais activation par licence JBStock, permettant des tarifs personnalisés.

---

# 103. Première instruction à donner à l'assistant IA de coding

Avant de commencer à générer des fonctionnalités métier, l'assistant doit :

1. créer le monorepo ;
2. initialiser React + Vite + TypeScript ;
3. initialiser Spring Boot ;
4. configurer SQLite ;
5. configurer Flyway ;
6. créer Electron ;
7. faire démarrer automatiquement Spring Boot depuis Electron ;
8. connecter React à Spring Boot exclusivement sur localhost ;
9. implémenter `/health` ;
10. déterminer les répertoires persistants Windows ;
11. créer la gestion propre du démarrage et de la fermeture ;
12. créer un premier build desktop testable.

Le premier objectif n'est donc PAS encore :

```text
Créer produit
```

Le premier objectif est :

```text
Electron
   ↓
React
   ↓
Spring Boot
   ↓
SQLite
```

fonctionnant ensemble proprement dans un seul logiciel desktop.

Une fois cette fondation validée, commencer les modules métier.

---

# 104. Principe directeur

Pour chaque décision technique pendant le développement, poser cette question :

> Si un commerçant utilise JBStock tous les jours pendant plusieurs années et confie à ce logiciel son stock, ses ventes, ses clients et ses factures, est-ce que cette décision reste fiable, compréhensible, récupérable et sécurisée ?

Si la réponse est non, la solution doit être repensée.
