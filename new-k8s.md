Ran command: `kubectl version --client; kubectl config get-contexts`
Ran command: `kubectl get nodes`
Ran command: `docker info`
Ran command: `Get-Command minikube, kind, k3d -ErrorAction SilentlyContinue`
Ran command: `docker ps`
Ran command: `docker images | Select-String "tracly-tag"`
Edited 04-backend-deployment.yaml
Edited 05-frontend-deployment.yaml
Created 01b-postgres.yaml
Ran command: `Get-Command winget, choco, curl -ErrorAction SilentlyContinue`
Ran command: `Get-Content -Path "$env:APPDATA\Docker\settings.json" -Raw | Select-String "kubernetes"`
Ran command: `wsl -l -v`
Ran command: `winget search kind --source winget`
Ran command: `Get-ChildItem -Path k8s -File | Select-Object Name`
Created deploy-k8s.bat
Ran command: `.\deploy-k8s.bat`
Ran command: `kubectl apply --dry-run=client -f k8s/`
Ran command: `kubectl apply --validate=false --dry-run=client -f k8s/`

All the manifests and deployment scripts are ready.

When connecting to your local Kubernetes context (`docker-desktop`), the connection was refused because **Kubernetes is currently disabled in your Docker Desktop settings**.

---

### Step 1: Enable Kubernetes in Docker Desktop (1 minute)

1. Open the **Docker Desktop** application on your desktop.
2. Click the **⚙️ Settings (Gear icon)** in the top right.
3. Click **Kubernetes** in the left sidebar.
4. Check the box **"Enable Kubernetes"**.
5. Click **"Apply & restart"** at the bottom right.
6. Wait ~30–60 seconds until the bottom-left icon in Docker Desktop shows both **Docker** and **Kubernetes** as green.

---

### Step 2: Run the Deployment

Once Docker Desktop shows Kubernetes is running, run:

```powershell
.\deploy-k8s.bat
```

Or run the kubectl commands directly:

```bash
# 1. Create the TracelyTag namespace and environment secrets
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-configmap-secrets.yaml

# 2. Deploy database infrastructure (Postgres, PgBouncer pooler, Redis)
kubectl apply -f k8s/01b-postgres.yaml
kubectl apply -f k8s/02-pgbouncer.yaml
kubectl apply -f k8s/03-redis.yaml

# 3. Deploy the application pods (Backend API & Frontend Nginx)
kubectl apply -f k8s/04-backend-deployment.yaml
kubectl apply -f k8s/05-frontend-deployment.yaml

# 4. Deploy Ingress routing and Horizontal Pod Autoscaler (HPA)
kubectl apply -f k8s/06-ingress.yaml
kubectl apply -f k8s/07-hpa.yaml
```

---

### Step 3: Verify the Running Pods

Check your running cluster:
```powershell
kubectl get pods -n tracelytag -o wide
```

You will see:
- `tracelytag-postgres-xxx` (1/1 Running)
- `tracelytag-pgbouncer-xxx` (1/1 Running)
- `tracelytag-redis-xxx` (1/1 Running)
- `tracelytag-backend-xxx` (3/3 replicas running with health probes)
- `tracelytag-frontend-xxx` (2/2 replicas running)

Enable Kubernetes in Docker Desktop now, and let me know as soon as it's enabled so we can verify the pods together!