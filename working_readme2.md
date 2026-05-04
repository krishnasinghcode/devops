Here’s a detailed “README-style” recap of what you did in **Ex8: Automated Blue‑Green Deployment with Jenkins, Docker, and Kubernetes**, including the main commands.

***

## 1. Goal of Ex8

Extend Ex7 so that:

- You have **two environments** in the same cluster:
  - **Blue**: current live version.
  - **Green**: new version.
- A **single Service** (`lab8-service`) routes traffic either to blue or to green.
- **Jenkins**:
  - Builds and pushes the Docker image (same as Ex7).
  - Updates the **green** Kubernetes manifest (`deployment-green.yaml`) with the new image tag and pushes it to GitHub.
- **You**:
  - Apply the updated green deployment to the cluster.
  - Test green.
  - Flip the service selector from blue → green to shift traffic (and can flip back to roll back). [geeksforgeeks](https://www.geeksforgeeks.org/devops/what-is-kubernetes-blue-green-deployment/)

***

## 2. New Kubernetes manifests for blue‑green

### 2.1 Blue deployment (`deployment-blue.yaml`)

You created a deployment for the blue environment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lab8-deployment-blue
  labels:
    app: lab8-app
    version: blue
spec:
  replicas: 2
  selector:
    matchLabels:
      app: lab8-app
      version: blue
  template:
    metadata:
      labels:
        app: lab8-app
        version: blue
    spec:
      containers:
      - name: lab8-app
        image: krishnasinghcode/lab7-app:22   # initial tag, could be any stable version
        ports:
        - containerPort: 3000
```

Commands you ran:

```powershell
cd C:\Users\krishna\Documents\code\AWS\devops-app

kubectl apply -f deployment-blue.yaml -n default
kubectl get pods -l app=lab8-app,version=blue -n default
kubectl get svc lab8-service -n default   # after creating service
```

Result:

- `lab8-deployment-blue-...` pods in `Running` state.

### 2.2 Service (`lab8-service.yaml`)

You created a NodePort Service that points to blue initially:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: lab8-service
spec:
  type: NodePort
  selector:
    app: lab8-app
    version: blue      # initially route to blue
  ports:
  - port: 80
    targetPort: 3000   # app port
    nodePort: 30081    # external port on the node
```

Commands:

```powershell
kubectl apply -f lab8-service.yaml -n default
kubectl get svc lab8-service -n default
```

Result:

- `lab8-service` created: `80:30081/TCP`, selector `app=lab8-app, version=blue`.  
  This is the “traffic switch” for blue‑green: by changing `version` in the selector, you choose which environment receives traffic. [kubernetes](https://kubernetes.io/docs/concepts/services-networking/service/)

### 2.3 Green deployment (`deployment-green.yaml`)

You defined a green deployment, same labels but `version: green`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lab8-deployment-green
  labels:
    app: lab8-app
    version: green
spec:
  replicas: 2
  selector:
    matchLabels:
      app: lab8-app
      version: green
  template:
    metadata:
      labels:
        app: lab8-app
        version: green
    spec:
      containers:
      - name: lab8-app
        image: krishnasingcode/lab7-app:22   # placeholder, Jenkins will update
        ports:
        - containerPort: 3000
```

Commands:

```powershell
kubectl apply -f deployment-green.yaml -n default
kubectl get pods -l app=lab8-app,version=green -n default
```

Result:

- `lab8-deployment-green-...` pods start and then go `Running`.

At this point, you had:

- Blue and green pods running.
- `lab8-service` still pointing at blue (`version=blue`).

***

## 3. Jenkinsfile changes for Ex8

You extended the Ex7 Jenkins pipeline so it automatically updates `deployment-green.yaml` with the new image tag.

### 3.1 Existing stages (unchanged logic)

These remain the same:

- **Build Docker Image** – builds `krishnasinghcode/lab7-app:${BUILD_NUMBER}`.
- **Run Tests** – `docker run ... npm test`.
- **Push to Docker Hub** – login with retries, push image. [dzone](https://dzone.com/articles/building-docker-images-to-docker-hub-using-jenkins)

Commands executed inside Jenkins (conceptually):

```bash
docker build -t krishnasinghcode/lab7-app:${BUILD_NUMBER} .
docker run --rm krishnasinghcode/lab7-app:${BUILD_NUMBER} npm test

# login + retry
echo "${DOCKERHUB_PASSWORD}" | docker login -u "${DOCKERHUB_USERNAME}" --password-stdin
docker push krishnasinghcode/lab7-app:${BUILD_NUMBER}
```

### 3.2 New Jenkins stage: `Update Green Manifest`

You added:

```groovy
stage('Update Green Manifest') {
    steps {
        script {
            sh """
            cd ${APP_DIR}
            sed -i 's#image: .*#image: ${DOCKERHUB_USER}/${APP_NAME}:${BUILD_NUMBER}#' deployment-green.yaml
            """
        }
    }
}
```

What it does:

- After the image is pushed to Docker Hub, this stage **rewrites** the `image:` line in `deployment-green.yaml` to the new tag, for example:

  ```yaml
  image: krishnasinghcode/lab7-app:23
  ```

So `deployment-green.yaml` now always points to the latest Jenkins build. [oneuptime](https://oneuptime.com/blog/post/2026-02-02-jenkins-kubernetes-deployment/view)

### 3.3 Commit & push both manifests

You changed the Git stage from only committing `deployment.yaml` to committing both:

```bash
git add deployment.yaml deployment-green.yaml
git commit -m "Update image tag to build ${BUILD_NUMBER}" || echo "No changes to commit"
git push https://${GIT_USERNAME}:${GIT_PASSWORD}@github.com/krishnasinghcode/devops.git HEAD:main
```

So:

- GitHub repo is updated with:
  - `deployment.yaml` for Ex7.
  - `deployment-green.yaml` for Ex8 (green env) with the new image tag.

***

## 4. End-to-end blue‑green workflow you now run

Putting it together, Ex8 flow is:

### Step A: You push code to GitHub

```powershell
cd C:\Users\krishna\Documents\code\AWS\devops-app
git add .
git commit -m "Change app for blue-green"
git push origin main
```

### Step B: Jenkins runs the pipeline

1. Checks out repo.
2. Builds image `krishnasinghcode/lab7-app:<BUILD_NUMBER>`.
3. Runs tests.
4. Pushes image to Docker Hub.
5. Updates:
   - `deployment.yaml` (Ex7).
   - `deployment-green.yaml` (Ex8) with `image: lab7-app:<BUILD_NUMBER>`.
6. Commits and pushes those files to GitHub.

You saw build numbers like `22`, `23`.

### Step C: You deploy the new green version

On your laptop:

```powershell
cd C:\Users\krishna\Documents\code\AWS\devops-app
git pull   # get updated deployment-green.yaml from Jenkins

kubectl apply -f deployment-green.yaml -n default
kubectl get pods -l app=lab8-app,version=green -n default
```

Confirm green deployment uses the new image:

```powershell
kubectl get deployment lab8-deployment-green -n default -o jsonpath="{.spec.template.spec.containers[0].image}"
# e.g. krishnasinghcode/lab7-app:23
```

### Step D: You switch traffic from blue → green

Service initially:

```yaml
selector:
  app: lab8-app
  version: blue
```

You manually change it to:

```yaml
selector:
  app: lab8-app
  version: green
```

Then apply:

```powershell
kubectl apply -f lab8-service.yaml -n default
```

Now all requests to `lab8-service` go to **green** pods.

You can test via port-forward:

```powershell
kubectl port-forward service/lab8-service 8082:80 -n default
curl http://localhost:8082/
```

If you don’t like what you see, you can **roll back** by changing `version: green` back to `version: blue` in `lab8-service.yaml` and applying again. That’s exactly the blue‑green rollback pattern. [spacelift](https://spacelift.io/blog/blue-green-deployment-kubernetes)

***

## 5. What is “blue‑green” here, conceptually?

- Blue = `lab8-deployment-blue` pods, `version: blue`.
- Green = `lab8-deployment-green` pods, `version: green`.
- Traffic:
  - Controlled by `lab8-service`’s `spec.selector.version`.
  - `version: blue` → all traffic to blue.
  - `version: green` → all traffic to green.

Jenkins’ role:

- Automate creating the new **green** version:
  - Build → test → push → update `deployment-green.yaml` with the new tag → commit to GitHub.  
Kubernetes’ role:

- Run both versions simultaneously and let you flip traffic with a single label change. [github](https://github.com/ianlewis/kubernetes-bluegreen-deployment-tutorial)

***

At this point, you’ve implemented:

- Ex7: CI pipeline from GitHub → Jenkins → Docker Hub → K8s single deployment.
- Ex8: Blue‑green extension with two deployments (blue/green) and a service selector that you switch manually, with Jenkins automatically preparing the green manifests.

To check your understanding: if you wanted to roll back from green to blue during Ex8, what **single change** would you make in `lab8-service.yaml`, and what command would you run afterward?