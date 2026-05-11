import fs from 'fs';
import path from 'path';

// Simple icon generator using SVG to PNG conversion
// This creates placeholder icons that you should replace with your actual brand icons

const iconDir = './public/icons';

// Create icons directory
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Define colors for the HRMS app
const primaryColor = '#1e40af'; // Blue
const secondaryColor = '#1e3a8a'; // Darker blue

// Generate SVG icons
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create simple SVG icon generator
function generateSVG(size, isMaskable = false) {
  const fontSize = Math.floor(size / 3);
  const shapeSize = isMaskable ? size : size;
  const shape = isMaskable 
    ? `<circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="url(#grad)"/>` 
    : `<rect width="${size}" height="${size}" fill="url(#grad)"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${secondaryColor};stop-opacity:1" />
    </linearGradient>
  </defs>
  ${shape}
  <text x="50%" y="52%" font-size="${fontSize}" fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold" font-family="Arial, sans-serif" letter-spacing="2">HR</text>
</svg>`;
}

// Write SVG files
console.log('Generating PWA icon SVG templates...');
sizes.forEach(size => {
  const svg = generateSVG(size, false);
  const svgPath = path.join(iconDir, `icon-${size}.svg`);
  fs.writeFileSync(svgPath, svg);
  console.log(`✓ Generated SVG: icon-${size}.svg`);
});

// Generate maskable icons
[192, 512].forEach(size => {
  const svg = generateSVG(size, true);
  const svgPath = path.join(iconDir, `maskable-icon-${size}.svg`);
  fs.writeFileSync(svgPath, svg);
  console.log(`✓ Generated SVG: maskable-icon-${size}.svg`);
});

// Create placeholder PNG files with basic data
// For production, convert these SVGs to PNG or replace with actual brand icons
console.log('\nCreating placeholder PNG files...');
console.log('Note: These are placeholder SVG files. To use as PWA:');
console.log('  1. Convert SVGs to PNG using an online converter or tool');
console.log('  2. Or replace with your actual brand icon PNG files');
console.log('  3. Ensure icons are properly sized for the manifest.json');

// Create a simple placeholder PNG (1x1 blue pixel) for testing
// In production, replace these with actual icon files
const placeholderPNG = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
  0x00, 0x00, 0x00, 0x0D, // IHDR chunk size
  0x49, 0x48, 0x44, 0x52, // IHDR
  0x00, 0x00, 0x00, 0x01, // width: 1
  0x00, 0x00, 0x00, 0x01, // height: 1
  0x08, 0x02, // bit depth: 8, color type: 2 (RGB)
  0x00, 0x00, 0x00, // compression, filter, interlace
  0x90, 0x77, 0x53, 0xDE, // CRC
  0x00, 0x00, 0x00, 0x0C, // IDAT chunk size
  0x49, 0x44, 0x41, 0x54, // IDAT
  0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0xFE, 0xFF, // zlib header + literal
  0x1E, 0x40, 0xAF, 0x00, // RGB blue color (30, 64, 175)
  0x8C, 0xE9, 0x2C, 0xC2, // CRC
  0x00, 0x00, 0x00, 0x00, // IEND chunk size
  0x49, 0x45, 0x4E, 0x44, // IEND
  0xAE, 0x42, 0x60, 0x82  // CRC
]);

sizes.forEach(size => {
  const pngPath = path.join(iconDir, `icon-${size}.png`);
  fs.writeFileSync(pngPath, placeholderPNG);
});

[192, 512].forEach(size => {
  const pngPath = path.join(iconDir, `maskable-icon-${size}.png`);
  fs.writeFileSync(pngPath, placeholderPNG);
});

console.log('\n✓ Placeholder icons created in ./public/icons/');
console.log('\n⚠️  ACTION REQUIRED:');
console.log('  Replace placeholder icons with your actual brand icons:');
console.log('  - Convert the SVG files to PNG');
console.log('  - Or place your own PNG icon files in ./public/icons/');
console.log('  - Ensure icons match the sizes defined in manifest.json');
console.log('\n  Tools to convert SVG to PNG:');
console.log('  - SVGOMG (https://jakearchibald.github.io/svgomg/)');
console.log('  - Cloudconvert (https://cloudconvert.com/svg-to-png)');
console.log('  - Local ImageMagick: convert icon-512.svg icon-512.png');
console.log('  - NPM tool: pwa-asset-generator');
