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