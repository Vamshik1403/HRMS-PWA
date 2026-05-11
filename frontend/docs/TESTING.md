# PWA Testing & Validation Guide

Comprehensive testing checklist for the HRMS PWA application.

## Table of Contents
1. [Pre-Testing Setup](#pre-testing-setup)
2. [Local Testing](#local-testing)
3. [Lighthouse PWA Audit](#lighthouse-pwa-audit)
4. [Android Testing](#android-testing)
5. [iOS Testing](#ios-testing)
6. [Network Testing](#network-testing)
7. [Performance Testing](#performance-testing)
8. [Security Testing](#security-testing)
9. [Accessibility Testing](#accessibility-testing)
10. [Production Testing](#production-testing)

---

## Pre-Testing Setup

### Tools Required

- Chrome DevTools (built-in)
- Lighthouse (Chrome DevTools)
- Android device or emulator
- iOS device (for true iOS testing) or iPhone simulator
- Network throttling tools
- Performance testing tools

### Initial Checks

- [ ] Run `npm run build` successfully
- [ ] No build warnings or errors
- [ ] All PWA files present: `manifest.json`, icons, `offline.html`
- [ ] Service worker can be downloaded (check Network tab)

---

## Local Testing

### 1. Build for Production

```bash
cd /home/server/hrms/frontend
npm run build
npm start
```

Access at `http://localhost:3001`

### 2. Service Worker Registration

**In Chrome DevTools:**

```javascript
// Check if service worker is registered
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('Service Workers:', registrations);
});

// Check for updates
navigator.serviceWorker.getRegistration().then(registration => {
  if (registration) {
    registration.update();
  }
});
```

**Steps:**
1. Open Chrome DevTools (F12)
2. Go to Application → Service Workers
3. Verify `sw.js` is listed as "activated and running"
4. Check "Offline" checkbox to simulate offline
5. Refresh page - should still load

### 3. Manifest.json Validation

**In Chrome DevTools:**

1. Go to Application → Manifest
2. Verify all information displays correctly:
   - [ ] App name: "HR Management System"
   - [ ] Short name: "HRMS"
   - [ ] Display mode: "standalone"
   - [ ] Theme color: "#000000"
   - [ ] Icons: All sizes showing
   - [ ] Start URL: "/"
   - [ ] Scope: "/"

**Online Validation:**
```bash
# Validate at PWA Builder
# https://www.pwabuilder.com/
# Upload your manifest.json or domain
```

### 4. Install Prompt Testing

**Steps:**
1. Open DevTools
2. Go to Application → Manifest
3. Look for "Install" button (if site meets PWA criteria)
4. Click to test install prompt
5. Verify prompt appears correctly

Or programmatically:
```javascript
// Trigger install prompt manually
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  console.log('Install prompt available');
  // Save event for later use
});
```

### 5. Cache Testing

**View cached files:**

1. DevTools → Application → Cache Storage
2. Expand each cache name:
   - [ ] `api-cache` - API responses
   - [ ] `image-cache` - Images
   - [ ] `static-cache` - JS/CSS
   - [ ] `html-cache` - HTML pages

**Test cache updates:**
```javascript
// Clear all caches
const cacheNames = ['api-cache', 'image-cache', 'static-cache', 'html-cache'];
Promise.all(
  cacheNames.map(name => caches.delete(name))
).then(() => console.log('Caches cleared'));

// View cache size
let totalSize = 0;
caches.keys().then(names => {
  names.forEach(name => {
    caches.open(name).then(cache => {
      cache.keys().then(requests => {
        console.log(`${name}: ${requests.length} files`);
      });
    });
  });
});
```

### 6. Offline Testing

**Test offline functionality:**

1. DevTools → Network tab
2. Check "Offline" checkbox
3. Try these scenarios:
   - [ ] Navigate to home page - should load from cache
   - [ ] Navigate to different pages - should load from cache
   - [ ] Try API call - should fail gracefully (check offline.html fallback)
   - [ ] Refresh page - should load from cache
4. Uncheck "Offline"
5. Refresh - should load fresh data from server

**Test in Application Pane:**
1. Go to Application → Service Workers
2. Check "Offline"
3. Navigate around the app
4. Check console for service worker logs

### 7. Storage and Quota Testing

```javascript
// Check storage quota
if (navigator.storage && navigator.storage.estimate) {
  navigator.storage.estimate().then(estimate => {
    console.log(`Storage quota: ${(estimate.quota / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Storage used: ${(estimate.usage / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Percentage used: ${(estimate.usage / estimate.quota * 100).toFixed(2)}%`);
  });
}
```

---

## Lighthouse PWA Audit

### Running Lighthouse

**Method 1: Chrome DevTools (Recommended)**

1. Open Chrome DevTools (F12)
2. Go to Lighthouse tab
3. Select:
   - Device: Mobile
   - Categories: PWA
   - Uncheck other categories
4. Click "Analyze page load"

**Method 2: CLI**

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run audit
lighthouse http://localhost:3001 --output-path=./report.html --preset=light

# View report
open ./report.html
```

### PWA Audit Checklist

**Target Score: 90+**

- [ ] Web App Manifest
  - [ ] Manifest exists
  - [ ] Name property
  - [ ] Short name property
  - [ ] Start URL
  - [ ] Display property
  - [ ] Icons (192x192, 512x512)
  - [ ] Theme color
  - [ ] Background color

- [ ] Service Worker
  - [ ] Service worker registered
  - [ ] Service worker valid JavaScript
  - [ ] Service worker offline functionality
  - [ ] Responds to fetch events

- [ ] HTTPS & Security
  - [ ] Served over HTTPS
  - [ ] No insecure mixed content
  - [ ] Valid SSL certificate

- [ ] UX & Mobile
  - [ ] Viewport configured
  - [ ] Mobile-friendly
  - [ ] Touch icons for apple
  - [ ] No redirect at install time

- [ ] Performance
  - [ ] Fast start (< 3.5s)
  - [ ] Fast repeat visits (< 1.5s)
  - [ ] Efficient image usage
  - [ ] Proper caching headers

### Interpreting Results

| Score | Status | Action |
|-------|--------|--------|
| 90+ | Good | Ready for production |
| 70-89 | Fair | Address warnings |
| < 70 | Poor | Fix critical issues |

---

## Android Testing

### Setup: Real Device

**Requirements:**
- Android 5.0+ device with Chrome
- USB cable and USB debugging enabled

**Enable USB Debugging:**
1. Settings → About → Build Number (tap 7 times)
2. Settings → Developer Options → USB Debugging (enable)
3. Connect to computer

**Access from Computer:**

```bash
# Connect device
adb devices  # Verify connection

# Remote debugging
# In Chrome: chrome://inspect/#devices
```

### Setup: Android Emulator

```bash
# Using Android Studio
1. Open Android Studio
2. Tools → AVD Manager
3. Create virtual device (API 30+)
4. Start emulator
5. Open Chrome on emulator
```

### Testing Checklist: Android

**Installation**

- [ ] Installation prompt appears
- [ ] "Add to Home Screen" button works
- [ ] App icon appears on home screen
- [ ] App name displays correctly
- [ ] App opens in fullscreen/standalone mode
- [ ] No address bar or browser UI visible

**Functionality**

- [ ] App loads quickly
- [ ] Navigation works smoothly
- [ ] All pages render correctly
- [ ] Touch interactions responsive
- [ ] Form inputs work (keyboard appears)
- [ ] Scrolling smooth

**Offline**

- [ ] Offline pages load from cache
- [ ] Offline.html displays when no connection
- [ ] Data updates when back online
- [ ] No blank screens

**Performance**

- [ ] First paint < 2s
- [ ] Interactive < 3.5s
- [ ] Smooth animations
- [ ] No jank during scroll

**Caching**

- [ ] Images cached properly
- [ ] Static assets cached
- [ ] API responses cached
- [ ] Cache updates working

---

## iOS Testing

### Setup: Real Device

**Requirements:**
- iPhone/iPad with iOS 13+
- macOS computer (for Xcode)

**Enable Web App Mode:**
1. Open Safari
2. Navigate to: `https://app.yourapp.com`
3. Tap Share button
4. Tap "Add to Home Screen"
5. Confirm app name
6. Tap "Add"

### Setup: iOS Simulator

```bash
# Using Xcode
1. Open Xcode
2. Xcode → Open Developer Tool → Simulator
3. Select iPhone model
4. Open Safari in simulator
5. Navigate to app URL
```

### Testing Checklist: iOS

**Installation**

- [ ] Share sheet appears with "Add to Home Screen"
- [ ] App can be added to home screen
- [ ] App icon appears on home screen
- [ ] App name is correct
- [ ] Splash screen shows during load
- [ ] App opens fullscreen

**Appearance**

- [ ] Status bar color matches theme
- [ ] App looks like native app
- [ ] Notch/safe area handled correctly
- [ ] Portrait and landscape modes work
- [ ] Safe area respected

**Functionality**

- [ ] All pages load and render
- [ ] Navigation responsive
- [ ] Touch gestures work (swipe, pinch, long-press)
- [ ] Forms usable with iOS keyboard
- [ ] Share functionality works
- [ ] Clipboard access works

**Performance**

- [ ] App launches quickly (< 2s)
- [ ] Smooth interactions
- [ ] No jank or stuttering
- [ ] Memory usage reasonable

**iOS Limitations to Document**

- [ ] Background sync not supported
- [ ] Limited cache size (~50MB)
- [ ] No service worker sharing between apps
- [ ] "Add to Home Screen" required for offline
- [ ] CORS headers must be correct

### iOS PWA Limitations vs Android

| Feature | iOS | Android |
|---------|-----|---------|
| Installation | Share → Add to Home Screen | Install Prompt |
| Offline Mode | Requires home screen icon | Works in browser |
| Background Sync | Not supported | Supported |
| Push Notifications | Limited | Fully supported |
| Cache Size | ~50MB | ~350MB |
| Cache Persistence | Limited | Full persistence |

---

## Network Testing

### Throttling Testing

**Chrome DevTools:**

1. DevTools → Network tab
2. Change throttling from "No throttling" to:
   - [ ] Fast 3G (1.6 Mbps down, 750 Kbps up)
   - [ ] Slow 3G (400 Kbps down, 400 Kbps up)
   - [ ] Offline

**Test scenarios:**
- [ ] Page load on Fast 3G
- [ ] Page load on Slow 3G
- [ ] API calls with latency
- [ ] Image loading
- [ ] Cache hit/miss behavior

### DNS Testing

```bash
# Test DNS resolution
nslookup app.yourapp.com

# Test from different locations
# Use online DNS checker: https://dnschecker.org
```

### Latency Testing

```bash
# Test with artificial latency
# In DevTools Network: Right-click request → Edit and resend
# Add latency to see impact
```

---

## Performance Testing

### Metrics to Monitor

| Metric | Target | Tool |
|--------|--------|------|
| Largest Contentful Paint (LCP) | < 2.5s | Lighthouse, DevTools |
| First Input Delay (FID) | < 100ms | Lighthouse, Web Vitals |
| Cumulative Layout Shift (CLS) | < 0.1 | Lighthouse, Web Vitals |
| First Contentful Paint (FCP) | < 1.8s | Lighthouse |
| Time to Interactive (TTI) | < 3.8s | Lighthouse |

### Performance Testing Steps

```bash
# Run Lighthouse performance audit
lighthouse http://localhost:3001 \
  --preset=light \
  --output-path=./performance-report.html

# Or use web.dev
# https://web.dev/measure/
```

### Real User Monitoring

```javascript
// Add to app for production monitoring
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

export function reportWebVitals(metric) {
  console.log(metric);
  // Send to analytics: Google Analytics, Sentry, etc.
}

getCLS(reportWebVitals);
getFID(reportWebVitals);
getFCP(reportWebVitals);
getLCP(reportWebVitals);
getTTFB(reportWebVitals);
```

---

## Security Testing

### HTTPS & Certificate

- [ ] Site loads over HTTPS
- [ ] SSL certificate valid
- [ ] No mixed content warnings
- [ ] Certificate chain valid

**Test in DevTools:**
1. DevTools → Security tab
2. Should show "Secure"
3. Click cert to view details
4. Verify domain matches

### Security Headers

```bash
# Check security headers
curl -I https://app.yourapp.com | grep -E "X-|Strict|Referrer|Permissions"

# Expected headers:
# X-Content-Type-Options: nosniff
# X-Frame-Options: SAMEORIGIN
# X-XSS-Protection: 1; mode=block
# Strict-Transport-Security: max-age=...
# Referrer-Policy: strict-origin-when-cross-origin
# Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### CSP (Content Security Policy)

```javascript
// Check CSP in DevTools Console
// Should see CSP violations if any
```

### CORS Testing

```javascript
// Test cross-origin requests
fetch('https://api.yourapp.com/endpoint')
  .then(r => r.json())
  .then(data => console.log(data))
  .catch(e => console.error('CORS Error:', e));
```

---

## Accessibility Testing

### Automated Testing

```bash
# Install axe DevTools
# https://www.deque.com/axe/devtools/

# Or use Lighthouse accessibility audit
```

**Manual Testing:**

- [ ] Keyboard navigation works (Tab key)
- [ ] All interactive elements focusable
- [ ] Focus indicators visible
- [ ] Color contrast sufficient
- [ ] Images have alt text
- [ ] Form labels present
- [ ] Error messages clear

**Screen Reader Testing:**

- [ ] Install NVDA (Windows) or VoiceOver (macOS/iOS)
- [ ] Navigate entire app with screen reader
- [ ] All content readable
- [ ] Form labels announced
- [ ] Errors announced

---

## Production Testing

### Pre-Production Checklist

- [ ] All tests passing locally
- [ ] Lighthouse score 90+
- [ ] Tested on real Android device
- [ ] Tested on real iOS device
- [ ] All manifest fields correct
- [ ] Icons optimized
- [ ] Offline page works
- [ ] No console errors
- [ ] No console warnings
- [ ] HTTPS working
- [ ] Service worker updating
- [ ] Caching strategy verified
- [ ] Database connections stable
- [ ] API rate limiting working
- [ ] Error logging configured
- [ ] Monitoring configured

### Post-Production Testing

**First 24 Hours:**

- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Verify cache hit rates
- [ ] Test user installation flow
- [ ] Monitor API response times

**First Week:**

- [ ] Review user feedback
- [ ] Analyze Lighthouse scores from production
- [ ] Check service worker update logs
- [ ] Monitor offline usage
- [ ] Verify analytics

---

## Testing Automation

### CI/CD Integration

```yaml
# GitHub Actions example
name: PWA Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build
      
      - name: Run Lighthouse
        run: |
          npm install -g lighthouse
          lighthouse http://localhost:3001 \
            --preset=light \
            --output-path=./lighthouse.html
      
      - name: Check manifest
        run: node scripts/validate-manifest.mjs
      
      - name: Upload reports
        uses: actions/upload-artifact@v2
        with:
          name: reports
          path: ./lighthouse.html
```

---

## Testing Troubleshooting

### Service Worker Won't Register

**Problem**: SW doesn't appear in DevTools

**Solutions**:
1. Check if HTTPS/localhost
2. Check console for errors
3. Verify `sw.js` can be downloaded
4. Clear site data and retry
5. Check next.config.js `sw` property

### Installation Prompt Won't Show

**Problem**: Install button missing

**Solutions**:
1. Verify HTTPS
2. Check manifest.json validity
3. Ensure icons 192x192 and 512x512 exist
4. Clear browser cache
5. Use fresh browser profile
6. Wait 3+ page visits
7. Have diverse interaction

### Offline Page Shows on Online Connection

**Problem**: offline.html displays incorrectly

**Solutions**:
1. Check service worker error handling
2. Verify offline.html exists
3. Test in actual offline mode
4. Check nginx/server configuration

---

## Automated Test Scripts

### validate-manifest.mjs

```javascript
import fs from 'fs';

const manifest = JSON.parse(fs.readFileSync('./public/manifest.json', 'utf-8'));

const checks = [
  { key: 'name', required: true },
  { key: 'short_name', required: true },
  { key: 'start_url', required: true },
  { key: 'display', required: true },
  { key: 'icons', required: true },
  { key: 'theme_color', required: true },
  { key: 'background_color', required: true },
];

let passed = 0;
let failed = 0;

checks.forEach(check => {
  if (manifest[check.key]) {
    console.log(`✓ ${check.key} found`);
    passed++;
  } else if (check.required) {
    console.error(`✗ ${check.key} missing`);
    failed++;
  }
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

---

## Final Sign-Off

Before going live:

- [ ] All checklist items completed
- [ ] Lighthouse score ≥ 90
- [ ] Tested on Android (real/emulator)
- [ ] Tested on iOS (real/simulator)
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Accessibility verified
- [ ] Error logging working
- [ ] Monitoring configured
- [ ] Documentation complete

**Approved by**: ________________  
**Date**: ________________

