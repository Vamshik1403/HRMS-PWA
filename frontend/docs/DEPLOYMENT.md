# PWA Deployment Guide for HRMS

Complete guide for deploying the HRMS Progressive Web App in production environments.

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Vercel Deployment (Recommended)](#vercel-deployment-recommended)
3. [VPS/Self-Hosted Deployment](#vpsself-hosted-deployment)
4. [HTTPS Configuration](#https-configuration)
5. [Environment Variables](#environment-variables)
6. [Performance Optimization](#performance-optimization)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

Before deploying to production, ensure:

- [ ] Replace placeholder icons in `public/icons/` with your brand icons
- [ ] Update `public/manifest.json` with correct URLs and metadata
- [ ] Update `public/sitemap.xml` with actual domain
- [ ] Update `robots.txt` according to your indexing policy
- [ ] Configure environment variables (see [Environment Variables](#environment-variables))
- [ ] Test PWA installation locally on Android and iOS
- [ ] Verify HTTPS is available on your domain
- [ ] Run Lighthouse PWA audit and score above 90
- [ ] Test offline functionality
- [ ] Update `.well-known/assetlinks.json` for Android verification (optional)
- [ ] Set up service worker update strategy
- [ ] Configure logging and monitoring

---

## Vercel Deployment (Recommended)

Vercel is the optimal platform for Next.js and PWA applications.

### Step 1: Prepare Your Repository

```bash
# Ensure all PWA files are committed
git add public/manifest.json public/icons/ public/offline.html
git add next.config.js app/layout.tsx
git commit -m "feat: add PWA configuration"
git push origin main
```

### Step 2: Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from project root
cd /home/server/hrms
vercel deploy

# Or deploy frontend specifically
cd frontend
vercel deploy
```

### Step 3: Configure Vercel Settings

In your Vercel project dashboard:

1. **Settings → Build & Development Settings**
   - Build Command: `next build`
   - Output Directory: `.next`
   - Install Command: `npm install`

2. **Settings → Environment Variables**
   - Add required variables (see next section)

3. **Settings → Domains**
   - Add your custom domain
   - Configure DNS records

### Step 4: Enable HTTPS (Automatic)

Vercel automatically provisions SSL/TLS certificates via Let's Encrypt.

### Vercel Optimization Tips

```javascript
// next.config.js optimizations for Vercel
const nextConfig = {
  // Enable automatic static optimization
  staticPageGenerationTimeout: 60,
  
  // Compression
  compress: true,
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1 year
  },
};
```

### Monitoring Vercel Deployments

1. **Analytics**: View in Vercel dashboard
2. **Logs**: Check deployment logs in dashboard
3. **Rollback**: Quick rollback to previous deployments
4. **Previews**: Automatic preview deployments for PRs

---

## VPS/Self-Hosted Deployment

For deploying on your own server infrastructure.

### Option A: Nginx + Node.js

#### Prerequisites
- Ubuntu/Debian server with Node.js 18+
- Nginx installed and configured
- HTTPS certificate (Let's Encrypt)
- PM2 or similar process manager

#### Installation Steps

```bash
# 1. Connect to your server
ssh user@your-server.com

# 2. Clone repository
cd /home/apps
git clone https://github.com/yourrepo/hrms.git
cd hrms/frontend

# 3. Install dependencies
npm install --production

# 4. Build the application
npm run build

# 5. Create .env.production
cat > .env.production <<EOF
NEXT_PUBLIC_API_URL=https://api.yourapp.com
NEXT_PUBLIC_APP_URL=https://app.yourapp.com
NODE_ENV=production
EOF

# 6. Verify build
npm start
# Test at http://localhost:3001
# Press Ctrl+C to stop
```

#### Nginx Configuration

Create `/etc/nginx/sites-available/hrms-pwa`:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name app.yourapp.com;
    return 301 https://$server_name$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    server_name app.yourapp.com;

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/app.yourapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.yourapp.com/privkey.pem;

    # SSL security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers for PWA
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self)" always;

    # Service worker caching headers
    add_header Cache-Control "public, max-age=0, must-revalidate" always;
    add_header Service-Worker-Allowed "/" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css text/javascript application/javascript application/json;
    gzip_min_length 1000;
    gzip_vary on;

    # Root directory
    root /home/apps/hrms/frontend/.next/standalone/public;

    # PWA manifest
    location = /manifest.json {
        add_header Content-Type "application/manifest+json";
        try_files $uri =404;
    }

    # Service worker
    location = /sw.js {
        add_header Cache-Control "public, max-age=0, must-revalidate";
        add_header Service-Worker-Allowed "/";
        proxy_pass http://localhost:3001;
    }

    # Static assets - long caching
    location /_next/static {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # Icons
    location /icons {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # Offline fallback
    location = /offline.html {
        internal;
    }

    # API proxy
    location /backend {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Next.js proxy
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Offline fallback
        error_page 502 503 =200 /offline.html;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/hrms-pwa /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

#### Process Management with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: 'hrms-pwa',
    script: 'npm',
    args: 'start',
    cwd: '/home/apps/hrms/frontend',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/hrms-pwa-error.log',
    out_file: '/var/log/hrms-pwa-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '500M'
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 config for startup
pm2 save
pm2 startup
```

#### SSL/TLS Setup with Let's Encrypt

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Request certificate
sudo certbot certonly --nginx -d app.yourapp.com

# Auto-renewal (already configured with Certbot)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### Option B: Docker Deployment

```dockerfile
# Dockerfile for HRMS PWA
FROM node:18-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t hrms-pwa .
docker run -p 3001:3001 -e NODE_ENV=production hrms-pwa
```

---

## HTTPS Configuration

### Why HTTPS is Critical for PWA

- Service workers require HTTPS
- Manifest.json requires HTTPS
- Installation prompts require HTTPS
- Offline functionality requires HTTPS

### Obtaining Certificates

#### Option 1: Let's Encrypt (Free)
```bash
# Using Certbot
sudo certbot certonly --standalone -d app.yourapp.com

# Automatic renewal
sudo certbot renew --quiet --noninteractive --post-hook "systemctl reload nginx"
```

#### Option 2: Commercial Certificates
- DigiCert
- GlobalSign
- Comodo (Sectigo)

#### Nginx HTTPS Configuration
```nginx
ssl_certificate /path/to/certificate.crt;
ssl_certificate_key /path/to/private.key;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers on;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# HSTS header (force HTTPS)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

---

## Environment Variables

Create `.env.production` file:

```bash
# App Configuration
NEXT_PUBLIC_APP_NAME="HR Management System"
NEXT_PUBLIC_APP_URL=https://app.yourapp.com
NEXT_PUBLIC_API_URL=https://api.yourapp.com

# Backend Configuration
BACKEND_URL=http://localhost:8001
DATABASE_URL=postgresql://user:password@db-server:5432/hrms

# Security
JWT_SECRET=your-secret-key-here
SESSION_SECRET=your-session-secret-here

# Feature Flags
NEXT_PUBLIC_ENABLE_PWA=true
NEXT_PUBLIC_ENABLE_OFFLINE=true
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true

# Analytics (Optional)
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=UA-XXXXXXXXX-X
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx

# Environment
NODE_ENV=production
```

---

## Performance Optimization

### Image Optimization

```javascript
// next.config.js
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    sizes: [
      320, 420, 640, 768, 1024, 1280, 1536, 1920
    ],
    deviceSizes: [
      640, 750, 828, 1080, 1200, 1920, 2048, 3840
    ],
    minimumCacheTTL: 31536000, // 1 year for static images
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};
```

### Service Worker Caching Strategy

Configured in `next.config.js`:

```javascript
runtimeCaching: [
  // API responses - Network first (5 min cache)
  {
    urlPattern: /^https?.*\/(api|backend)\/.*/i,
    handler: 'NetworkFirst',
    options: {
      cacheName: 'api-cache',
      networkTimeoutSeconds: 10,
      expiration: { maxAgeSeconds: 300 }
    },
  },
  // Images - Cache first (30 days)
  {
    urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif)$/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'image-cache',
      expiration: { maxAgeSeconds: 2592000 }
    },
  },
  // Static files - Cache first (1 year)
  {
    urlPattern: /\.(?:js|css|woff2|woff)$/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'static-cache',
      expiration: { maxAgeSeconds: 31536000 }
    },
  },
];
```

### Database Connection Pooling

```env
# .env.production
DATABASE_URL="postgresql://user:pass@host:5432/hrms?pool_size=20&max_overflow=40"
```

### CDN Configuration

```nginx
# Nginx - Set Expires headers for static files
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## Monitoring & Maintenance

### Service Worker Cache Management

Monitor cache size periodically. Clear old caches:

```javascript
// Script to run maintenance
// Add to backend cron jobs
const cacheNames = [
  'api-cache',
  'image-cache',
  'static-cache',
  'html-cache'
];

cacheNames.forEach(name => {
  caches.open(name).then(cache => {
    cache.keys().then(keys => {
      keys.forEach(request => {
        cache.delete(request);
      });
    });
  });
});
```

### Logging & Error Tracking

```javascript
// Sentry setup for error tracking
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

### Monitoring Tools

- **Vercel Analytics**: Built-in for Vercel deployments
- **Lighthouse**: Regular PWA audits
- **New Relic**: Real User Monitoring (RUM)
- **Datadog**: Infrastructure monitoring
- **LogRocket**: Session replay and error tracking

---

## Troubleshooting

### Service Worker Not Updating

**Problem**: Users don't get latest version

**Solution**:
```javascript
// Force service worker update check
if ('serviceWorker' in navigator) {
  const interval = setInterval(() => {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) reg.update();
    });
  }, 60000); // Check every minute
}
```

### Cache Not Clearing

**Problem**: Old files served from cache

**Solution**:
```bash
# Clear Next.js cache
rm -rf .next/cache

# Rebuild
npm run build

# Restart app
pm2 restart hrms-pwa
```

### HTTPS Certificate Expired

**Problem**: SSL/TLS certificate expired

**Solution**:
```bash
# Renew Let's Encrypt certificate
sudo certbot renew --force-renewal

# For commercial certificates, follow provider instructions
# Then update nginx config and restart
sudo nginx -t
sudo systemctl restart nginx
```

### PWA Won't Install

**Problem**: Installation prompt not showing

**Checklist**:
- [ ] Site is HTTPS
- [ ] manifest.json is valid (validate at https://www.pwabuilder.com/)
- [ ] Service worker is registered
- [ ] Icons are present and correct format
- [ ] User hasn't dismissed prompt recently
- [ ] Domain is not localhost

### Offline Mode Not Working

**Problem**: Pages won't load offline

**Solution**:
1. Check service worker registration: `navigator.serviceWorker.getRegistrations()`
2. Check cache storage: DevTools → Application → Cache Storage
3. Verify offline.html exists
4. Test in DevTools offline mode

---

## Maintenance Checklist

- [ ] Weekly: Monitor error logs and performance metrics
- [ ] Monthly: Review cache hit rates and adjust strategy
- [ ] Monthly: Check for service worker updates
- [ ] Quarterly: Run full Lighthouse audit
- [ ] Quarterly: Update dependencies and security patches
- [ ] Annually: Review and update manifest.json metadata

