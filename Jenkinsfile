// Build triggered: Fix API URL connection issue - Force rebuild with correct production API
pipeline {
    agent any
    
    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    // Gunakan tool NodeJS yang sudah kita daftarkan di Jenkins
    tools {
        nodejs "node"
    }

    triggers {
        githubPush()
    }

    environment {
        FRONTEND_DOMAIN = 'unklab-aicode.online'
        FRONTEND_DIR    = "/var/www/frontend"
        // Memastikan Jenkins bisa menemukan binari npm
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
                    
                    // Inject API URL ke dalam .env Vite
                    sh """
                        echo 'VITE_API_BASE_URL="https://api.unklab-aicode.online/api"' > .env
                    """

                    // Install & Build (menggunakan ci agar lebih bersih)
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
                    # Pastikan folder ada
                    mkdir -p ${FRONTEND_DIR}
                    
                    # RSync hasil build (folder dist) ke folder Nginx
                    # Pastikan folder /dist ada (Vite defaultnya dist)
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