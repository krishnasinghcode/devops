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

                        # Retry docker login up to 3 times
                        for i in 1 2 3; do
                          echo "${DOCKERHUB_PASSWORD}" | docker login -u "${DOCKERHUB_USERNAME}" --password-stdin && break
                          echo "docker login failed, retrying in 5s... (attempt $i)"
                          sleep 5
                        done

                        # Retry docker push up to 3 times
                        for i in 1 2 3; do
                          if docker push ${DOCKERHUB_USER}/${APP_NAME}:${BUILD_NUMBER}; then
                            break
                          fi
                          echo "docker push failed, retrying in 5s... (attempt $i)"
                          sleep 5
                        done
                        """
                    }
                }
            }
        }

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
    }
}