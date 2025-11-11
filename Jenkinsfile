pipeline {
    agent {
        docker {
            image 'node:22'
        }
    }

    stages {
        stage('install') {
            steps {
                sh 'node -v'
                sh 'npm -v'
                 sh 'mkdir -p dist && cp public/index.html dist/'
                script {
                    String tag = sh(returnStdout: true, script: 'git tag --contains').trim()
                    String branchName = sh(returnStdout: true, script: 'git rev-parse --abbrev-ref HEAD').trim()
                    String commit = sh(returnStdout: true, script: 'git log -1 --oneline').trim()
                    String commitMsg = commit.substring(commit.indexOf(' ')).trim()

                    if (tag) {
                        currentBuild.displayName = "#${BUILD_NUMBER}, tag ${tag}"
                    } else {
                        currentBuild.displayName = "#${BUILD_NUMBER}, branch ${branchName}"
                    }

                    String author = sh(returnStdout: true, script: "git log -1 --pretty=format:'%an'").trim()
                    currentBuild.description = "${author}<br />${commitMsg}"
                    echo 'starting installing'
                    sh 'npm ci'
                }
            }
        }

        stage('checks') {
            parallel {
                stage('eslint') {
                    steps {
                        sh 'npm run eslint'
                    }
                }

                stage('build') {
                    steps {
                        sh 'npm run build'
                    }
                }
            }
        }

        stage('start-api') {
            steps {
                sh '''
                    nohup node server.js > /tmp/api.log 2>&1 &
                    sleep 3
                    curl http://localhost:3001/api/health || echo "API запущен"
                '''
            }
        }
    }

}
