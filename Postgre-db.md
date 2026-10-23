Searched for "pgTable"

Here is a collection of **ready-to-copy one-liner queries** you can run directly from your VPS terminal using `kubectl exec`:

---

### 1. Table Overview & Row Counts

#### A. List All Tables in the Database
```bash
kubectl exec -n tracelytag deployment/tracelytag-postgres -- psql -U tracelytag -d tracelytag -c "\dt"
```

#### B. See Row Counts for Every Table at Once
```bash
kubectl exec -n tracelytag deployment/tracelytag-postgres -- psql -U tracelytag -d tracelytag -c "
SELECT relname AS table_name, n_live_tup AS row_count 
FROM pg_stat_user_tables 
ORDER BY n_live_tup DESC;"
```

#### C. See Table Disk Sizes (Which tables take the most space)
```bash
kubectl exec -n tracelytag deployment/tracelytag-postgres -- psql -U tracelytag -d tracelytag -c "
SELECT relname AS table_name, 
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_catalog.pg_statio_user_tables 
ORDER BY pg_total_relation_size(relid) DESC;"
```

---

### 2. Inspect TracelyTag Application Tables

#### View Users
```bash
kubectl exec -n tracelytag deployment/tracelytag-postgres -- psql -U tracelytag -d tracelytag -c "SELECT id, username, email, role, company_id, created_at FROM users LIMIT 10;"
```

#### View Companies / Tenants
```bash
kubectl exec -n tracelytag deployment/tracelytag-postgres -- psql -U tracelytag -d tracelytag -c "SELECT id, name, created_at FROM companies LIMIT 10;"
```

#### View Products
```bash
kubectl exec -n tracelytag deployment/tracelytag-postgres -- psql -U tracelytag -d tracelytag -c "SELECT id, name, sku, company_id, gtin, price FROM products LIMIT 10;"
```

#### View Batches
```bash
kubectl exec -n tracelytag deployment/tracelytag-postgres -- psql -U tracelytag -d tracelytag -c "SELECT id, batch_number, product_id, status, quantity, created_at FROM batches LIMIT 10;"
```

#### View Generated Codes / Tags
```bash
kubectl exec -n tracelytag deployment/tracelytag-postgres -- psql -U tracelytag -d tracelytag -c "SELECT id, code, batch_id, status, is_activated, created_at FROM codes LIMIT 10;"
```

#### View Customer Scan Events
```bash
kubectl exec -n tracelytag deployment/tracelytag-postgres -- psql -U tracelytag -d tracelytag -c "SELECT id, code_id, location, ip_address, scanned_at FROM customer_scans ORDER BY id DESC LIMIT 10;"
```

#### View System Configuration
```bash
kubectl exec -n tracelytag deployment/tracelytag-postgres -- psql -U tracelytag -d tracelytag -c "SELECT key, value FROM system_configs;"
```

---

### 3. Inspect Table Structure (Columns & Types)

To view the columns, data types, and nullability of any table (e.g. `users`):

```bash
kubectl exec -n tracelytag deployment/tracelytag-postgres -- psql -U tracelytag -d tracelytag -c "\d users"
```
*(Replace `users` with `products`, `batches`, `codes`, etc.)*

---

### 4. Custom Ad-Hoc Query

To run any custom SQL statement, simply put your SQL inside the quotes:
```bash
kubectl exec -n tracelytag deployment/tracelytag-postgres -- psql -U tracelytag -d tracelytag -c "<YOUR_SQL_HERE>"
```