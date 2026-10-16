# TracelyTag — OVH Ubuntu VPS & Jenkins Deployment Guide

This documentation provides the complete, end-to-end guide on **which files to deploy** to your OVH Ubuntu VPS and **how to set up Jenkins** to automatically build, test, and deploy the TracelyTag system using Kubernetes (K3s).

---

## 1. Architecture Overview

```
                      [ Developer / Git Push ]
                                 │
                                 ▼
                     [ GitHub / Git Repository ]
                                 │ (Webhook / Poll SCM)
                                 ▼
         ┌──────────────────────────────────────────────────┐
         │          OVH Ubuntu VPS (51.79.160.129)          │
         │                                                  │
         │   ┌──────────────────────────────────────────┐   │
         │   │            Jenkins CI/CD Agent           │   │
         │   │   • Reads Jenkinsfile                    │   │
         │   │   • Builds Dockerfile.backend & frontend │   │
         │   │   • Pushes images to Docker Hub          │   │
         │   │   • Executes kubectl rollout on cluster  │   │
         │   └────────────────────┬─────────────────────┘   │
         │                        │                         │
         │                        ▼                         │
         │   ┌──────────────────────────────────────────┐   │
         │   │          K3s Lightweight Cluster         │   │
         │   │   • Ingress Controller (Traefik/Nginx)   │   │
         │   │   • Frontend Pods (Nginx Web UI)         │   │
         │   │   • Backend Pods (Node.js API)           │   │
         │   │   • PostgreSQL & PgBouncer Pooler        │   │
         │   │   • Redis Cache & Rate Limiter           │   │
         │   └──────────────────────────────────────────┘   │
         └──────────────────────────────────────────────────┘
                                 ▲
                                 │ HTTPS (Port 80/443)
                    https://app.tracelytag.com
```

---

## 2. Which Files Should Be Deployed?

When using Jenkins on the VPS, **you do not manually copy or FTP files** to the server. Jenkins pulls your code directly from your Git repository (`git clone` / SCM).

Here is the exact breakdown of essential files vs. ignored files:

### A. Essential Files (Must Be In Git)

| Category | Files / Directories | Purpose |
| :--- | :--- | :--- |
| **CI/CD Pipeline** | `Jenkinsfile` | Complete declarative pipeline for build, test & K8s rollout |
| **Jenkins Runner** | `Dockerfile.jenkins` | Custom Jenkins container with Docker and kubectl pre-installed |
| **Microservice Builds** | `Dockerfile.backend`, `Dockerfile.frontend` | Multi-stage production container build definitions |
| **Web Server Config** | `nginx-frontend.conf` | Frontend reverse-proxy and client-side routing config |
| **Kubernetes Specs** | `k8s/` (All manifests `00` through `09`) | Production DB, Cache, Backend, Frontend, Ingress, and HPA |
| **Workspace Config** | `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig*.json` | Monorepo dependency and TypeScript build config |
| **Application Source** | `artifacts/api-server/`, `artifacts/traclytag/`, `lib/`, `scripts/` | Backend API, Frontend React UI, shared DB schemas, and utilities |

### B. Files Excluded From Git & VPS (Handled Automatically)

| Category | Files | Why Excluded |
| :--- | :--- | :--- |
| **Local Dependencies** | `node_modules/` | Installed fresh inside Docker builder stages |
| **Windows Scripts** | `*.bat` | Only used for local Windows development |
| **Local Cache & Logs** | `dist/`, `tmp/`, `*.tsbuildinfo`, `terminal_logs/` | Generated dynamically at build time |
| **Sensitive Host Secrets** | Plaintext production passwords in `.env` | Handled securely via Jenkins Credentials and `k8s/01-configmap-secrets.yaml` |

---

## 3. Prerequisites on OVH Ubuntu VPS

Connect to your OVH VPS via SSH:
```bash
ssh ubuntu@51.79.160.129
# Or if root:
ssh root@51.79.160.129
```

### Step 1: Update System Packages & Install Utilities
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git apt-transport-https ca-certificates gnupg lsb-release
```

### Step 2: Install Docker Engine
```bash
# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable and start Docker service
sudo systemctl enable --now docker
```

### Step 3: Install K3s Lightweight Kubernetes
K3s is the ideal production Kubernetes runtime for an OVH VPS (uses <512MB RAM):
```bash
# Install K3s with Traefik ingress controller enabled
curl -sfL https://get.k3s.io | sh -

# Verify K3s is running
sudo kubectl get nodes
```

Configure kubeconfig for standard user access:
```bash
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown -R $(id -u):$(id -g) ~/.kube
sudo chmod 600 ~/.kube/config

# Verify cluster connectivity
kubectl get nodes
```

---

## 4. Setting Up Jenkins on OVH VPS

You can install Jenkins in one of two recommended ways:

### Option A: Native Ubuntu Installation (Recommended for direct Docker/K3s access)

#### 1. Install Java 17 (Required by Jenkins)
```bash
sudo apt install -y openjdk-17-jdk
java -version
```

#### 2. Install Jenkins
```bash
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | sudo tee \
  /usr/share/keyrings/jenkins-keyring.asc > /dev/null

echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/ | sudo tee \
  /etc/apt/sources.list.d/jenkins.list > /dev/null

sudo apt update
sudo apt install -y jenkins

sudo systemctl enable --now jenkins
```

#### 3. Grant Jenkins Permissions to Docker and K3s
```bash
# Allow Jenkins to run docker commands
sudo usermod -aG docker jenkins

# Allow Jenkins user to read K3s kubeconfig
sudo chmod 644 /etc/rancher/k3s/k3s.yaml

# Restart Jenkins to apply group membership
sudo systemctl restart jenkins
```

---

### Option B: Containerized Jenkins via `Dockerfile.jenkins` (Runs on Port 8088)

Running Jenkins on port **8088** leaves ports **80**, **443**, and **8080** entirely free for the main TracelyTag production application and ingress traffic:

```bash
# 1. Open port 8088 in VPS firewall (if UFW is enabled)
sudo ufw allow 8088/tcp
sudo ufw allow 50000/tcp

# 2. Build the Jenkins image containing Docker & Kubectl
docker build -t tracelytag-jenkins -f Dockerfile.jenkins .

# 3. Launch Jenkins on dedicated port 8088
docker run -d \
  --name jenkins \
  --restart always \
  -p 8088:8080 \
  -p 50000:50000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /etc/rancher/k3s/k3s.yaml:/etc/rancher/k3s/k3s.yaml:ro \
  -v jenkins_home:/var/jenkins_home \
  tracelytag-jenkins
```

> [!NOTE]
> - **Jenkins UI**: Accessible at `http://51.79.160.129:8088`
> - **Main Application (TracelyTag)**: Accessible at `http://51.79.160.129` / `https://app.tracelytag.com` (ports 80 & 443, internal 8080)

---

## 5. Configuring Jenkins Web UI

### Step 1: Unlock Jenkins
Open your browser and navigate to:
```
http://51.79.160.129:8088
```
Retrieve the initial administrator password from the container:
```bash
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```
*(Or if running natively: `sudo cat /var/lib/jenkins/secrets/initialAdminPassword`)*


1. Paste the password and click **Continue**.
2. Click **Install suggested plugins**.
3. Create your Jenkins Admin user (e.g., `admin` / your password).

### Step 2: Install Additional Recommended Plugins
Navigate to **Manage Jenkins** ➔ **Plugins** ➔ **Available plugins** and install:
- **AnsiColor** (for colored terminal logs)
- **Docker Pipeline**
- **Git** (usually pre-installed)

### Step 3: Add Docker Hub Credentials
1. Go to **Manage Jenkins** ➔ **Credentials** ➔ **System** ➔ **Global credentials (unrestricted)**.
2. Click **Add Credentials**:
   - **Kind**: `Username with password`
   - **Scope**: `Global`
   - **Username**: `luphonixprime` (or your Docker Hub username)
   - **Password**: Your Docker Hub Access Token / Password
   - **ID**: `docker-hub-credentials` *(Must match the ID in Jenkinsfile)*
   - **Description**: `Docker Hub Credentials for TracelyTag`
3. Click **Create**.

### Step 4: Add GitHub Credentials (If Private Repository)
If your GitHub repository is private:
1. Add a second credential in the same menu:
   - **Kind**: `Username with password` or `SSH Username with private key`
   - **Username**: Your GitHub username
   - **Password**: Your GitHub Personal Access Token (classic `repo` scope)
   - **ID**: `github-credentials`

---

## 6. Creating and Running the Pipeline Job

### Step 1: Create Pipeline Job
1. Click **New Item** on Jenkins dashboard.
2. Enter item name: `tracelytag-production`.
3. Select **Pipeline** and click **OK**.

### Step 2: Configure Job Settings
1. Check **This project is parameterized** (parameters will auto-populate from `Jenkinsfile` on first run).
2. Under **Build Triggers**:
   - Check **GitHub hook trigger for GITScm polling** (for automatic builds on git push).
3. Under **Pipeline**:
   - **Definition**: Select `Pipeline script from SCM`
   - **SCM**: Select `Git`
   - **Repository URL**: `https://github.com/Luphonix-Prime/tracly-tag-final.git`
   - **Credentials**: Select your GitHub credentials (if repo is private)
   - **Branch Specifier**: `*/kubernetes` (or `*/main` / `*/dockerize`)
   - **Script Path**: `Jenkinsfile`
4. Click **Save**.

### Step 3: Run the First Build
1. Click **Build with Parameters** in the left sidebar.
2. Parameters available:
   - `DOCKER_USER`: `luphonixprime`
   - `IMAGE_TAG`: (leave blank for auto-generated `build-${BUILD_NUMBER}`)
   - `NAMESPACE`: `tracelytag`
   - `BUILD_IMAGES`: `true`
   - `PUSH_TO_DOCKER_HUB`: `true`
   - `AUTO_BOOTSTRAP_K3S`: `true`
   - `TRIGGER_ROLLOUT_RESTART`: `true`
3. Click **Build**.

---

## 7. Verifying Deployment on the VPS

Once the Jenkins build completes successfully, verify the deployment in the VPS terminal:

### 1. Check Running Pods
```bash
kubectl get pods -n tracelytag -o wide
```
*Expected Output:*
```
NAME                                   READY   STATUS    RESTARTS   AGE
tracelytag-postgres-7b8976986-xxxxx    1/1     Running   0          5m
tracelytag-pgbouncer-57cd9c768-xxxxx   1/1     Running   0          5m
tracelytag-redis-5b4cf5c49b-xxxxx      1/1     Running   0          5m
tracelytag-backend-67756fbc8-xxxxx     1/1     Running   0          2m
tracelytag-backend-67756fbc8-yyyyy     1/1     Running   0          2m
tracelytag-backend-67756fbc8-zzzzz     1/1     Running   0          2m
tracelytag-frontend-8f85f8cf-aaaaa     1/1     Running   0          2m
tracelytag-frontend-8f85f8cf-bbbbb     1/1     Running   0          2m
```

### 2. Check Services and Ports
```bash
kubectl get svc -n tracelytag
```

### 3. Check Ingress Routing
```bash
kubectl get ingress -n tracelytag
```
*Expected Ingress:*
```
NAME                CLASS   HOSTS                               ADDRESS         PORTS     AGE
tracelytag-ingress  nginx   app.tracelytag.com, *.tracelytag.com 51.79.160.129   80, 443   5m
```

### 4. Test Live Web & API Access
```bash
# Internal health check
curl -I http://127.0.0.1/api/health

# Public domain check
curl -I https://app.tracelytag.com/api/health
```

---

## 8. Troubleshooting & Maintenance Commands

| Action | Command |
| :--- | :--- |
| **Stream Backend Logs** | `kubectl logs -n tracelytag -l app=tracelytag-backend -f --tail=100` |
| **Stream Frontend Logs** | `kubectl logs -n tracelytag -l app=tracelytag-frontend -f --tail=100` |
| **Stream Postgres Logs** | `kubectl logs -n tracelytag -l app=tracelytag-postgres -f --tail=100` |
| **Trigger Manual Rollout** | `kubectl rollout restart deployment/tracelytag-backend -n tracelytag` |
| **Rollback Deployment** | `kubectl rollout undo deployment/tracelytag-backend -n tracelytag` |
| **Watch Pods in Real-Time** | `kubectl get pods -n tracelytag -w` |
| **Clean Docker Build Cache** | `docker system prune -af --volumes` |
| **Check Jenkins Logs** | `sudo journalctl -u jenkins -f` (or `docker logs -f jenkins`) |
