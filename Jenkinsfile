pipeline {
    agent any
    
    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    tools {
        nodejs "node"
    }

    triggers {
        githubPush()
    }

    environment {
        FRONTEND_DOMAIN = 'aicode-rho.vercel.app'
        FRONTEND_DIR    = "/var/www/frontend"
        PATH = "/usr/local/bin:/usr/bin:/bin:$PATH"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Frontend') {
            steps {
                script {
                    echo "🚀 Building Frontend for ${FRONTEND_DOMAIN}..."
                    
                    sh """
                        echo 'VITE_API_BASE_URL="https://api.unklab-aicode.online/api"' > .env
                    """

                    sh """
                        npm ci
                        npm run build
                    """
                }
            }
        }

        stage('Deploy to Nginx') {
            steps {
                echo "🚀 Deploying Frontend Files to ${FRONTEND_DIR}..."
                sh """
                    mkdir -p ${FRONTEND_DIR}
                    rsync -av --delete ./dist/ ${FRONTEND_DIR}/
                """
            }
        }
    }

    post {
        success { 
            echo "✅ DEPLOYMENT SUCCESSFUL!"
            echo "Frontend aktif di: https://${FRONTEND_DOMAIN}"
        }
        failure { 
            echo "❌ DEPLOYMENT FAILED - Cek log build npm di atas."
        }
    }
}