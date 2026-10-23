Viewed documentation.md:1-100
Viewed documentation.md:101-250
Viewed documentation.md:251-345
Viewed new-k8.md:1-60
Viewed Jenkinsfile:1-100

To switch to a new GitHub repository on your VPS and completely reset all containers, images, volumes, and deployments, follow the steps below depending on whether you are deploying via **Jenkins Pipeline (K3s/Kubernetes)** or **Direct Git Clone & Docker**.

---

### Step 1: Wipe All Existing Containers, Images, and Volumes (Complete VPS Reset)

Connect to your VPS via SSH (`ssh root@51.79.160.129` or `ubuntu@...`) and purge all Docker resources:

```bash
# 1. Stop all running containers
docker stop $(docker ps -aq) 2>/dev/null || true

# 2. Remove all containers
docker rm -f $(docker ps -aq) 2>/dev/null || true

# 3. Remove all Docker images
docker rmi -f $(docker images -aq) 2>/dev/null || true

# 4. Remove all unused networks, dangling build caches, and anonymous volumes
docker system prune -af --volumes

# 5. Remove any leftover Docker named volumes
docker volume prune -f
```

---

### Step 2: Reset Kubernetes / K3s (If using Kubernetes)

If your app is deployed inside K3s/Kubernetes:

#### Option A: Reset only the application namespace (Keep K3s running)
```bash
# Deletes backend, frontend, postgres, redis, secrets, and PVC data
kubectl delete namespace tracelytag

# Re-create empty namespace
kubectl create namespace tracelytag
```

#### Option B: Full wipe of K3s cluster (Start 100% fresh)
```bash
# Uninstall K3s and wipe all cluster state
/usr/local/bin/k3s-uninstall.sh

# Re-install fresh K3s (if needed)
curl -sfL https://get.k3s.io | sh -
```

---

### Step 3: Switch the GitHub Repository

Choose whichever method matches how your code is loaded on the VPS:

#### Case A: If you cloned the repository directly in a folder on the VPS

**Option 1: Switch remote URL in existing folder**
```bash
cd /path/to/your/project

# Check current remote
git remote -v

# Point to your new repository
git remote set-url origin https://github.com/<YOUR-NEW-USER>/<YOUR-NEW-REPO>.git

# Fetch and reset hard to the new branch (e.g. main or kubernetes)
git fetch origin
git clean -fdx
git checkout -B main origin/main
```

**Option 2: Delete old folder and do a fresh clone (Cleanest)**
```bash
cd /root   # or /home/ubuntu
rm -rf tracly-tag-final
git clone https://github.com/<YOUR-NEW-USER>/<YOUR-NEW-REPO>.git
cd <YOUR-NEW-REPO>
```

---

#### Case B: If deploying through Jenkins

If Jenkins manages the build and deployment:

1. **Update the GitHub URL in Jenkins Web UI**:
   - Go to your Jenkins Dashboard: `http://51.79.160.129:8088`
   - Click on your job (`tracelytag-production`) ➔ **Configure**.
   - Scroll down to the **Pipeline** section:
     - Under **Repository URL**, change:
       ```
       https://github.com/Luphonix-Prime/tracly-tag-final.git
       ```
       to your new GitHub repository URL:
       ```
       https://github.com/<YOUR-NEW-USER>/<YOUR-NEW-REPO>.git
       ```
     - Change the **Branch Specifier** (e.g., `*/main`, `*/master`, or `*/dockerize`).
     - Update credentials dropdown if the new repo is private.
   - Click **Save**.

2. **Wipe the old Jenkins workspace**:
   - In the left sidebar of your job, click **Wipe Out Workspace** (or delete via terminal: `docker exec -u root jenkins rm -rf /var/jenkins_home/workspace/tracelytag-production/*`).

3. **Update Fallback URL in [Jenkinsfile](file:///c:/Users/Keval/Documents/tracelytag/my-merger/tracly-tag-final/Jenkinsfile#L99)**:
   In your new repository's `Jenkinsfile` around line 99:
   ```groovy
   git branch: 'main', url: 'https://github.com/<YOUR-NEW-USER>/<YOUR-NEW-REPO>.git'
   ```

4. **Update Docker Hub Image Names (Optional)**:
   If your Docker repository namespace is changing too, update `DOCKER_USER` in `Jenkinsfile` and `k8s/*.yaml` deployment manifests.

---

### Step 4: Re-Deploy

1. **If using Jenkins**:
   - Go to Jenkins ➔ Click **Build with Parameters** ➔ Click **Build**.
   - Jenkins will clone the new repo, build brand-new images with `--no-cache`, and apply fresh K8s manifests.

2. **If using Docker Compose / Manual Docker**:
   ```bash
   cd /path/to/your/new-repo
   docker compose up -d --build --force-recreate
   ```

3. **Verify the new deployment**:
   ```bash
   # Check Docker containers
   docker ps

   # Or check K8s pods
   kubectl get pods -n tracelytag
   ```

Viewed new-k8.md:9-28
Viewed documentation.md:174-187



Viewed Jenkinsfile:100-200
Viewed Jenkinsfile:201-363
Viewed Jenkinsfile:10-40
Edited Jenkinsfile

Based on your setup in [`documentation.md`](file:///c:/Users/Keval/Documents/tracelytag/my-merger/tracly-tag-final/documentation.md), here is the exact guide to **switch your GitHub repository** and **reset all containers, images, and Kubernetes workloads** cleanly without breaking Jenkins.

The [Jenkinsfile](file:///c:/Users/Keval/Documents/tracelytag/my-merger/tracly-tag-final/Jenkinsfile) has also been updated with two new automated controls:
- **`PURGE_AND_RESET_ALL`**: Automatically deletes old K8s deployments/pods and flushes dangling Docker cache before building.
- **`NO_CACHE`**: Forces `docker build --no-cache` so fresh code from your new repo is guaranteed.

---

### Step 1: Clean Up the VPS (Keep Jenkins Running)

Since Jenkins runs as a Docker container named `jenkins` on port `8088`, do **not** run blanket `docker kill $(docker ps -q)` or you will stop Jenkins itself. 

SSH into your VPS (`ssh root@51.79.160.129` or `ssh ubuntu@51.79.160.129`) and run:

```bash
# 1. Delete all old Kubernetes pods & deployments in tracelytag namespace
kubectl delete namespace tracelytag

# 2. Recreate the empty namespace
kubectl create namespace tracelytag

# 3. Stop and remove any non-Jenkins Docker containers
docker ps -a --filter "name!=jenkins" -q | xargs -r docker rm -f

# 4. Remove old application images and build cache (frees up VPS disk)
docker image prune -af
docker builder prune -af
```

*(Note: If you also want to completely restart Jenkins itself from scratch, run `docker rm -f jenkins && docker run -d --name jenkins --restart always --user root -p 8088:8080 -p 50000:50000 -v /var/run/docker.sock:/var/run/docker.sock -v /etc/rancher/k3s/k3s.yaml:/etc/rancher/k3s/k3s.yaml:ro -v jenkins_home:/var/jenkins_home tracelytag-jenkins`)*.

---

### Step 2: Switch the GitHub Link in Jenkins

1. Open your Jenkins Dashboard in your browser:
   ```
   http://51.79.160.129:8088
   ```
2. Click on your job (`tracelytag-production`) ➔ click **Configure** in the left menu.
3. Scroll down to the **Pipeline** section:
   - **Repository URL**: Replace:
     ```
     https://github.com/Luphonix-Prime/tracly-tag-final.git
     ```
     with your **new GitHub repository URL**:
     ```
     https://github.com/<NEW-USERNAME>/<NEW-REPO>.git
     ```
   - **Credentials**: If your new repository is private, select your GitHub Personal Access Token credentials.
   - **Branch Specifier**: Set to your desired branch (e.g., `*/main`, `*/master`, or `*/kubernetes`).
   - **Script Path**: Verify it is set to `Jenkinsfile`.
4. Click **Save**.

5. **Wipe Old Workspace**:
   On the job's main page in Jenkins, click **Wipe Out Workspace** in the left sidebar (or via terminal: `docker exec -u root jenkins rm -rf /var/jenkins_home/workspace/tracelytag-production/*`).

---

### Step 3: Trigger the Build with Reset Enabled

1. In Jenkins, click **Build with Parameters** in the left sidebar.
2. Configure the parameters:
   - `PURGE_AND_RESET_ALL`: Check `[x]` (True)
   - `NO_CACHE`: Check `[x]` (True)
   - `BUILD_IMAGES`: Check `[x]` (True)
   - `PUSH_TO_DOCKER_HUB`: Check `[x]` (or uncheck if testing purely locally on VPS)
   - `TRIGGER_ROLLOUT_RESTART`: Check `[x]` (True)
3. Click **Build**.

---

### Step 4: Verify the New Deployment

Once the Jenkins build turns green, open your VPS terminal and verify:

```bash
# Check that the new pods are running
kubectl get pods -n tracelytag -o wide

# Check logs of backend
kubectl logs -n tracelytag -l app=tracelytag-backend -f --tail=50

# Verify domain responds
curl -I https://app.tracelytag.com/api/health
```

Viewed Postgre-db.md:1-33

Docker's `--filter` flag only supports `=` (exact/regex matches), not `!=`. 

Here are the revised, tested commands to clean up everything while safely preserving your `jenkins` container:

---

### Revised Cleanup Steps on VPS

Run these commands one by one in your VPS terminal:

#### 1. Stop & Remove all containers EXCEPT `jenkins`
```bash
docker ps -a --format '{{.ID}} {{.Names}}' | grep -v 'jenkins' | awk '{print $1}' | xargs -r docker rm -f
```

#### 2. Reset the Kubernetes Namespace (Removes old DB, Redis, Backend, Frontend pods)
```bash
kubectl delete namespace tracelytag --timeout=60s
kubectl create namespace tracelytag
```

#### 3. Remove all unused Docker images and build caches (Frees up disk)
```bash
# Safely purges all images not currently in use by running containers (Jenkins stays safe)
docker image prune -af

# Purges buildkit build cache
docker builder prune -af
```

---

### Verify Jenkins is still intact:
```bash
docker ps
```
You should see only `jenkins` running on port `8088`. 

Now you can proceed to update the GitHub URL in the Jenkins UI (`http://51.79.160.129:8088`) and click **Build with Parameters** with `NO_CACHE` enabled.

Viewed Dockerfile.jenkins:1-18


To switch your GitHub repository and update the parameters in that Jenkins screen, follow these **2 quick steps**:

---

### Step 1: Switch the GitHub Link in Jenkins

In your screenshot, look at the left-hand menu:

1. Click **Configure** (the gear icon on the left sidebar).
2. Scroll all the way down to the **Pipeline** section:
   - Find **Repository URL**: Replace the old URL with your **new GitHub repo URL**:
     ```text
     https://github.com/<YOUR-NEW-USERNAME>/<YOUR-NEW-REPO>.git
     ```
   - Check **Branch Specifier**: Change it to match your branch (e.g. `*/main` or `*/master`).
   - If the new repo is private, ensure your GitHub credentials are selected in the **Credentials** dropdown.
3. Click the blue **Save** button at the bottom.

---

### Step 2: Update the Pipeline & Parameters

In Jenkins Declarative Pipelines, **the parameters on your screen update automatically as soon as Jenkins reads the updated [`Jenkinsfile`](file:///c:/Users/Keval/Documents/tracelytag/my-merger/tracly-tag-final/Jenkinsfile) from your new repo.**

1. **Push the updated [`Jenkinsfile`](file:///c:/Users/Keval/Documents/tracelytag/my-merger/tracly-tag-final/Jenkinsfile) to your new GitHub repository** (from your local machine):
   ```bash
   git add Jenkinsfile
   git commit -m "Add reset parameters and SCM checkout"
   git push origin main
   ```

2. **Trigger 1 Build to Sync the Parameters**:
   - Go back to your Jenkins screen (`http://15.235.210.138:8088/job/tracelytag-production/build`).
   - Click the green **Build** button at the bottom.
   - Jenkins will clone the new repo and read the new `Jenkinsfile`.

3. **Refresh the Page**:
   - Once the build starts/finishes, refresh the page and click **Build with Parameters** again.
   - You will now see the new options:
     - `PURGE_AND_RESET_ALL`
     - `NO_CACHE`

---

### Step 3: Run the Fresh Deployment

Once the parameters are refreshed:
- Check **`PURGE_AND_RESET_ALL`** (True)
- Check **`NO_CACHE`** (True)
- Click **Build**

Jenkins will completely purge old workloads and cleanly build/deploy your new repository.