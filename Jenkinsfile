pipeline {
  agent any
  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }
  triggers {
    // Trigger otomatis saat ada push dari GitHub (butuh webhook)
    githubPush()
    // Fallback polling tiap 5 menit jika webhook tidak aktif
    pollSCM('H/5 * * * *')
  }
  environment {
    APP_DIR      = 'gemini-code-play'
    // Pilih strategi deploy: 'local' (default) atau 'ssh'
    DEPLOY_STRATEGY = 'local'
    // Target lokal (jika DEPLOY_STRATEGY=local)
    DEPLOY_DIR   = '/var/www/aicode'
    // Target remote (jika DEPLOY_STRATEGY=ssh)
    REMOTE_HOST  = credentials('JENKINS_REMOTE_HOST') // contoh: ubuntu@1.2.3.4 (opsional)
    REMOTE_DIR   = '/var/www/aicode'
  }
  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Node info') {
      steps {
        sh 'node -v || true'
        sh 'npm -v || true'
      }
    }

    stage('Tulis .env (Frontend)') {
      steps {
        withCredentials([
          string(credentialsId: 'VITE_SUPABASE_URL',             variable: 'SUPA_URL'),
          string(credentialsId: 'VITE_SUPABASE_PUBLISHABLE_KEY', variable: 'SUPA_KEY'),
          string(credentialsId: 'VITE_GEMINI_API_KEY',           variable: 'GEMINI_KEY'),
          string(credentialsId: 'VITE_GEMINI_MODEL',             variable: 'GEMINI_MODEL') // opsional
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

    stage('Install deps') {
      steps {
        dir("${APP_DIR}") {
          sh 'npm ci'
        }
      }
    }

    stage('Build') {
      steps {
        dir("${APP_DIR}") {
          sh 'npm run build'
        }
      }
      post {
        success {
          archiveArtifacts artifacts: "${APP_DIR}/dist/**", fingerprint: true
        }
      }
    }

    stage('Deploy') {
      steps {
        script {
          if (env.DEPLOY_STRATEGY == 'ssh') {
            // Deploy ke server remote via SSH (gunakan kredensial 'deploy_ssh')
            sshagent (credentials: ['deploy_ssh']) {
              sh """
                ssh -o StrictHostKeyChecking=no ${REMOTE_HOST} 'mkdir -p ${REMOTE_DIR}'
                rsync -av -e 'ssh -o StrictHostKeyChecking=no' --delete ${APP_DIR}/dist/ ${REMOTE_HOST}:${REMOTE_DIR}/
              """
            }
          } else {
            // Deploy lokal ke direktori web root
            sh "rsync -av --delete ${APP_DIR}/dist/ ${DEPLOY_DIR}/"
            // Jika butuh sudo: sh "sudo rsync -av --delete ${APP_DIR}/dist/ ${DEPLOY_DIR}/"
          }
        }
      }
    }
  }
  post {
    success { echo 'Build & Deploy sukses.' }
    failure { echo 'Build/Deploy gagal. Cek log di Jenkins.' }
  }
}

