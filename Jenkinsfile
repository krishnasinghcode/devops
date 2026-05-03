pipeline {
    agent any

    environment {
        DOCKERHUB_USER = 'krishnasinghcode'
        APP_NAME       = 'lab7-app'
        K8S_NAMESPACE  = 'default'
        APP_DIR        = '.'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/krishnasinghcode/devops.git'
            }
        }

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
                        echo "${DOCKERHUB_PASSWORD}" | docker login -u "${DOCKERHUB_USERNAME}" --password-stdin
                        docker tag ${DOCKERHUB_USER}/${APP_NAME}:${BUILD_NUMBER} ${DOCKERHUB_USER}/${APP_NAME}:latest
                        docker push ${DOCKERHUB_USER}/${APP_NAME}:${BUILD_NUMBER}
                        docker push ${DOCKERHUB_USER}/${APP_NAME}:latest
                        """
                    }
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                script {
                    sh """
                    cd ${APP_DIR}
                    sed -i 's#image: .*#image: ${DOCKERHUB_USER}/${APP_NAME}:${BUILD_NUMBER}#' deployment.yaml
                    kubectl apply -f deployment.yaml -n ${K8S_NAMESPACE}
                    kubectl apply -f service.yaml -n ${K8S_NAMESPACE}
                    """
                }
            }
        }

        stage('Verify Deployment') {
            steps {
                script {
                    sh """
                    kubectl get pods -n ${K8S_NAMESPACE}
                    kubectl get svc lab7-service -n ${K8S_NAMESPACE}
                    """
                }
            }
        }
    }
}