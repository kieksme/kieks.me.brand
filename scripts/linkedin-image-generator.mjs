#!/usr/bin/env node
/**
 * LinkedIn Image Generator
 * Generates LinkedIn-compliant images for company pages and career pages
 */

import { fileURLToPath } from 'url';
import { dirname, join, resolve, extname, basename } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import sharp from 'sharp';
import inquirer from 'inquirer';
import {
  header,
  success,
  error,
  info,
  warn,
} from './misc-cli-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// LinkedIn image type specifications
const LINKEDIN_SPECS = {
  logo: {
    min: { width: 268, height: 268 },
    recommended: { width: 400, height: 400 },
    description: 'Logo image for company page',
  },
  title: {
    min: { width: 4200, height: 700 },
    recommended: { width: 4200, height: 700 },
    description: 'Title image (Titelbild) for company page',
  },
  'culture-main': {
    min: { width: 1128, height: 376 },
    recommended: { width: 1128, height: 376 },
    description: 'Company culture main image',
  },
  'culture-module': {
    min: { width: 502, height: 282 },
    recommended: { width: 502, height: 282 },
    description: 'Company culture custom module image',
  },
  photo: {
    min: { width: 264, height: 176 },
    recommended: { width: 900, height: 600 },
    description: 'Company photo',
  },
  post: {
    min: { width: 200, height: 105 }, // Minimum width, aspect ratio 1.91:1
    recommended: { width: 1200, height: 627 },
    description: 'Custom post image (1.91:1 ratio)',
  },
};

// Brand colors from colors.json
const BRAND_COLORS = {
  aqua: '#00FFDC',
  navy: '#1E2A45',
  fuchsia: '#FF008F',
};

/**
 * Load brand colors from colors.json
 * @returns {Object} Brand colors object
 */
function loadBrandColors() {
  try {
    const colorsPath = join(projectRoot, 'assets', 'colors', 'colors.json');
    const colorsData = JSON.parse(readFileSync(colorsPath, 'utf-8'));
    return {
      aqua: colorsData.selection.aqua.hex,
      navy: colorsData.selection.navy.hex,
      fuchsia: colorsData.selection.fuchsia.hex,
    };
  } catch (err) {
    warn(`Could not load colors.json, using defaults: ${err.message}`);
    return BRAND_COLORS;
  }
}

/**
 * Parse hex color to RGB
 * @param {string} hex - Hex color string (e.g., "#00FFDC")
 * @returns {Object} RGB object with r, g, b values
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert SVG to PNG buffer
 * @param {string} svgPath - Path to SVG file
 * @param {number} width - Target width in pixels
 * @param {number} height - Target height in pixels
 * @returns {Promise<Buffer>} PNG buffer
 */
async function svgToPng(svgPath, width, height) {
  try {
    const svgBuffer = readFileSync(svgPath);
    const pngBuffer = await sharp(svgBuffer)
      .resize(width, height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    return pngBuffer;
  } catch (err) {
    throw new Error(`SVG to PNG conversion failed: ${err.message}`);
  }
}

/**
 * Create SVG text overlay
 * @param {string} text - Text to display
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {Object} options - Text options
 * @returns {string} SVG string
 */
function createTextOverlay(text, width, height, options = {}) {
  const {
    fontSize = Math.floor(height * 0.1),
    x = width / 2,
    y = height / 2,
    fill = '#FFFFFF',
    fontFamily = 'Hanken Grotesk, sans-serif',
    fontWeight = '700',
    textAnchor = 'middle',
    alignmentBaseline = 'middle',
  } = options;

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="${x}"
        y="${y}"
        font-family="${fontFamily}"
        font-size="${fontSize}"
        font-weight="${fontWeight}"
        fill="${fill}"
        text-anchor="${textAnchor}"
        dominant-baseline="${alignmentBaseline}"
      >${text}</text>
    </svg>
  `;
}

/**
 * Generate LinkedIn image
 * @param {string} type - Image type (logo, title, culture-main, culture-module, photo, post)
 * @param {Object} options - Generation options
 * @returns {Promise<void>}
 */
async function generateLinkedInImage(type, options) {
  const {
    color = 'navy',
    logoPath = null,
    text = null,
    outputPath,
    format = null,
    useRecommended = true,
  } = options;

  try {
    // Validate type
    if (!LINKEDIN_SPECS[type]) {
      throw new Error(`Invalid type: ${type}. Must be one of: ${Object.keys(LINKEDIN_SPECS).join(', ')}`);
    }

    const spec = LINKEDIN_SPECS[type];
    const dimensions = useRecommended ? spec.recommended : spec.min;
    const width = dimensions.width;
    const height = dimensions.height;

    // Validate color
    const colors = loadBrandColors();
    const colorHex = colors[color.toLowerCase()];
    if (!colorHex) {
      throw new Error(`Invalid color: ${color}. Must be one of: aqua, navy, fuchsia`);
    }

    // Determine output format
    let outputFormat = format;
    if (!outputFormat) {
      // Default: JPEG for large images, PNG for logos
      outputFormat = type === 'logo' ? 'png' : 'jpeg';
    }

    // Ensure output directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    info(`Generating ${type} image: ${width}x${height}px with ${color} background...`);

    // Create background
    const rgb = hexToRgb(colorHex);
    if (!rgb) {
      throw new Error(`Invalid color hex: ${colorHex}`);
    }

    const background = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: rgb.r, g: rgb.g, b: rgb.b, alpha: 1 },
      },
    });

    const compositeLayers = [];

    // Add logo if provided or use default
    if (logoPath || type === 'logo') {
      const logoToUse = logoPath || join(projectRoot, 'assets', 'logos', 'kieks.me-single-circle.svg');
      
      if (!existsSync(logoToUse)) {
        warn(`Logo not found: ${logoToUse}, skipping logo overlay`);
      } else {
        // Calculate logo size based on image type
        let logoSize;
        if (type === 'logo') {
          logoSize = Math.floor(Math.min(width, height) * 0.8); // 80% of image size
        } else if (type === 'title') {
          logoSize = Math.floor(height * 0.4); // 40% of height
        } else {
          logoSize = Math.floor(Math.min(width, height) * 0.3); // 30% of smaller dimension
        }

        const logoBuffer = await svgToPng(logoToUse, logoSize, logoSize);
        
        // Position logo
        let logoX, logoY;
        if (type === 'logo') {
          // Center logo
          logoX = Math.floor((width - logoSize) / 2);
          logoY = Math.floor((height - logoSize) / 2);
        } else if (type === 'title') {
          // Logo on left side, vertically centered
          logoX = Math.floor(width * 0.05);
          logoY = Math.floor((height - logoSize) / 2);
        } else {
          // Logo in top-left corner with padding
          logoX = Math.floor(width * 0.05);
          logoY = Math.floor(height * 0.05);
        }

        compositeLayers.push({
          input: logoBuffer,
          blend: 'over',
          left: logoX,
          top: logoY,
        });
      }
    }

    // Add text overlay if provided
    if (text) {
      // Calculate text position and size based on image type
      let textOptions = {};
      
      if (type === 'title') {
        // Text on right side of title image
        textOptions = {
          fontSize: Math.floor(height * 0.15),
          x: width * 0.6,
          y: height / 2,
          fill: '#FFFFFF',
        };
      } else if (type === 'post') {
        // Text centered in post image
        textOptions = {
          fontSize: Math.floor(height * 0.12),
          x: width / 2,
          y: height / 2,
          fill: '#FFFFFF',
        };
      } else {
        // Default: centered
        textOptions = {
          fontSize: Math.floor(Math.min(width, height) * 0.08),
          x: width / 2,
          y: height / 2,
          fill: '#FFFFFF',
        };
      }

      const textSvg = createTextOverlay(text, width, height, textOptions);
      const textBuffer = Buffer.from(textSvg);
      
      compositeLayers.push({
        input: textBuffer,
        blend: 'over',
        left: 0,
        top: 0,
      });
    }

    // Composite all layers
    let image = background;
    if (compositeLayers.length > 0) {
      image = image.composite(compositeLayers);
    }

    // Apply format-specific processing
    let outputBuffer;
    if (outputFormat === 'jpeg') {
      outputBuffer = await image
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
    } else {
      outputBuffer = await image
        .png({ compressionLevel: 9 })
        .toBuffer();
    }

    // Check file size (max 3MB)
    const fileSizeMB = outputBuffer.length / (1024 * 1024);
    if (fileSizeMB > 3) {
      warn(`File size is ${fileSizeMB.toFixed(2)}MB, exceeding LinkedIn's 3MB limit. Compressing...`);
      
      // Re-compress with lower quality
      if (outputFormat === 'jpeg') {
        outputBuffer = await background
          .composite(compositeLayers)
          .jpeg({ quality: 75, mozjpeg: true })
          .toBuffer();
      } else {
        outputBuffer = await background
          .composite(compositeLayers)
          .png({ compressionLevel: 9, effort: 10 })
          .toBuffer();
      }
      
      const newFileSizeMB = outputBuffer.length / (1024 * 1024);
      if (newFileSizeMB > 3) {
        warn(`File size after compression: ${newFileSizeMB.toFixed(2)}MB. Still exceeds limit.`);
      }
    }

    // Write output file
    writeFileSync(outputPath, outputBuffer);

    const finalSizeMB = outputBuffer.length / (1024 * 1024);
    success(`LinkedIn image generated successfully: ${outputPath}`);
    info(`Size: ${width}x${height}px`);
    info(`Format: ${outputFormat.toUpperCase()}`);
    info(`File size: ${finalSizeMB.toFixed(2)}MB`);
    info(`Color: ${color} (${colorHex})`);
    if (text) {
      info(`Text: ${text}`);
    }
  } catch (err) {
    error(`Failed to generate LinkedIn image: ${err.message}`);
    throw err;
  }
}

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    type: null,
    color: null,
    logo: null,
    text: null,
    output: null,
    format: null,
    recommended: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--type' && i + 1 < args.length) {
      parsed.type = args[++i];
    } else if (arg === '--color' && i + 1 < args.length) {
      parsed.color = args[++i].toLowerCase();
    } else if (arg === '--logo' && i + 1 < args.length) {
      parsed.logo = args[++i];
    } else if (arg === '--text' && i + 1 < args.length) {
      parsed.text = args[++i];
    } else if (arg === '--output' && i + 1 < args.length) {
      parsed.output = args[++i];
    } else if (arg === '--format' && i + 1 < args.length) {
      parsed.format = args[++i].toLowerCase();
    } else if (arg === '--min') {
      parsed.recommended = false;
    } else if (arg === '--help' || arg === '-h') {
      return { help: true };
    }
  }

  return parsed;
}

/**
 * Prompt user for image type
 * @returns {Promise<string>} Image type
 */
async function promptImageType() {
  const { type } = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'Welchen LinkedIn-Bildtyp möchten Sie generieren?',
      choices: Object.entries(LINKEDIN_SPECS).map(([key, spec]) => ({
        name: `${key} - ${spec.description} (${spec.recommended.width}x${spec.recommended.height}px)`,
        value: key,
      })),
    },
  ]);
  return type;
}

/**
 * Prompt user for brand color
 * @returns {Promise<string>} Brand color name
 */
async function promptBrandColor() {
  const colors = loadBrandColors();
  const { color } = await inquirer.prompt([
    {
      type: 'list',
      name: 'color',
      message: 'Welche Firmenfarbe soll als Hintergrund verwendet werden?',
      choices: [
        {
          name: `Aqua (#${colors.aqua.replace('#', '')})`,
          value: 'aqua',
        },
        {
          name: `Navy (#${colors.navy.replace('#', '')})`,
          value: 'navy',
        },
        {
          name: `Fuchsia (#${colors.fuchsia.replace('#', '')})`,
          value: 'fuchsia',
        },
      ],
    },
  ]);
  return color;
}

/**
 * Prompt user for logo path
 * @returns {Promise<string|null>} Logo path or null
 */
async function promptLogoPath() {
  const { useLogo } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useLogo',
      message: 'Möchten Sie ein Logo hinzufügen?',
      default: true,
    },
  ]);

  if (!useLogo) {
    return null;
  }

  const { logoPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'logoPath',
      message: 'Pfad zum Logo (leer für Standard-Logo):',
      default: '',
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return true; // Empty is OK, will use default
        }
        const path = resolve(input.trim());
        if (!existsSync(path)) {
          return `Datei nicht gefunden: ${path}`;
        }
        return true;
      },
    },
  ]);

  return logoPath.trim() || null;
}

/**
 * Prompt user for text
 * @returns {Promise<string|null>} Text or null
 */
async function promptText() {
  const { useText } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useText',
      message: 'Möchten Sie Text hinzufügen?',
      default: false,
    },
  ]);

  if (!useText) {
    return null;
  }

  const { text } = await inquirer.prompt([
    {
      type: 'input',
      name: 'text',
      message: 'Text zum Anzeigen:',
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Text ist erforderlich';
        }
        return true;
      },
    },
  ]);

  return text.trim();
}

/**
 * Prompt user for output path
 * @param {string} type - Image type
 * @param {string} color - Brand color
 * @returns {Promise<string>} Output file path
 */
async function promptOutputPath(type, color) {
  const spec = LINKEDIN_SPECS[type];
  const dimensions = spec.recommended;
  const defaultOutputDir = join(projectRoot, 'output', 'linkedin');
  const ext = type === 'logo' ? 'png' : 'jpg';
  const defaultOutput = join(
    defaultOutputDir,
    `linkedin-${type}-${color}-${dimensions.width}x${dimensions.height}.${ext}`
  );

  const { outputPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'outputPath',
      message: 'Ausgabedatei-Pfad:',
      default: defaultOutput,
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Ausgabepfad ist erforderlich';
        }
        const path = resolve(input.trim());
        const dir = dirname(path);
        if (!existsSync(dir)) {
          try {
            mkdirSync(dir, { recursive: true });
          } catch (err) {
            return `Verzeichnis kann nicht erstellt werden: ${dir}`;
          }
        }
        return true;
      },
    },
  ]);
  return resolve(outputPath.trim());
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
${header('LinkedIn Image Generator', 'Generate LinkedIn-compliant images')}

Usage:
  node scripts/linkedin-image-generator.mjs [options]

Options:
  --type <type>      Image type: logo, title, culture-main, culture-module, photo, post
  --color <color>    Brand color: aqua, navy, or fuchsia
  --logo <path>      Logo file path (optional, defaults to kieks.me logo)
  --text <text>      Text to display (optional)
  --output <path>    Output file path
  --format <format>  Output format: jpeg or png (default: jpeg for large images, png for logos)
  --min              Use minimum dimensions instead of recommended
  --help, -h         Show this help message

Image Types:
  logo              Logo image: 400x400px (recommended) / 268x268px (min)
  title             Title image: 4200x700px
  culture-main      Company culture main: 1128x376px
  culture-module    Company culture module: 502x282px
  photo             Company photo: 900x600px (recommended) / 264x176px (min)
  post              Post image: 1200x627px (1.91:1 ratio)

If no arguments are provided, an interactive prompt will guide you through the process.

Examples:
  # Interactive mode (recommended)
  node scripts/linkedin-image-generator.mjs

  # Generate title image with aqua background
  node scripts/linkedin-image-generator.mjs \\
    --type title \\
    --color aqua \\
    --text "kieks.me GbR" \\
    --output output/linkedin-title-aqua.jpg

  # Generate logo image
  node scripts/linkedin-image-generator.mjs \\
    --type logo \\
    --color navy \\
    --output output/linkedin-logo-navy.png

Brand Colors:
  - aqua:    #00FFDC
  - navy:    #1E2A45
  - fuchsia: #FF008F
`);
}

/**
 * Main function
 */
async function main() {
  try {
    console.log(header('LinkedIn Image Generator', 'Generate LinkedIn-compliant images'));
    
    const args = parseArgs();

    if (args.help) {
      showHelp();
      process.exit(0);
    }

    // If all required arguments are provided, use CLI mode
    if (args.type && args.color && args.output) {
      // Validate type
      if (!LINKEDIN_SPECS[args.type]) {
        error(`Invalid type: ${args.type}. Must be one of: ${Object.keys(LINKEDIN_SPECS).join(', ')}`);
        process.exit(1);
      }

      // Validate color
      const validColors = ['aqua', 'navy', 'fuchsia'];
      if (!validColors.includes(args.color)) {
        error(`Invalid color: ${args.color}. Must be one of: ${validColors.join(', ')}`);
        process.exit(1);
      }

      // Generate image
      await generateLinkedInImage(args.type, {
        color: args.color,
        logoPath: args.logo,
        text: args.text,
        outputPath: args.output,
        format: args.format,
        useRecommended: args.recommended,
      });
      success('LinkedIn image generation completed!');
      return;
    }

    // Interactive mode
    info('Interactive mode - Please answer the following questions:\n');

    const type = await promptImageType();
    const color = await promptBrandColor();
    const logoPath = await promptLogoPath();
    const text = await promptText();
    const outputPath = await promptOutputPath(type, color);

    info('\nGenerating LinkedIn image...\n');
    await generateLinkedInImage(type, {
      color,
      logoPath,
      text,
      outputPath,
      useRecommended: true,
    });
    success('\nLinkedIn image generation completed!');
  } catch (err) {
    if (err.isTtyError) {
      error('Prompt could not be executed in the current environment.');
      error('Please use CLI arguments: --type, --color, --output');
    } else {
      error(`Error: ${err.message}`);
    }
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateLinkedInImage, loadBrandColors, hexToRgb, LINKEDIN_SPECS };
