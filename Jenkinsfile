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

                // Step 1: Rsync build ke folder Nginx (pakai GString agar env var bisa dipakai)
                sh """
                    mkdir -p ${FRONTEND_DIR}
                    rsync -av --delete ./dist/ ${FRONTEND_DIR}/
                """

                // Step 2: Tulis Nginx config — PAKAI single-quote SH agar $uri tidak di-parse Groovy!
                // try_files $uri $uri/ /index.html adalah kunci agar SPA tidak 404 saat refresh manual
                sh '''
                    cat > /etc/nginx/sites-available/unklab-aicode.online << 'NGINX_EOF'
server {
    listen 80;
    server_name unklab-aicode.online www.unklab-aicode.online;
    root /var/www/frontend;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    gzip_min_length 1000;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX_EOF

                    ln -sf /etc/nginx/sites-available/unklab-aicode.online \
                           /etc/nginx/sites-enabled/unklab-aicode.online 2>/dev/null || true
                    nginx -t && systemctl reload nginx
                '''
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