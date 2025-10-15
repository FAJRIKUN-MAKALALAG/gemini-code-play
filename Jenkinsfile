pipeline {
  agent any
  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  triggers {
    githubPush() // auto trigger on push
    pollSCM('H/5 * * * *') // backup trigger every 5 mins
  }

  environment {
    APP_DIR = '.' // ✅ karena project langsung di root
    DEPLOY_DIR = '/home/groupfox/public_html' // ✅ lokasi Nginx kamu
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Generate .env for build') {
      steps {
        withCredentials([
          string(credentialsId: 'VITE_SUPABASE_URL',             variable: 'SUPA_URL'),
          string(credentialsId: 'VITE_SUPABASE_PUBLISHABLE_KEY', variable: 'SUPA_KEY'),
          string(credentialsId: 'VITE_GEMINI_API_KEY',           variable: 'GEMINI_KEY'),
          string(credentialsId: 'VITE_GEMINI_MODEL',             variable: 'GEMINI_MODEL')
        ]) {
          sh """
            cat > ${APP_DIR}/.env << 'EOF'
VITE_SUPABASE_URL="${SUPA_URL}"
VITE_SUPABASE_PUBLISHABLE_KEY="${SUPA_KEY}"
VITE_GEMINI_API_KEY="${GEMINI_KEY}"
VITE_GEMINI_MODEL="${GEMINI_MODEL}"
EOF
          """
        }
      }
    }

    stage('Install Dependencies') {
      steps { sh 'npm ci' }
    }

    stage('Build App') {
      steps { sh 'npm run build' }
    }

    stage('Deploy to Nginx') {
      steps { sh "rsync -av --delete ${APP_DIR}/dist/ ${DEPLOY_DIR}/" }
    }
  }

  post {
    success { echo "✅ DEPLOY OK — Cek http://IP-SERVER:8081" }
    failure { echo "❌ BUILD/DEPLOY ERROR — Cek log di Jenkins" }
  }
}
