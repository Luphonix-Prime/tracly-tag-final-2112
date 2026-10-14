@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo        TracelyTag Kubernetes Deployment Runner
echo ========================================================

echo [1/6] Verifying cluster connection...
kubectl cluster-info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Cannot connect to Kubernetes cluster!
    echo Please ensure either:
    echo   1. Docker Desktop -^> Settings -^> Kubernetes -^> 'Enable Kubernetes' is checked.
    echo   2. Or your cloud cluster context is active in kubectl.
    exit /b 1
)

echo [2/6] Applying namespace and secrets...
kubectl apply -f k8s\00-namespace.yaml
kubectl apply -f k8s\01-configmap-secrets.yaml

echo [3/6] Deploying infrastructure dependencies (PostgreSQL, PgBouncer, Redis)...
kubectl apply -f k8s\01b-postgres.yaml
kubectl apply -f k8s\02-pgbouncer.yaml
kubectl apply -f k8s\03-redis.yaml

echo [4/6] Deploying Application Services (Backend API ^& Frontend Nginx)...
kubectl apply -f k8s\04-backend-deployment.yaml
kubectl apply -f k8s\05-frontend-deployment.yaml

echo [5/7] Deploying Ingress and Horizontal Pod Autoscaler (HPA)...
kubectl apply -f k8s\06-ingress.yaml
kubectl apply -f k8s\07-hpa.yaml

echo [6/7] Deploying Recurring CronJobs and Maintenance Jobs...
kubectl apply -f k8s\08-cronjob-db-backup.yaml
kubectl apply -f k8s\09-job-db-verify.yaml

echo [7/7] Fetching deployment status...
timeout /t 3 >nul
kubectl get pods -n tracelytag -o wide
echo.
kubectl get svc -n tracelytag
echo.
echo ========================================================
echo Kubernetes deployment applied successfully!
echo To monitor pods live: kubectl get pods -n tracelytag -w
echo ========================================================
pause
