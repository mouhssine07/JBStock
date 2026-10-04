# JBStock — Architecture Decisions

> This file contains the stable architectural decisions for JBStock.
> AI coding assistants must treat these decisions as constraints unless the developer explicitly changes them.
>
> Do not duplicate the complete project specification here.
> Full details are available in:
> `docs/StockManager -- Spécification Fonctionnelle et architecture technique de référence.md`

---

## 1. Product

Application name: **JBStock**

JBStock is a professional Windows desktop application for:

- inventory management;
- products;
- product images;
- stock movements;
- customers;
- suppliers;
- sales;
- purchases;
- payments;
- invoices;
- backups;
- business management.

It must remain generic and must not be designed specifically for watches or any single business sector.

---

## 2. Core Architecture

The official architecture is:

Electron
↓
React + Vite
↓
Spring Boot
↓
SQLite

Frontend:

- React
- Vite
- TypeScript preferred
- Tailwind CSS

Backend:

- Java 21
- Spring Boot
- Maven
- Spring Web
- Spring Data JPA
- Spring Security
- Validation
- Actuator
- Flyway

Database:

- SQLite

Desktop:

- Electron

Do not replace these technologies without explicit approval.

---

## 3. Local-First

The merchant's business data lives locally on their computer.

The main database is SQLite.

Do NOT introduce a central cloud database containing:

- products;
- stock;
- customers;
- suppliers;
- sales;
- invoices;
- business data.

JBStock is not a traditional SaaS.

---

## 4. Offline-First

Core business functionality must continue working without Internet.

Internet must not be required for:

- products;
- inventory;
- sales;
- customers;
- invoices;
- local authentication;
- searching business data.

Internet is used for services such as:

- Google Drive backup/synchronization;
- periodic license validation;
- future update-related services.

Temporary Internet failure must never stop normal store operations.

---

## 5. Backend Network

Spring Boot runs locally.

It must bind to:

127.0.0.1

and not expose itself to the LAN by default.

Electron will eventually launch and manage the Spring Boot process.

A temporary local session token will later protect communication between the desktop application and the local backend.

---

## 6. Database Rules

SQLite is the business database.

Important rules:

- enable foreign keys;
- use WAL mode;
- use appropriate indexes;
- use transactions for business operations;
- use Flyway for schema migrations;
- never manually modify client databases during application updates.

Business-critical operations must be atomic.

---

## 7. Stock Architecture

Do not model stock only as:

product.quantity

The historical source of stock changes is:

StockMovement

A StockBalance may be maintained for fast current-stock access.

Confirmed operations must not be silently deleted.

Cancellation should normally create compensating/reversal operations.

---

## 8. Product Architecture

Products must remain generic.

Do not create sector-specific entities such as:

WatchProduct
ComputerProduct
GlassesProduct

Use generic products with:

- categories;
- brands;
- dynamic attributes;
- variants;
- SKU;
- barcode.

The model must support different merchant sectors.

---

## 9. Images

Product images are files.

Do NOT store images as SQLite BLOBs.

Imported product images will eventually be:

1. validated;
2. resized when necessary;
3. converted to WebP;
4. assigned a UUID filename;
5. stored locally;
6. accompanied by a thumbnail.

SQLite stores image metadata/path references only.

---

## 10. Local Data

Application binaries and merchant data must remain separated.

Persistent data will eventually live under an appropriate Windows user-data directory such as:

%LOCALAPPDATA%\JBStock\

Potential structure:

data/
media/
invoices/
backups/
logs/
config/

Application updates must not delete merchant data.

---

## 11. Backups

SQLite remains the authoritative live database.

Google Drive is a backup/recovery destination, NOT the live database.

Important decisions:

- local save is immediate;
- cloud backup is asynchronous;
- backup failure must not block normal work;
- offline backup uploads are queued;
- keep up to 3 validated database backups;
- never delete the oldest backup before the newest one is successfully uploaded and verified;
- product media is synchronized separately to avoid duplicating images in every database backup.

---

## 12. Google Drive

Each merchant connects their own Google account.

Use official Google OAuth.

Never ask for or store the merchant's Google password.

Use least-privilege permissions where practical.

Google credentials/tokens must not be stored as plain text.

---

## 13. Authentication and Security

Local user passwords must never be stored in plain text.

Use Argon2id or BCrypt.

Authorization must be enforced by the backend, not only by hiding frontend buttons.

Electron security later must include:

- contextIsolation = true
- nodeIntegration = false
- minimal preload bridge
- validated IPC
- appropriate CSP

---

## 14. Licensing

JBStock will eventually use its own licensing system.

Microsoft Store installation and JBStock licensing are separate concepts.

Expected commercial model:

Microsoft Store
↓
free application download
↓
JBStock license activation

The license service stores licensing information only.

It must not store the merchant's business database.

Temporary Internet loss must not immediately disable the merchant's application after successful activation.

---

## 15. Microsoft Store

Target production distribution:

MSIX through Microsoft Store.

The Store will be used primarily for:

- trusted distribution;
- installation;
- application updates;
- package signing.

Store integration belongs to a later development phase.

Do not introduce Store-specific complexity into the business modules prematurely.

---

## 16. Performance Rules

JBStock must remain responsive with large datasets.

Use:

- pagination;
- database indexes;
- thumbnails;
- optimized queries;
- background processing;
- asynchronous cloud synchronization.

Do not load thousands of records or full-resolution images unnecessarily.

Long-running tasks must not block the UI.

---

## 17. Development Strategy

Development is incremental.

Required workflow:

inspect
→ plan
→ implement small change
→ test
→ verify
→ document progress
→ continue

Do not implement multiple future modules just because they appear in the specification.

Do not perform speculative refactors unrelated to the current task.

---

## 18. Source of Truth

Detailed requirements are stored in the full specification under `docs/`.

The AI assistant should NOT repeatedly read or summarize the entire specification.

Instead:

1. read `DECISIONS.md`;
2. read `CURRENT_PHASE.md`;
3. inspect relevant existing code;
4. search the full specification only for sections relevant to the current task.

---

## 19. Change Control

If implementation requires contradicting one of these architectural decisions:

STOP.

Explain:

- the conflicting decision;
- why it causes a problem;
- proposed alternative;
- advantages;
- disadvantages;
- migration impact.

Wait for explicit approval before changing the architecture.

## Task Complexity and Reasoning

Use the current model efficiently.

For routine implementation, inspection, small refactoring,
CRUD, styling, and straightforward fixes, do not unnecessarily
increase reasoning effort.

If the current task involves significant architectural decisions,
complex debugging, database integrity, concurrency, security,
backup/recovery, migrations, licensing security, or a problem that
cannot be solved reliably with the current reasoning level:

STOP before making risky changes.

Tell the developer:

- why the task is considered complex;
- what requires deeper reasoning;
- whether increasing reasoning effort is recommended;
- whether using a stronger model would materially improve reliability.

Do not silently make major architectural changes.
