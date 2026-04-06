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

                    # Tulis konfigurasi Nginx dengan SPA fallback
                    # try_files memastikan refresh manual di halaman manapun tetap berfungsi
                    cat > /etc/nginx/sites-available/${FRONTEND_DOMAIN} << 'NGINX_EOF'
server {
    listen 80;
    server_name unklab-aicode.online www.unklab-aicode.online;
    root /var/www/frontend;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    gzip_min_length 1000;

    # Cache aset statis (js, css, img)
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # SPA fallback — WAJIB agar refresh manual tidak 404
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX_EOF

                    # Aktifkan site jika belum
                    ln -sf /etc/nginx/sites-available/${FRONTEND_DOMAIN} /etc/nginx/sites-enabled/${FRONTEND_DOMAIN} 2>/dev/null || true

                    # Tes konfigurasi Nginx sebelum reload
                    nginx -t && systemctl reload nginx
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