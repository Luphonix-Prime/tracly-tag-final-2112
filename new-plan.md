
Here is a comprehensive, production-grade **system and architectural prompt** that explains exactly how PostgreSQL is implemented in your ERP system and how it is integrated into Docker.

You can copy and use this prompt with any AI or LLM (for onboarding, code review, documentation generation, or adding new features/infrastructure).

***

### 📋 The Prompt (Copy & Paste Ready)

```markdown
You are an expert full-stack software architect and DevOps specialist analyzing the database and containerization architecture of "My Style ERP" (a production-ready ERP system for Indian SMEs).

Below is the detailed specification of how PostgreSQL is implemented in our system and integrated within Docker:

---

### 1. Architectural Overview & Tech Stack
- **Database Engine**: PostgreSQL 18 (Image: `postgres:18-alpine` for minimal footprint and security).
- **Application Backend**: ASP.NET Core 10 / Entity Framework Core 10 (Npgsql PostgreSQL Provider).
- **Client Frontend**: Next.js 16 / React 19.
- **Data Model Paradigm**: Multi-tenant/company isolation, database-backed RBAC, immutable accounting registers (General Ledger, GST registers, inventory journals), and optimistic concurrency.

---

### 2. Docker Compose Integration (`docker-compose.yml`)
The PostgreSQL database is defined as the core service (`db`) within Docker Compose:

1. **Service Definition**:
   ```yaml
   services:
     db:
       image: postgres:18-alpine
       restart: unless-stopped
       environment:
         POSTGRES_DB: ${POSTGRES_DB}
         POSTGRES_USER: ${POSTGRES_USER}
         POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
       volumes:
         - erp-postgres:/var/lib/postgresql
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
         interval: 5s
         timeout: 5s
         retries: 20
   ```

2. **Network Isolation & Security**:
   - The `db` service does **not** expose port `5432` to the host machine by default.
   - It communicates exclusively within the private Docker internal bridge network with the `api` service.
   - This prevents unintended external exposure and limits attack vectors.

3. **Data Persistence**:
   - Persistent named volume: `erp-postgres` mapped to `/var/lib/postgresql`.
   - Preserves all database clusters and catalogs across container stop, start, and rebuild events.

4. **Service Health & Dependency Orchestration**:
   - The PostgreSQL container uses `pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}` as an active health check probe.
   - The API service declares an explicit dependency:
     ```yaml
     depends_on:
       db:
         condition: service_healthy
     ```
   - This guarantees the ASP.NET Core API never boots or attempts connections before PostgreSQL is ready to accept queries.

---

### 3. Application-Level Integration (ASP.NET Core & EF Core)

1. **Connection String Injection**:
   - Injected into the API container environment via Compose:
     `ConnectionStrings__Default: Host=db;Port=5432;Database=${POSTGRES_DB};Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD}`
   - Utilizes Docker internal DNS (`db`) to route traffic to the database container on port 5432.

2. **DbContext & Query Strategy**:
   - Configured in `Program.cs`:
     `builder.Services.AddDbContext<ErpDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Default"), n => n.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));`
   - Configured with `SplitQuery` to optimize relational loads across accounting document slices.

3. **Automatic Startup Migration & Bootstrapping**:
   - During API container startup (`Program.cs`), an asynchronous service scope is created:
     ```csharp
     await using (var scope = app.Services.CreateAsyncScope())
     {
         var db = scope.ServiceProvider.GetRequiredService<ErpDbContext>();
         await db.Database.MigrateAsync();
         await Bootstrap.Run(db, builder.Configuration);
     }
     ```
   - Automatically applies pending EF Core migrations on startup without manual CLI interventions.
   - Bootstraps initial system defaults and superuser roles if empty.

4. **End-to-End Health Checks**:
   - The API exposes a `/health` endpoint that queries PostgreSQL:
     ```csharp
     await db.Database.CanConnectAsync(ct)
     ```
   - Reports `{ status: "healthy", database: "connected" }` (HTTP 200) or HTTP 503 if the DB is unreachable.

---

### 4. Multi-Environment Isolation via Docker
The architecture supports three strictly segregated Docker Compose environments to prevent data leakage:

1. **Production / Main Instance** (`my-style-erp`):
   - Uses `.env` and volume `erp-postgres`.
2. **Automated Test Instance** (`my-style-erp-test`):
   - Project name: `my-style-erp-test`, uses `.env.test` and dedicated test volumes.
   - Binds to isolated ports (API: 5180, Web: 3100).
3. **Demo / Evaluation Instance** (`my-style-erp-demo`):
   - Project name: `my-style-erp-demo`, uses `.env.demo` and isolated demo volume.
   - Binds strictly to `127.0.0.1:3300`.
   - Controlled via `DEMO_SEED=true` to seed demo companies, GST masters, opening balances, and dummy ledger entries.

---

### 5. Dockerized Backup & Restore Operations

1. **Atomic Snapshot Backup (`Backup-ERP.bat`)**:
   - Temporarily pauses frontend/API containers (`docker compose stop api web`) to avoid split-brain writes during backup.
   - Executes non-blocking custom-format backup inside the container:
     ```cmd
     docker compose exec -T db pg_dump --username="%POSTGRES_USER%" --dbname="%POSTGRES_DB%" --format=custom --no-owner --no-privileges > backups/project-timestamp.backup
     ```
   - Pairs DB dump with attachment volume archive (`erp-files`) using an ephemeral Alpine container.
   - Generates SHA256 checksums for backup verification.
   - Restarts application containers automatically.

2. **Guarded Recovery (`Restore-ERP.bat`)**:
   - Enforces SHA256 integrity verification before execution.
   - Requires explicit confirmation (`RESTORE`).
   - Spins up only the `db` container (`docker compose up -d --wait db`).
   - Recreates target database using `dropdb` and `createdb` inside the container.
   - Restores schema and data via `pg_restore --exit-on-error < file.backup`.
   - Restores file attachments and starts API/Web containers with post-restore attachment verification (`Verify-Attachments.ps1`).

---

### Instructions for AI / LLM
When assisting with this codebase:
1. Always preserve the Docker healthcheck dependency chain (`api` waiting on `db: service_healthy`).
2. Maintain port isolation (do not expose port 5432 to the host network in production compose files unless explicitly requested for local debugging).
3. Ensure schema adjustments are made using EF Core migrations that run idempotently on startup.
4. Keep backup/restore scripts compatible with `postgres:18-alpine` CLI utilities (`pg_dump`, `pg_restore`, `dropdb`, `createdb`).
```

***

### 💡 How You Can Use This Prompt:
- **For generating technical documentation**: Ask an LLM to *"Generate an operational runbook based on this prompt."*
- **For implementing new features / migrations**: Provide this prompt as context before asking to add tables, relationships, or indexing.
- **For CI/CD & deployment**: Ask an LLM to *"Draft a GitHub Actions / Docker deploy workflow aligned with this architecture."*