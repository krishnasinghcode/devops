## inital docker test
cd C:\devops-labs\lab7\app

docker build -t lab7-app:local .
docker run -d --name lab7-test -p 3000:3000 lab7-app:local

# test in browser: http://localhost:3000
docker logs lab7-test
docker stop lab7-test
docker rm lab7-test

## test kubernates manually
cd C:\devops-labs\lab7

kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

kubectl get pods -o wide
kubectl get svc lab7-service

### port forwarding for kubernates
kubectl port-forward service/lab7-service 8080:80


## Installing and running jenkins with docker socket mounted

docker pull jenkins/jenkins:lts

docker run -d --name jenkins `
  -p 8080:8080 -p 50000:50000 `
  -v jenkins_home:/var/jenkins_home `
  -v /var/run/docker.sock:/var/run/docker.sock `
  jenkins/jenkins:lts


## something git permisson with jenkins
docker exec -it jenkins bash
cd /var/jenkins_home
git config --global --add safe.directory '*'
exit

## need to install docker and kubernates inside the container(jenkins) again
apt-get install -y docker.io
which docker
docker version

apt-get install -y kubectl
which kubectl
kubectl version --client


## working kubernates.
docker run -d --name jenkins -u root ^
  -p 8080:8080 -p 50000:50000 ^
  -v jenkins_home:/var/jenkins_home ^
  -v //var/run/docker.sock:/var/run/docker.sock ^
  -v C:/Users/krishna/.kube:/root/.kube ^
  -e KUBECONFIG=/root/.kube/config ^
  jenkins/jenkins:lts

  docker run -d --name jenkins -u root ^
  -p 8080:8080 -p 50000:50000 ^
  -v jenkins_home:/var/jenkins_home ^
  -v //var/run/docker.sock:/var/run/docker.sock ^
  -v C:/Users/krishna/.kube:/root/.kube ^
  -e KUBECONFIG=/root/.kube/config ^
  jenkins-kubectl



  ## basically building jenkins with docker and kubernates.
  cd C:\Users\krishna\Documents\code\AWS\devops-app
docker build -f Dockerfile.jenkins -t jenkins-kubectl .

2) Run Jenkins container with Docker socket mounted
Now run Jenkins so it can talk to host Docker:

powershell
docker stop jenkins
docker rm jenkins

```powershell
docker run -d --name jenkins -u root `
  -p 8080:8080 -p 50000:50000 `
  -v jenkins_home:/var/jenkins_home `
  -v //var/run/docker.sock:/var/run/docker.sock `
  jenkins-kubectl
```


## then run kubernates on my local host
cd C:\Users\krishna\Documents\code\AWS\devops-app
git pull
kubectl apply -f deployment.yaml -n default
kubectl apply -f service.yaml -n default
kubectl get pods -n default
kubectl get svc lab7-service -n default


kubectl port-forward service/lab7-service 8081:80 -n default