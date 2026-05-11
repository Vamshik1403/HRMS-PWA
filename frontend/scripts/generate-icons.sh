#!/bin/bash
# PWA Icon Generation Script
# Creates placeholder icons in various sizes for PWA

# This script requires ImageMagick: sudo apt-get install imagemagick

# Define icon sizes
SIZES=(72 96 128 144 152 192 384 512)
ICON_DIR="./public/icons"

# Create icons directory
mkdir -p "$ICON_DIR"

echo "Generating PWA icons..."

# Generate colored square icons (placeholder)
# Replace this section with your actual icon generation
for SIZE in "${SIZES[@]}"; do
  # Create a simple SVG-based icon
  cat > "${ICON_DIR}/icon-${SIZE}-temp.svg" <<EOF
<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e40af;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1e3a8a;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#grad)"/>
  <text x="50%" y="50%" font-size="$((SIZE/3))" fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold" font-family="Arial">HR</text>
</svg>
EOF

  # Convert SVG to PNG using ImageMagick (if available)
  if command -v convert &> /dev/null; then
    convert "${ICON_DIR}/icon-${SIZE}-temp.svg" "${ICON_DIR}/icon-${SIZE}.png"
    rm "${ICON_DIR}/icon-${SIZE}-temp.svg"
  else
    echo "Warning: ImageMagick not found. Please install it: sudo apt-get install imagemagick"
    echo "Or manually create PNG icons and place them in ${ICON_DIR}/"
  fi
done

# Generate maskable icons (for Android adaptive icons)
for SIZE in 192 512; do
  cat > "${ICON_DIR}/maskable-icon-${SIZE}-temp.svg" <<EOF
<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e40af;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1e3a8a;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="$((SIZE/2))" cy="$((SIZE/2))" r="$((SIZE/2))" fill="url(#grad2)"/>
  <text x="50%" y="50%" font-size="$((SIZE/3))" fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold" font-family="Arial">HR</text>
</svg>
EOF

  if command -v convert &> /dev/null; then
    convert "${ICON_DIR}/maskable-icon-${SIZE}-temp.svg" "${ICON_DIR}/maskable-icon-${SIZE}.png"
    rm "${ICON_DIR}/maskable-icon-${SIZE}-temp.svg"
  fi
done

echo "Icon generation complete!"
echo "Icons generated in: ${ICON_DIR}/"
echo ""
echo "IMPORTANT: Replace these placeholder icons with your actual brand icons:"
echo "  - Use a 512x512 PNG as the base"
echo "  - Generate other sizes from the same source"
echo "  - For maskable icons, ensure a 20% safe zone on all sides"
echo ""
echo "Recommended tools:"
echo "  - ImageMagick (convert command)"
echo "  - GIMP"
echo "  - Figma"
echo "  - Web-based tools like pwa-asset-generator"
