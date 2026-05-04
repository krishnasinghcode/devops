Here’s a “README-style” explanation of what you’ve built in Ex7, step by step.

***
## 1. Project structure and key files
You worked inside:

```text
C:\Users\krishna\Documents\code\AWS\devops-app
```

Main files:

- `app` code (Node.js) – simple HTTP app.
- `Dockerfile` – how to containerize the app.
- `deployment.yaml` – Kubernetes Deployment for `lab7-deployment`.
- `service.yaml` – Kubernetes Service `lab7-service` of type NodePort.
- `Jenkinsfile` – pipeline definition used by Jenkins. [oneuptime](https://oneuptime.com/blog/post/2026-02-02-jenkins-kubernetes-deployment/view)

All of this lives in your GitHub repo `krishnasinghcode/devops`.

***
## 2. Jenkins environment
You ran Jenkins in Docker using a **custom image**:

- Based on `jenkins/jenkins:lts`.
- Extended to include:
  - `docker` CLI (to build/push images).
  - `kubectl` (for future K8s use).
- You mounted:
  - `jenkins_home` volume for Jenkins data.
  - `/var/run/docker.sock` to let Jenkins use the host’s Docker daemon. [jenkins](https://www.jenkins.io/doc/book/installing/docker/)

This let Jenkins run `docker build`, `docker run`, and `docker push` exactly like your host.

Jenkins job `lab7-pipeline` is configured to pull from:

```text
https://github.com/krishnasinghcode/devops.git
```

and uses the `Jenkinsfile` in that repo.

Credentials:

- `dockerhub-creds` – Docker Hub username + password/PAT, used to `docker login`.
- `github-creds` – GitHub username + PAT with `repo` permissions, used to push commits back to GitHub. [geeksforgeeks](https://www.geeksforgeeks.org/git/jenkins-and-git-integration-using-ssh-key/)

***
## 3. Jenkins pipeline stages (what each stage does)
Your `Jenkinsfile` defines a declarative pipeline with these stages:
### 3.1 Build Docker Image
```groovy
stage('Build Docker Image') {
    steps {
        script {
            sh """
            cd ${APP_DIR}
            docker build -t ${DOCKERHUB_USER}/${APP_NAME}:${BUILD_NUMBER} .
            """
        }
    }
}
```

- `APP_DIR` is `.` (repo root).
- Builds image:

  ```text
  krishnasinghcode/lab7-app:<BUILD_NUMBER>
  ```

- Example: `lab7-app:22`.  
This is your **versioned** image for that pipeline run. [dzone](https://dzone.com/articles/building-docker-images-to-docker-hub-using-jenkins)
### 3.2 Run Tests
```groovy
stage('Run Tests') {
    steps {
        script {
            sh """
            cd ${APP_DIR}
            docker run --rm ${DOCKERHUB_USER}/${APP_NAME}:${BUILD_NUMBER} npm test
            """
        }
    }
}
```

- Runs `npm test` inside the freshly built image.
- If tests fail, pipeline stops here.
### 3.3 Push to Docker Hub (with retry)
```groovy
stage('Push to Docker Hub') {
    steps {
        withCredentials([usernamePassword(
            credentialsId: 'dockerhub-creds',
            usernameVariable: 'DOCKERHUB_USERNAME',
            passwordVariable: 'DOCKERHUB_PASSWORD'
        )]) {
            script {
                sh """
                cd ${APP_DIR}

                n=0
                until [ \$n -ge 3 ]
                do
                  echo "${DOCKERHUB_PASSWORD}" | docker login -u "${DOCKERHUB_USERNAME}" --password-stdin && break
                  n=\$((n+1))
                  echo "docker login failed, retry \$n/3, sleeping 5s..."
                  sleep 5
                done

                m=0
                until [ \$m -ge 3 ]
                do
                  docker push ${DOCKERHUB_USER}/${APP_NAME}:${BUILD_NUMBER} && break
                  m=\$((m+1))
                  echo "docker push failed, retry \$m/3, sleeping 5s..."
                  sleep 5
                done
                """
            }
        }
    }
}
```

- Logs into Docker Hub with your Jenkins credentials.
- Pushes the versioned image `lab7-app:<BUILD_NUMBER>` with up to 3 retries to survive transient network issues. [dzone](https://dzone.com/articles/building-docker-images-to-docker-hub-using-jenkins)
### 3.4 Update K8s Manifest
```groovy
stage('Update K8s Manifest') {
    steps {
        script {
            sh """
            cd ${APP_DIR}
            sed -i 's#image: .*#image: ${DOCKERHUB_USER}/${APP_NAME}:${BUILD_NUMBER}#' deployment.yaml
            """
        }
    }
}
```

- Edits `deployment.yaml` in the Jenkins workspace.
- Replaces the `image:` line with:

  ```yaml
  image: krishnasinghcode/lab7-app:<BUILD_NUMBER>
  ```

So after build 22, `deployment.yaml` contains:

```yaml
image: krishnasinghcode/lab7-app:22
``` 

This is how Kubernetes “knows” which image version to pull: it reads this YAML. [k21academy](https://k21academy.com/kubernetes/kubernetes-deployment-yaml-explained-with-examples/)
### 3.5 Commit & Push Manifest back to GitHub
```groovy
stage('Commit & Push Manifest') {
    steps {
        withCredentials([usernamePassword(
            credentialsId: 'github-creds',
            usernameVariable: 'GIT_USERNAME',
            passwordVariable: 'GIT_PASSWORD'
        )]) {
            script {
                sh """
                cd ${APP_DIR}
                git config user.email "jenkins@local"
                git config user.name "Jenkins"

                git status
                git add deployment.yaml

                git commit -m "Update image tag to build ${BUILD_NUMBER}" || echo "No changes to commit"

                git push https://${GIT_USERNAME}:${GIT_PASSWORD}@github.com/krishnasinghcode/devops.git HEAD:main
                """
            }
        }
    }
}
```

- Configures Git identity inside Jenkins.
- Stages `deployment.yaml`.
- Commits `deployment.yaml` with message like “Update image tag to build 22”.
- Pushes to `main` on GitHub using your PAT. [github](https://github.com/jenkinsci/pipeline-examples/blob/master/pipeline-examples/push-git-repo/pushGitRepo.groovy)

Result:

- GitHub repo is always up-to-date with the image version actually built and pushed.

***
## 4. Kubernetes manifests
### 4.1 Deployment
`deployment.yaml` describes:

- Deployment name: `lab7-deployment`
- Namespace: `default`
- Pod template:
  - Container name: e.g. `lab7-app`
  - Image: `krishnasinghcode/lab7-app:<BUILD_NUMBER>`
  - Ports (e.g., container port 3000 or 80 depending on your app)
  - Replicas: 2 (for high availability)

Kubernetes uses that to create `lab7-deployment-...` pods.
### 4.2 Service
`service.yaml` describes:

- Service name: `lab7-service`
- Type: `NodePort`
- Selector: matches labels of pods from `lab7-deployment`.
- Ports:
  - port: 80
  - targetPort: app’s container port
  - nodePort: 30080 (for external access via node IP). [armosec](https://www.armosec.io/blog/kubernetes-deployment-and-service/)

***
## 5. Your manual CD steps (host-side)
After Jenkins finishes successfully:

1. You pull the updated manifests:

   ```powershell
   cd C:\Users\krishna\Documents\code\AWS\devops-app
   git pull
   ```

   This brings in `deployment.yaml` with `image: krishnasinghcode/lab7-app:22`.

2. Apply to Kubernetes:

   ```powershell
   kubectl apply -f deployment.yaml -n default
   kubectl apply -f service.yaml -n default
   ```

3. Check pods:

   ```powershell
   kubectl get pods -n default
   ```

   You see `lab7-deployment-...` pods in `Running`.  

4. Confirm image:

   ```powershell
   kubectl get deployment lab7-deployment -n default -o jsonpath="{.spec.template.spec.containers.image}"
   ```

   Output: `krishnasinghcode/lab7-app:22` → matches Jenkins build. [baeldung](https://www.baeldung.com/ops/kubernetes-get-current-image)

5. Access the app (via port-forward):

   ```powershell
   kubectl port-forward service/lab7-service 8081:80 -n default
   ```

   Then:

   ```powershell
   curl http://localhost:8081/
   ```

   or open `http://localhost:8081/` in a browser to see the app.

***
## 6. Conceptually: whole Ex7 pipeline in one line
- You edit code and push to GitHub.
- Jenkins pulls code and runs the pipeline:
  - builds a Docker image with a versioned tag,
  - tests it,
  - pushes it to Docker Hub,
  - updates `deployment.yaml` with that tag and pushes the manifest back to GitHub. [oneuptime](https://oneuptime.com/blog/post/2026-02-02-jenkins-kubernetes-deployment/view)
- You pull the updated manifest and run `kubectl apply`.
- Kubernetes deploys that exact image version and exposes it through `lab7-service`.
- You hit the service via port-forward and see the running app.

This is a clean CI (Jenkins) + CD (manual `kubectl`) flow.

To prep for Ex8 (blue‑green), which part of this Ex7 pipeline feels most natural to extend: the Kubernetes side (two deployments + one service), or the Jenkins side (logic to deploy “green” then switch traffic)?