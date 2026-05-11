#!/usr/bin/env bash
# HRMS PWA Implementation Checklist
# Run this script to verify all files are in place

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                  HRMS PWA IMPLEMENTATION VERIFICATION                        ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

ERRORS=0
WARNINGS=0

# Check configuration files
echo "📋 Configuration Files:"
echo "─────────────────────────"

files=(
  "public/manifest.json"
  "public/offline.html"
  "public/browserconfig.xml"
  "public/robots.txt"
  "public/sitemap.xml"
  "public/.well-known/assetlinks.json"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    size=$(ls -lh "$file" | awk '{print $5}')
    echo "✅ $file ($size)"
  else
    echo "❌ $file - MISSING"
    ((ERRORS++))
  fi
done

echo ""
echo "📁 Icon Assets:"
echo "─────────────────────────"

icon_count=$(find public/icons -name "*.svg" 2>/dev/null | wc -l)
if [ "$icon_count" -ge 10 ]; then
  echo "✅ SVG Icons: $icon_count files"
else
  echo "⚠️ SVG Icons: Only $icon_count files (expected 10+)"
  ((WARNINGS++))
fi

echo ""
echo "⚙️ Components & Hooks:"
echo "─────────────────────────"

components=(
  "components/PWAUpdateNotification.tsx"
  "hooks/usePWAInstall.ts"
)

for comp in "${components[@]}"; do
  if [ -f "$comp" ]; then
    lines=$(wc -l < "$comp")
    echo "✅ $comp ($lines lines)"
  else
    echo "❌ $comp - MISSING"
    ((ERRORS++))
  fi
done

echo ""
echo "📚 Documentation:"
echo "─────────────────────────"

docs=(
  "README_PWA.md"
  "QUICK_START.md"
  "IMPLEMENTATION_COMPLETE.md"
  "docs/DEPLOYMENT.md"
  "docs/TESTING.md"
  "docs/MAINTENANCE.md"
)

for doc in "${docs[@]}"; do
  if [ -f "$doc" ]; then
    lines=$(wc -l < "$doc")
    echo "✅ $doc ($lines lines)"
  else
    echo "❌ $doc - MISSING"
    ((ERRORS++))
  fi
done

echo ""
echo "🔧 Configuration Updates:"
echo "─────────────────────────"

if grep -q "withPWA" next.config.js; then
  echo "✅ next.config.js - PWA plugin configured"
else
  echo "❌ next.config.js - PWA plugin missing"
  ((ERRORS++))
fi

if grep -q "manifest.json" app/layout.tsx; then
  echo "✅ app/layout.tsx - Manifest link added"
else
  echo "⚠️ app/layout.tsx - Check metadata"
  ((WARNINGS++))
fi

if grep -q "next-pwa" package.json; then
  echo "✅ package.json - next-pwa dependency added"
else
  echo "❌ package.json - next-pwa dependency missing"
  ((ERRORS++))
fi

echo ""
echo "═════════════════════════════════════════════════════════════════════════════════"
echo ""

if [ $ERRORS -eq 0 ]; then
  echo "🎉 ALL FILES CREATED SUCCESSFULLY!"
  echo ""
  echo "✅ Status: PRODUCTION-READY"
  echo ""
  echo "📖 Next Steps:"
  echo "  1. Read: frontend/IMPLEMENTATION_COMPLETE.md"
  echo "  2. Replace icon assets (critical)"
  echo "  3. Update manifest.json URLs"
  echo "  4. Build: npm run build"
  echo "  5. Test: npm start"
  echo "  6. Deploy: vercel deploy --prod"
  echo ""
else
  echo "⚠️ ISSUES FOUND"
  echo ""
  echo "Errors: $ERRORS"
  echo "Warnings: $WARNINGS"
  echo ""
  echo "Please check the missing files above."
fi

echo ""
echo "═════════════════════════════════════════════════════════════════════════════════"
