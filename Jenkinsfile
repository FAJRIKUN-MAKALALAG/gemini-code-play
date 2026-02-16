pipeline {
  agent any
  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  triggers {
    githubPush()
    pollSCM('H/5 * * * *')
  }

  environment {
    // === CONFIGURATION ===
    FRONTEND_DOMAIN = 'unklab-aicode.online'
    
    // Directories on VPS
    FRONTEND_DIR = "/var/www/frontend"
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    // ======================
    // FRONTEND DEPLOYMENT
    // ======================
    stage('Build & Deploy Frontend') {
      steps {
        script {
           echo "🚀 Building Frontend for ${FRONTEND_DOMAIN}..."
           
           // Inject Secrets & Config
             // Note: API is now hosted at https://api.unklab-aicode.online
             sh """
               cat > .env << EOF
VITE_API_BASE_URL="https://api.unklab-aicode.online/api"
EOF
             """
           }

           // Install & Build
           sh """
             npm ci
             npm run build
           """

           // Deploy to Nginx
           echo "🚀 Deploying Frontend Files..."
           sh "rsync -av --delete ./dist/ ${FRONTEND_DIR}/"
        }
      }
    }
  }

  post {
    success { 
      echo "✅ DEPLOYMENT SUCCESSFUL!"
      echo "Frontend: https://${FRONTEND_DOMAIN}"
    }
    failure { 
      echo "❌ DEPLOYMENT FAILED" 
    }
  }
}
