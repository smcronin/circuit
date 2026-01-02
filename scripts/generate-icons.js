const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const SVG_PATH = path.join(ASSETS_DIR, 'file (1).svg');

// App theme colors
const BACKGROUND_COLOR = '#0F172A';
const LOGO_COLOR = '#38BDF8'; // Sky-400 - a nice cyan/blue that matches circuit theme

async function generateIcons() {
  // Read the SVG and replace black with our logo color
  let svgContent = fs.readFileSync(SVG_PATH, 'utf8');

  // Replace black fills with our chosen color
  svgContent = svgContent.replace(/fill="#000000"/g, `fill="${LOGO_COLOR}"`);

  // Create buffer from modified SVG
  const svgBuffer = Buffer.from(svgContent);

  // Generate icon.png (1024x1024) - main app icon with padding
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: BACKGROUND_COLOR
    }
  })
    .composite([{
      input: await sharp(svgBuffer)
        .resize(820, 820, { fit: 'contain' })
        .toBuffer(),
      gravity: 'center'
    }])
    .png()
    .toFile(path.join(ASSETS_DIR, 'icon.png'));

  console.log('Generated icon.png');

  // Generate adaptive-icon.png (1024x1024) - Android foreground with more padding
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }  // Transparent background
    }
  })
    .composite([{
      input: await sharp(svgBuffer)
        .resize(620, 620, { fit: 'contain' })
        .toBuffer(),
      gravity: 'center'
    }])
    .png()
    .toFile(path.join(ASSETS_DIR, 'adaptive-icon.png'));

  console.log('Generated adaptive-icon.png');

  // Generate splash-icon.png (512x512 for splash screen)
  await sharp(svgBuffer)
    .resize(512, 512, { fit: 'contain' })
    .png()
    .toFile(path.join(ASSETS_DIR, 'splash-icon.png'));

  console.log('Generated splash-icon.png');

  // Generate favicon.png (48x48)
  await sharp({
    create: {
      width: 48,
      height: 48,
      channels: 4,
      background: BACKGROUND_COLOR
    }
  })
    .composite([{
      input: await sharp(svgBuffer)
        .resize(40, 40, { fit: 'contain' })
        .toBuffer(),
      gravity: 'center'
    }])
    .png()
    .toFile(path.join(ASSETS_DIR, 'favicon.png'));

  console.log('Generated favicon.png');

  // Also save the recolored SVG for future reference
  fs.writeFileSync(path.join(ASSETS_DIR, 'circuit-logo.svg'), svgContent);
  console.log('Saved recolored circuit-logo.svg');

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
