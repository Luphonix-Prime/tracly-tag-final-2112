# Database Architecture and Operations Guide

This guide covers PostgreSQL database setup, Docker containerization, operations (resetting, seeding, database studio), safe migrations, and backup/restore guidelines for TraclyTag.

---

## 📂 Core Structure

TraclyTag uses **PostgreSQL 18** (`postgres:18-alpine`) with **Drizzle ORM** (`pg` / `node-postgres`) for its database layer. The configuration and schemas are centralized in the database workspace (`lib/db`), while the backend API server (`artifacts/api-server`) connects via connection pooling.

* **Database Schemas & Drizzle Config**: Located at [`lib/db/`](file:///c:/Users/Keval/Documents/tracelytag/my-merger/tracly-tag-final/lib/db)
* **SQL Migrations**: Located at [`lib/db/drizzle/`](file:///c:/Users/Keval/Documents/tracelytag/my-merger/tracly-tag-final/lib/db/drizzle)
* **Client / Pool Provider**: [`lib/db/src/index.ts`](file:///c:/Users/Keval/Documents/tracelytag/my-merger/tracly-tag-final/lib/db/src/index.ts)
* **Seeding Logic**: Located at [`artifacts/api-server/scratch/check_db.ts`](file:///c:/Users/Keval/Documents/tracelytag/my-merger/tracly-tag-final/artifacts/api-server/scratch/check_db.ts) and [`artifacts/api-server/src/lib/db-reset.ts`](file:///c:/Users/Keval/Documents/tracelytag/my-merger/tracly-tag-final/artifacts/api-server/src/lib/db-reset.ts)

---

## 🐳 Docker Architecture & Isolation

### 1. Database Service Definition (`docker-compose.yml`)
The PostgreSQL database is defined as the core service (`db`) within Docker Compose:

```yaml
services:
  db:
    image: postgres:18-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-tracelytag}
      POSTGRES_USER: ${POSTGRES_USER:-tracelytag}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-tracelytag_secret_2026}
    volumes:
      - tracelytag-postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-tracelytag} -d ${POSTGRES_DB:-tracelytag}"]
      interval: 5s
      timeout: 5s
      retries: 20
```

### 2. Network Isolation & Security
- The production `db` container communicates strictly within Docker's internal private bridge network with the application container (`app`).
- Host port `5432` is not exposed in production `docker-compose.yml`, eliminating external exposure and attack vectors.
- For local host development, use `docker-compose.dev.yml` to bind port 5432 to the host.

### 3. Service Health & Dependency Chain
The application service explicitly waits for the database health probe:
```yaml
depends_on:
  db:
    condition: service_healthy
```
This guarantees the Node.js API server never boots or attempts connections until PostgreSQL is ready to accept queries.

---

## 🛠️ Development Operations

### 1. Starting Local Development Database
To spin up a local PostgreSQL container with port 5432 exposed:
```bash
docker compose -f docker-compose.dev.yml up -d
```

### 2. Resetting & Seeding Mock Data
To truncate tables and seed mock companies, users, products, batches, codes, and scans:
```bash
pnpm db:seed
```

> [!IMPORTANT]  
> Default mock operator logins:
> * **Super Master Admin**: `supermaster` / `kp_dk@2026`
> * **Master Admin**: `master` / `master123`
> * **Client Admin**: `demo_admin` / `admin123`
> * **Operator**: `demo_op` / `op123`

### 3. Viewing Database (Drizzle Studio)
Launch Drizzle Studio web console at `http://localhost:4983`:
```bash
pnpm db:studio
```

### 4. Pushing Schema Changes
```bash
# Push schema updates directly
pnpm --filter @workspace/db run push

# Or run the Windows batch script:
push-db.bat
```

### 5. Generating & Applying Migrations
```bash
# Generate SQL migration diffs in lib/db/drizzle/
pnpm --filter @workspace/db run generate

# Apply pending SQL migrations
pnpm --filter @workspace/db run migrate
```

---

## 🛡️ Atomic Backup & Guarded Restore

### 1. Atomic Snapshot Backup (`backup-db.bat` / `backup-db.sh`)
- Pauses application container to prevent split-brain writes.
- Executes `pg_dump` with custom binary format (`--format=custom`).
- Computes SHA256 checksum stored in `backups/tracelytag_<timestamp>.backup.sha256`.
- Restarts application container automatically.

```cmd
:: Run Windows Backup
backup-db.bat

# Run Linux Backup
./backup-db.sh
```

### 2. Guarded Database Recovery (`restore-db.bat` / `restore-db.sh`)
- Requires typing `RESTORE` confirmation.
- Spins up `db` container, drops/recreates target database, and runs `pg_restore`.
- Restarts application container automatically.

```cmd
:: Run Windows Recovery
restore-db.bat backups\tracelytag_20261010_120000.backup

# Run Linux Recovery
./restore-db.sh backups/tracelytag_20261010_120000.backup
```
