## jenkinsfile
pipeline {
    agent any

    environment {
        DOCKERHUB_USER = 'krishnasinghcode'
        APP_NAME       = 'lab7-app'
        K8S_NAMESPACE  = 'default'
        APP_DIR        = '.'
    }

    stages {
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

                        # docker login with simple retry
                        n=0
                        until [ \$n -ge 3 ]
                        do
                          echo "${DOCKERHUB_PASSWORD}" | docker login -u "${DOCKERHUB_USERNAME}" --password-stdin && break
                          n=\$((n+1))
                          echo "docker login failed, retry \$n/3, sleeping 5s..."
                          sleep 5
                        done

                        # docker push with simple retry
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

        // (Optional) keep this for lab7 single deployment if you still use deployment.yaml
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

        // NEW: update green deployment for blue-green
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
                        git add deployment.yaml deployment-green.yaml

                        git commit -m "Update image tag to build ${BUILD_NUMBER}" || echo "No changes to commit"

                        git push https://${GIT_USERNAME}:${GIT_PASSWORD}@github.com/krishnasinghcode/devops.git HEAD:main
                        """
                    }
                }
            }
        }
    }
}

## dockerfile
FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --only=production

COPY . .

EXPOSE 3000

CMD [ "npm", "start" ]

## deployment-blue.yaml
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
        image: krishnasinghcode/lab7-app:22   # Jenkins will update later, placeholder
        ports:
        - containerPort: 3000                 # adjust if your app uses another port
## deployment-green.yaml
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
        image: krishnasinghcode/lab7-app:23
        ports:
        - containerPort: 3000

## service.yaml
apiVersion: v1
kind: Service
metadata:
  name: lab7-service
spec:
  selector:
    app: lab7-app
  type: NodePort
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
      nodePort: 30080
