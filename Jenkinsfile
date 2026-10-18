pipeline {
    agent any

    options {
        buildDiscarder(logRotator(numToKeepStr: '15'))
        disableConcurrentBuilds()
        timeout(time: 25, unit: 'MINUTES')
    }

    parameters {
        string(name: 'DOCKER_USER', defaultValue: 'luphonixprime', description: 'Docker Hub organization or username')
        string(name: 'IMAGE_TAG', defaultValue: '', description: 'Custom Image Tag (leave empty to use build-${BUILD_NUMBER})')
        string(name: 'NAMESPACE', defaultValue: 'tracelytag', description: 'Target Kubernetes namespace on OVH Ubuntu VPS')
        booleanParam(name: 'BUILD_IMAGES', defaultValue: true, description: 'Build Backend and Frontend Docker images')
        booleanParam(name: 'PUSH_TO_DOCKER_HUB', defaultValue: true, description: 'Push built images to Docker Hub')
        booleanParam(name: 'AUTO_BOOTSTRAP_K3S', defaultValue: true, description: 'Auto-install lightweight K3s cluster on VPS if not detected')
        booleanParam(name: 'TRIGGER_ROLLOUT_RESTART', defaultValue: true, description: 'Enforce zero-downtime rolling restart of microservices')
    }

    environment {
        DOCKER_USER = "${params.DOCKER_USER ?: 'luphonixprime'}"
        IMAGE_TAG = "${params.IMAGE_TAG?.trim() ? params.IMAGE_TAG.trim() : 'build-' + env.BUILD_NUMBER}"
        NAMESPACE = "${params.NAMESPACE ?: 'tracelytag'}"
        
        BACKEND_IMAGE = "${env.DOCKER_USER}/tracly-tag-final-backend:${env.IMAGE_TAG}"
        FRONTEND_IMAGE = "${env.DOCKER_USER}/tracly-tag-final-frontend:${env.IMAGE_TAG}"
        BACKEND_IMAGE_LATEST = "${env.DOCKER_USER}/tracly-tag-final-backend:latest"
        FRONTEND_IMAGE_LATEST = "${env.DOCKER_USER}/tracly-tag-final-frontend:latest"
        
        DOCKER_REGISTRY_CREDENTIALS_ID = 'docker-hub-credentials'
        K8S_DIR = 'k8s'
        PATH = "${WORKSPACE}/bin:${env.PATH}"
    }

    stages {
        stage('Prepare Tools & Environment') {
            steps {
                script {
                    echo "=========================================================="
                    echo "  TRACELYTAG CI/CD PIPELINE (OVH UBUNTU VPS KUBERNETES)  "
                    echo "=========================================================="
                    echo "  Build Number:      #${env.BUILD_NUMBER}"
                    echo "  Docker Hub User:   ${env.DOCKER_USER}"
                    echo "  Deployment Tag:    ${env.IMAGE_TAG}"
                    echo "  Backend Image:     ${env.BACKEND_IMAGE}"
                    echo "  Frontend Image:    ${env.FRONTEND_IMAGE}"
                    echo "  Target Namespace:  ${env.NAMESPACE}"
                    echo "----------------------------------------------------------"

                    sh '''
                        mkdir -p "${WORKSPACE}/bin"

                        # Ensure Docker CLI is available
                        if ! command -v docker >/dev/null 2>&1; then
                            echo "[*] Docker CLI not found in PATH. Fetching portable docker binary..."
                            curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-24.0.7.tgz -o /tmp/docker.tgz
                            tar -xzf /tmp/docker.tgz -C /tmp/
                            mv /tmp/docker/docker "${WORKSPACE}/bin/"
                            chmod +x "${WORKSPACE}/bin/docker"
                            rm -rf /tmp/docker.tgz /tmp/docker
                        fi

                        # Ensure kubectl is available
                        if ! command -v kubectl >/dev/null 2>&1; then
                            echo "[*] kubectl not found in PATH. Fetching stable kubectl binary..."
                            curl -fsSL -o "${WORKSPACE}/bin/kubectl" "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
                            chmod +x "${WORKSPACE}/bin/kubectl"
                        fi

                        echo "[+] Tool versions:"
                        docker --version || echo "Docker CLI check done."
                        kubectl version --client --output=yaml || echo "kubectl check done."
                    '''
                }
            }
        }

        stage('Checkout SCM') {
            steps {
                script {
                    try {
                        checkout scm
                    } catch (Exception e) {
                        echo "Standard SCM checkout skipped or failed, using repository clone fallback: ${e.message}"
                        git branch: 'dockerize', url: 'https://github.com/Luphonix-Prime/tracly-tag-final.git'
                    }
                }
            }
        }

        stage('Verify VPS Cluster Reachability') {
            steps {
                script {
                    sh '''
                        echo "[*] Detecting Kubernetes cluster on OVH Ubuntu VPS..."

                        # 1. Resolve Kubeconfig path (K3s default on Ubuntu VPS or standard ~/.kube/config)
                        if [ -z "${KUBECONFIG:-}" ]; then
                            if [ -f "/etc/rancher/k3s/k3s.yaml" ]; then
                                export KUBECONFIG="/etc/rancher/k3s/k3s.yaml"
                                # Allow jenkins/current user read access to K3s configuration if needed
                                if [ ! -r "/etc/rancher/k3s/k3s.yaml" ]; then
                                    sudo chmod 644 /etc/rancher/k3s/k3s.yaml 2>/dev/null || true
                                fi
                            elif [ -f "${HOME}/.kube/config" ]; then
                                export KUBECONFIG="${HOME}/.kube/config"
                            fi
                        fi

                        # 2. Test connectivity
                        if kubectl cluster-info >/dev/null 2>&1; then
                            echo "[+] Successfully connected to active Kubernetes cluster:"
                            kubectl cluster-info
                        else
                            echo "[!] Kubernetes cluster is not currently responding via kubectl."

                            if [ "${AUTO_BOOTSTRAP_K3S}" = "true" ] && [ -f /etc/os-release ] && grep -qiE "ubuntu|debian" /etc/os-release; then
                                echo "[*] Auto-bootstrapping lightweight K3s cluster on Ubuntu VPS..."
                                curl -sfL https://get.k3s.io | sh -
                                
                                export KUBECONFIG="/etc/rancher/k3s/k3s.yaml"
                                sudo chmod 644 /etc/rancher/k3s/k3s.yaml 2>/dev/null || true
                                
                                mkdir -p "${HOME}/.kube"
                                sudo cp -f /etc/rancher/k3s/k3s.yaml "${HOME}/.kube/config" 2>/dev/null || true
                                sudo chmod 644 "${HOME}/.kube/config" 2>/dev/null || true

                                sleep 6
                                kubectl wait --for=condition=Ready node --all --timeout=60s || true
                                echo "[+] K3s cluster ready!"
                            else
                                echo "ERROR: No accessible Kubernetes cluster found. Please verify kubeconfig or enable AUTO_BOOTSTRAP_K3S."
                                exit 1
                            fi
                        fi
                    '''
                }
            }
        }

        stage('Build Docker Images') {
            when {
                expression { return params.BUILD_IMAGES }
            }
            parallel {
                stage('Build Backend Image') {
                    steps {
                        script {
                            echo "Building Backend Container: ${env.BACKEND_IMAGE}"
                            sh """
                                docker build \
                                    -f Dockerfile.backend \
                                    -t ${env.BACKEND_IMAGE} \
                                    -t ${env.BACKEND_IMAGE_LATEST} .
                            """
                        }
                    }
                }
                stage('Build Frontend Image') {
                    steps {
                        script {
                            echo "Building Frontend Container: ${env.FRONTEND_IMAGE}"
                            sh """
                                docker build \
                                    -f Dockerfile.frontend \
                                    -t ${env.FRONTEND_IMAGE} \
                                    -t ${env.FRONTEND_IMAGE_LATEST} .
                            """
                        }
                    }
                }
            }
        }

        stage('Push Images to Docker Hub') {
            when {
                expression { return params.PUSH_TO_DOCKER_HUB && params.BUILD_IMAGES }
            }
            steps {
                script {
                    echo "Logging into Docker Hub and pushing images..."
                    try {
                        withCredentials([usernamePassword(
                            credentialsId: env.DOCKER_REGISTRY_CREDENTIALS_ID,
                            usernameVariable: 'DOCKER_USER_ID',
                            passwordVariable: 'DOCKER_PASSWORD'
                        )]) {
                            sh '''
                                echo "${DOCKER_PASSWORD}" | docker login -u "${DOCKER_USER_ID}" --password-stdin
                                echo "[+] Pushing backend images..."
                                docker push "${BACKEND_IMAGE}"
                                docker push "${BACKEND_IMAGE_LATEST}"
                                
                                echo "[+] Pushing frontend images..."
                                docker push "${FRONTEND_IMAGE}"
                                docker push "${FRONTEND_IMAGE_LATEST}"
                            '''
                        }
                    } catch (Exception e) {
                        echo "[WARNING] Docker Hub credentials ('${env.DOCKER_REGISTRY_CREDENTIALS_ID}') not found or login failed."
                        echo "Reason: ${e.message}"
                        echo "If Jenkins is running on the same OVH VPS as K3s/Docker, local images will still be utilized."
                    }
                }
            }
        }

        stage('Deploy Infrastructure to OVH VPS') {
            steps {
                script {
                    echo "[*] Step 1: Applying Namespace and ConfigMaps/Secrets..."
                    sh '''
                        [ -f /etc/rancher/k3s/k3s.yaml ] && export KUBECONFIG="/etc/rancher/k3s/k3s.yaml"

                        kubectl apply -f "${K8S_DIR}/00-namespace.yaml"
                        kubectl apply -f "${K8S_DIR}/01-configmap-secrets.yaml"
                    '''

                    echo "[*] Step 2: Applying Data Layer (PostgreSQL, PgBouncer, Redis)..."
                    sh '''
                        [ -f /etc/rancher/k3s/k3s.yaml ] && export KUBECONFIG="/etc/rancher/k3s/k3s.yaml"

                        kubectl apply -f "${K8S_DIR}/01b-postgres.yaml"
                        kubectl apply -f "${K8S_DIR}/02-pgbouncer.yaml"
                        kubectl apply -f "${K8S_DIR}/03-redis.yaml"
                    '''
                }
            }
        }

        stage('Deploy Workloads & Update Image Tags') {
            steps {
                script {
                    echo "[*] Step 3: Deploying Backend & Frontend Workloads..."
                    sh """
                        [ -f /etc/rancher/k3s/k3s.yaml ] && export KUBECONFIG="/etc/rancher/k3s/k3s.yaml"

                        kubectl apply -f "${env.K8S_DIR}/04-backend-deployment.yaml"
                        kubectl apply -f "${env.K8S_DIR}/05-frontend-deployment.yaml"

                        echo "  Setting Deployment images to: ${env.BACKEND_IMAGE} and ${env.FRONTEND_IMAGE}..."
                        kubectl set image deployment/tracelytag-backend backend="${env.BACKEND_IMAGE}" -n "${env.NAMESPACE}"
                        kubectl set image deployment/tracelytag-frontend frontend="${env.FRONTEND_IMAGE}" -n "${env.NAMESPACE}"

                        # Ensure imagePullPolicy: Always for fresh image updates
                        kubectl patch deployment tracelytag-backend -n "${env.NAMESPACE}" -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","imagePullPolicy":"Always"}]}}}}' || true
                        kubectl patch deployment tracelytag-frontend -n "${env.NAMESPACE}" -p '{"spec":{"template":{"spec":{"containers":[{"name":"frontend","imagePullPolicy":"Always"}]}}}}' || true
                    """

                    echo "[*] Step 4: Applying Ingress, HPA, and Scheduled Maintenance Jobs..."
                    sh """
                        [ -f /etc/rancher/k3s/k3s.yaml ] && export KUBECONFIG="/etc/rancher/k3s/k3s.yaml"

                        kubectl apply -f "${env.K8S_DIR}/06-ingress.yaml"
                        kubectl apply -f "${env.K8S_DIR}/07-hpa.yaml"
                        kubectl apply -f "${env.K8S_DIR}/08-cronjob-db-backup.yaml"
                        kubectl apply -f "${env.K8S_DIR}/09-job-db-verify.yaml"
                    """
                }
            }
        }

        stage('Zero-Downtime Rollout Verification') {
            steps {
                script {
                    if (params.TRIGGER_ROLLOUT_RESTART) {
                        echo "[*] Triggering rolling restart of microservices..."
                        sh """
                            [ -f /etc/rancher/k3s/k3s.yaml ] && export KUBECONFIG="/etc/rancher/k3s/k3s.yaml"

                            kubectl rollout restart deployment/tracelytag-backend -n "${env.NAMESPACE}"
                            kubectl rollout restart deployment/tracelytag-frontend -n "${env.NAMESPACE}"
                        """
                    }

                    echo "[*] Monitoring rollout status..."
                    sh """
                        [ -f /etc/rancher/k3s/k3s.yaml ] && export KUBECONFIG="/etc/rancher/k3s/k3s.yaml"

                        echo "Waiting for backend deployment rollout to complete..."
                        kubectl rollout status deployment/tracelytag-backend -n "${env.NAMESPACE}" --timeout=180s

                        echo "Waiting for frontend deployment rollout to complete..."
                        kubectl rollout status deployment/tracelytag-frontend -n "${env.NAMESPACE}" --timeout=180s
                    """
                }
            }
        }

        stage('Health & Cluster Status Summary') {
            steps {
                script {
                    sh """
                        [ -f /etc/rancher/k3s/k3s.yaml ] && export KUBECONFIG="/etc/rancher/k3s/k3s.yaml"

                        echo "=========================================================="
                        echo "        OVH UBUNTU VPS DEPLOYMENT COMPLETED!             "
                        echo "=========================================================="
                        echo "--- Running Pods in '${env.NAMESPACE}' ---"
                        kubectl get pods -n "${env.NAMESPACE}" -o wide
                        echo ""
                        echo "--- Services & Cluster Ports ---"
                        kubectl get svc -n "${env.NAMESPACE}"
                        echo ""
                        echo "--- Ingress Routing ---"
                        kubectl get ingress -n "${env.NAMESPACE}"
                        echo "=========================================================="
                    """
                }
            }
        }
    }

    post {
        always {
            script {
                echo 'Cleaning build artifacts and dangling Docker images...'
                sh 'docker image prune -f --filter "until=24h" || true'
                cleanWs(deleteDirs: true, notFailBuild: true)
            }
        }
        success {
            echo "=================================================================="
            echo " SUCCESS: TracelyTag Build #${env.BUILD_NUMBER} Deployed to OVH VPS! "
            echo " Domain: https://app.tracelytag.com"
            echo "=================================================================="
        }
        failure {
            script {
                echo "=================================================================="
                echo " [!] PIPELINE FAILED - INITIATING AUTOMATED ROLLBACK & LOG CAPTURE"
                echo "=================================================================="
                sh """
                    [ -f /etc/rancher/k3s/k3s.yaml ] && export KUBECONFIG="/etc/rancher/k3s/k3s.yaml"

                    echo "Attempting automated deployment rollback..."
                    kubectl rollout undo deployment/tracelytag-backend -n "${env.NAMESPACE}" || true
                    kubectl rollout undo deployment/tracelytag-frontend -n "${env.NAMESPACE}" || true

                    echo "--- Pod Diagnostic Logs (Backend) ---"
                    kubectl logs -n "${env.NAMESPACE}" -l app=tracelytag-backend --tail=50 || true

                    echo "--- Pod Diagnostic Logs (Frontend) ---"
                    kubectl logs -n "${env.NAMESPACE}" -l app=tracelytag-frontend --tail=50 || true

                    echo "--- Recent Cluster Events ---"
                    kubectl get events -n "${env.NAMESPACE}" --sort-by='.metadata.creationTimestamp' | tail -n 25 || true
                """
            }
        }
    }
}
