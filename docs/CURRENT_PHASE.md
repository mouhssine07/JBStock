# JBStock — Current Development Phase

Last updated: 2026-10-04

## Current Phase

PHASE 1 — PROJECT FOUNDATION

The objective is to establish a clean, stable and testable technical foundation before implementing business modules.

---

## Already Created

Repository root:

Jbstock/

Existing components:

- `Jbstock-backend/`
  - Spring Boot project already generated.

- `Jbstock-frontend/`
  - React + Vite project already generated.
  - Tailwind CSS configuration has been started.

- `docs/`
  - full JBStock specification;
  - `DECISIONS.md`;
  - this `CURRENT_PHASE.md`.

Do NOT recreate these projects.

---

## Target Stack

Backend:

- Java 21
- Maven
- Spring Boot
- Spring Web
- Spring Data JPA
- Spring Security
- Validation
- Actuator
- Flyway
- SQLite

Frontend:

- React
- Vite
- TypeScript
- Tailwind CSS

Desktop later:

- Electron

---

## Important Current Decision

The existing frontend currently needs to be checked to determine whether it was initialized with JavaScript (`.jsx`) rather than TypeScript (`.tsx`).

Because JBStock is still at the beginning of development, convert/reinitialize the frontend appropriately now if necessary rather than postponing a JavaScript → TypeScript migration until later.

Do not make this change blindly.

Inspect the current frontend first.

---

# Current Milestone

The first milestone is:

Spring Boot
↓
SQLite
↓
Flyway
↓
Health endpoint

and then:

React/Vite
↓
Tailwind
↓
Backend health request

The milestone is complete only when both applications start correctly and the frontend can successfully communicate with the backend.

---

# Step 1 — Repository Audit

STATUS: COMPLETE

Before modifying code:

Inspect:

### Backend

- `pom.xml`
- Java version
- Spring Boot version
- existing dependencies
- package structure
- configuration files
- test configuration

### Frontend

- `package.json`
- Vite configuration
- JavaScript vs TypeScript
- Tailwind installation/configuration
- current source structure
- scripts
- existing dependencies

### Repository

- `.gitignore`
- project organization
- documentation files

Report problems before making major changes.

---

# Step 2 — Normalize Foundation

STATUS: IN PROGRESS

Completed changes:

- Confirmed Java 21 configuration and retained it.
- Removed unused Lombok dependency and annotation processor configuration.
- Converted the React starter from JSX to strict TypeScript/TSX.
- Added TypeScript type checking to the frontend build and lint configuration.
- Retained Tailwind CSS 4 with its Vite plugin and CSS import.
- Removed the unused React Compiler/Babel plugin setup.
- Replaced generated starter screen and metadata with JBStock branding.
- Added a repository-root `.gitignore`.

Verification:

- `mvn -q -DskipTests package` passed with installed Maven 3.9.9.
- `npm run lint` passed.
- `npm run build` passed TypeScript compilation but Vite bundling was blocked by sandbox `spawn EPERM` and an unloadable Tailwind Windows native binding in `node_modules`.

After Step 1 is approved:

- fix dependency/configuration problems;
- confirm Java 21;
- ensure frontend uses TypeScript;
- complete Tailwind configuration;
- ensure both projects build independently.

---

# Step 3 — SQLite

STATUS: NEXT

Configure:

- SQLite JDBC;
- database path strategy;
- JPA/Hibernate compatibility;
- foreign keys;
- WAL;
- busy timeout.

Do not create business entities yet.

---

# Step 4 — Flyway

STATUS: PENDING

Configure Flyway.

Create only the minimum initial migration necessary to prove database migrations work.

Do not create the complete business schema yet.

---

# Step 5 — Backend Runtime

STATUS: PENDING

Configure Spring Boot to:

- bind to `127.0.0.1`;
- start reliably;
- expose a health check;
- connect successfully to SQLite;
- execute Flyway migrations.

---

# Step 6 — Backend Verification

STATUS: PENDING

Verify:

- `mvn test`;
- application startup;
- SQLite database creation;
- Flyway migration execution;
- health endpoint;
- clean shutdown.

---

# Step 7 — Frontend Foundation

STATUS: PENDING

Verify:

- React + Vite startup;
- TypeScript;
- Tailwind CSS;
- clean initial structure;
- production build.

Do not design the complete JBStock UI yet.

---

# Step 8 — Frontend ↔ Backend

STATUS: PENDING

Implement the smallest possible connectivity test.

React should call the local backend health endpoint.

Expected result:

Frontend
↓
Spring Boot
↓
healthy

Do not implement authentication or business APIs yet.

---

# Step 9 — Foundation Checkpoint

STATUS: PENDING

Before starting business functionality:

- backend builds;
- frontend builds;
- tests pass;
- SQLite works;
- Flyway works;
- health endpoint works;
- frontend/backend communication works;
- documentation reflects the actual state;
- create a Git checkpoint/commit.

Only then proceed to Phase 2.

---

# Explicitly Out of Scope

Do NOT implement yet:

- company onboarding;
- authentication;
- users/roles;
- products;
- categories;
- brands;
- images;
- stock;
- customers;
- suppliers;
- sales;
- purchases;
- invoices;
- audit log;
- backup system;
- Google Drive;
- licensing;
- Electron;
- MSIX;
- Microsoft Store integration.

---

# Working Rule

Only work on the current step.

Do not automatically proceed through all pending steps.

At the end of each completed step:

1. run relevant tests/builds;
2. summarize modifications;
3. update this file;
4. clearly identify the next step;
5. stop if the next step represents a new meaningful implementation task.
