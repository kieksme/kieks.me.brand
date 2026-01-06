#!/usr/bin/env node
/**
 * Avatar Generator
 * Generates square avatar images from cut-out portraits with brand color backgrounds
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
 * Generate square avatar with brand color background
 * @param {string} portraitPath - Path to cut-out portrait image (PNG with transparency)
 * @param {string} colorName - Brand color name (aqua, navy, fuchsia)
 * @param {number} size - Output size in pixels (square)
 * @param {string} outputPath - Output file path
 * @param {boolean} grayscale - Whether to convert portrait to grayscale (default: false)
 * @returns {Promise<void>}
 */
async function generateAvatar(portraitPath, colorName, size, outputPath, grayscale = false) {
  try {
    // Validate inputs
    if (!existsSync(portraitPath)) {
      throw new Error(`Portrait image not found: ${portraitPath}`);
    }

    const colors = loadBrandColors();
    const colorHex = colors[colorName.toLowerCase()];
    if (!colorHex) {
      throw new Error(
        `Invalid color: ${colorName}. Must be one of: aqua, navy, fuchsia`
      );
    }

    if (size <= 0 || !Number.isInteger(size)) {
      throw new Error(`Invalid size: ${size}. Must be a positive integer`);
    }

    // Ensure output directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    info(`Generating ${size}x${size}px avatar with ${colorName} background...`);

    // Get portrait image metadata
    const portraitMetadata = await sharp(portraitPath).metadata();
    const portraitWidth = portraitMetadata.width;
    const portraitHeight = portraitMetadata.height;

    // Calculate portrait size to fill the square (with some padding if needed)
    // Portrait will fill the square, centered, with cropping if needed
    const targetSize = size;
    
    // Start with portrait processing pipeline
    let portraitPipeline = sharp(portraitPath);
    
    // Convert to grayscale if requested (only the portrait, not the background)
    if (grayscale) {
      portraitPipeline = portraitPipeline.greyscale();
    }
    
    // Resize portrait to fill the square (cover strategy)
    // This will maintain aspect ratio and crop if needed
    const resizedPortrait = await portraitPipeline
      .resize(targetSize, targetSize, {
        fit: 'cover', // Fill the square, cropping if needed
        position: 'center', // Center the crop
      })
      .toBuffer();

    // Create colored background
    const rgb = hexToRgb(colorHex);
    if (!rgb) {
      throw new Error(`Invalid color hex: ${colorHex}`);
    }

    // Create square background with brand color
    const background = sharp({
      create: {
        width: size,
        height: size,
        channels: 4, // RGBA
        background: { r: rgb.r, g: rgb.g, b: rgb.b, alpha: 1 },
      },
    });

    // Composite portrait on top of background
    const avatar = await background
      .composite([
        {
          input: resizedPortrait,
          blend: 'over', // Standard alpha blending
        },
      ])
      .png()
      .toBuffer();

    // Write output file
    writeFileSync(outputPath, avatar);

    success(`Avatar generated successfully: ${outputPath}`);
    info(`Size: ${size}x${size}px`);
    info(`Color: ${colorName} (${colorHex})`);
    if (grayscale) {
      info(`Portrait: Graustufen`);
    }
  } catch (err) {
    error(`Failed to generate avatar: ${err.message}`);
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
    portrait: null,
    color: null,
    size: 512,
    output: null,
    grayscale: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--portrait' && i + 1 < args.length) {
      parsed.portrait = args[++i];
    } else if (arg === '--color' && i + 1 < args.length) {
      parsed.color = args[++i].toLowerCase();
    } else if (arg === '--size' && i + 1 < args.length) {
      parsed.size = parseInt(args[++i], 10);
    } else if (arg === '--output' && i + 1 < args.length) {
      parsed.output = args[++i];
    } else if (arg === '--grayscale' || arg === '--grey' || arg === '--gray') {
      parsed.grayscale = true;
    } else if (arg === '--help' || arg === '-h') {
      return { help: true };
    }
  }

  return parsed;
}

/**
 * Prompt user for portrait image path
 * @returns {Promise<string>} Portrait image path
 */
async function promptPortraitPath() {
  const { portraitPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'portraitPath',
      message: 'Pfad zum freigestellten Portrait (PNG mit Transparenz):',
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Portrait-Pfad ist erforderlich';
        }
        const path = resolve(input.trim());
        if (!existsSync(path)) {
          return `Datei nicht gefunden: ${path}`;
        }
        const ext = extname(path).toLowerCase();
        if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
          return 'Bitte eine PNG- oder JPEG-Datei angeben';
        }
        return true;
      },
    },
  ]);
  return resolve(portraitPath.trim());
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
 * Prompt user for avatar size
 * @returns {Promise<number>} Avatar size in pixels
 */
async function promptAvatarSize() {
  const { size } = await inquirer.prompt([
    {
      type: 'list',
      name: 'size',
      message: 'Welche Größe soll der Avatar haben?',
      choices: [
        { name: '256x256px (Klein)', value: 256 },
        { name: '512x512px (Standard)', value: 512 },
        { name: '1024x1024px (Groß)', value: 1024 },
        { name: 'Benutzerdefiniert', value: 'custom' },
      ],
      default: 512,
    },
  ]);

  if (size === 'custom') {
    const { customSize } = await inquirer.prompt([
      {
        type: 'input',
        name: 'customSize',
        message: 'Größe in Pixeln (quadratisch):',
        validate: (input) => {
          const num = parseInt(input, 10);
          if (isNaN(num) || num <= 0) {
            return 'Bitte eine positive Zahl eingeben';
          }
          if (num < 64 || num > 4096) {
            return 'Größe muss zwischen 64 und 4096 Pixeln liegen';
          }
          return true;
        },
      },
    ]);
    return parseInt(customSize, 10);
  }

  return size;
}

/**
 * Prompt user if portrait should be converted to grayscale
 * @returns {Promise<boolean>} True if portrait should be grayscale
 */
async function promptGrayscale() {
  const { grayscale } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'grayscale',
      message: 'Soll das Portrait in Graustufen umgewandelt werden? (Hintergrund bleibt farbig)',
      default: false,
    },
  ]);
  return grayscale;
}

/**
 * Prompt user for output path
 * @param {string} portraitPath - Portrait image path (for default output name)
 * @param {string} color - Brand color name
 * @param {number} size - Avatar size
 * @param {boolean} grayscale - Whether portrait is grayscale
 * @returns {Promise<string>} Output file path
 */
async function promptOutputPath(portraitPath, color, size, grayscale = false) {
  const portraitName = basename(portraitPath, extname(portraitPath));
  const grayscaleSuffix = grayscale ? '-grayscale' : '';
  const defaultOutputDir = join(projectRoot, 'output', 'avatars');
  const defaultOutput = join(
    defaultOutputDir,
    `avatar-${portraitName}-${color}-${size}${grayscaleSuffix}.png`
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
          // Check if we can create the directory
          try {
            mkdirSync(dir, { recursive: true });
          } catch (err) {
            return `Verzeichnis kann nicht erstellt werden: ${dir}`;
          }
        }
        const ext = extname(path).toLowerCase();
        if (ext !== '.png') {
          return 'Ausgabedatei muss eine PNG-Datei sein';
        }
        return true;
      },
    },
  ]);
  return resolve(outputPath.trim());
}

/**
 * Prompt user if they want to generate multiple avatars
 * @returns {Promise<boolean>} True if user wants to generate multiple avatars
 */
async function promptGenerateMultiple() {
  const { generateMultiple } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'generateMultiple',
      message: 'Möchten Sie mehrere Avatare generieren (verschiedene Farben/Größen)?',
      default: false,
    },
  ]);
  return generateMultiple;
}

/**
 * Prompt user for multiple avatar configurations
 * @param {string} portraitPath - Portrait image path
 * @returns {Promise<Array>} Array of avatar configurations
 */
async function promptMultipleAvatars(portraitPath) {
  const { grayscale } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'grayscale',
      message: 'Soll das Portrait in Graustufen umgewandelt werden? (Hintergrund bleibt farbig)',
      default: false,
    },
  ]);
  const colors = loadBrandColors();
  const { selectedColors } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedColors',
      message: 'Welche Farben sollen verwendet werden?',
      choices: [
        { name: `Aqua (#${colors.aqua.replace('#', '')})`, value: 'aqua', checked: true },
        { name: `Navy (#${colors.navy.replace('#', '')})`, value: 'navy' },
        { name: `Fuchsia (#${colors.fuchsia.replace('#', '')})`, value: 'fuchsia' },
      ],
      validate: (input) => {
        if (input.length === 0) {
          return 'Mindestens eine Farbe muss ausgewählt werden';
        }
        return true;
      },
    },
  ]);

  const { selectedSizes } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedSizes',
      message: 'Welche Größen sollen generiert werden?',
      choices: [
        { name: '256x256px', value: 256, checked: true },
        { name: '512x512px', value: 512, checked: true },
        { name: '1024x1024px', value: 1024 },
      ],
      validate: (input) => {
        if (input.length === 0) {
          return 'Mindestens eine Größe muss ausgewählt werden';
        }
        return true;
      },
    },
  ]);

  const { outputDir } = await inquirer.prompt([
    {
      type: 'input',
      name: 'outputDir',
      message: 'Ausgabeverzeichnis:',
      default: join(projectRoot, 'output', 'avatars'),
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Ausgabeverzeichnis ist erforderlich';
        }
        const dir = resolve(input.trim());
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

  const portraitName = basename(portraitPath, extname(portraitPath));
  const grayscaleSuffix = grayscale ? '-grayscale' : '';
  const configs = [];

  for (const color of selectedColors) {
    for (const size of selectedSizes) {
      configs.push({
        portraitPath,
        color,
        size,
        grayscale,
        outputPath: join(resolve(outputDir.trim()), `avatar-${portraitName}-${color}-${size}${grayscaleSuffix}.png`),
      });
    }
  }

  return configs;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
${header('Avatar Generator')}

Usage:
  node scripts/avatar-generator.mjs [--portrait <path>] [--color <color>] [--size <pixels>] [--output <path>]

Options:
  --portrait <path>    Path to cut-out portrait image (PNG with transparency)
  --color <color>      Brand color: aqua, navy, or fuchsia
  --size <pixels>      Output size in pixels (square, default: 512)
  --output <path>      Output file path
  --grayscale          Convert portrait to grayscale (background stays colored)
  --help, -h           Show this help message

If no arguments are provided, an interactive prompt will guide you through the process.

Examples:
  # Interactive mode (recommended)
  node scripts/avatar-generator.mjs

  # Generate 512x512px avatar with aqua background
  node scripts/avatar-generator.mjs \\
    --portrait path/to/portrait.png \\
    --color aqua \\
    --size 512 \\
    --output output/avatar-aqua-512.png

  # Generate 256x256px avatar with navy background
  node scripts/avatar-generator.mjs \\
    --portrait path/to/portrait.png \\
    --color navy \\
    --size 256 \\
    --output output/avatar-navy-256.png

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
    console.log(header('Avatar Generator'));
    
    const args = parseArgs();

    if (args.help) {
      showHelp();
      process.exit(0);
    }

    // If all required arguments are provided, use CLI mode
    if (args.portrait && args.color && args.output) {
      // Validate color
      const validColors = ['aqua', 'navy', 'fuchsia'];
      if (!validColors.includes(args.color)) {
        error(`Invalid color: ${args.color}. Must be one of: ${validColors.join(', ')}`);
        process.exit(1);
      }

      // Generate avatar
      await generateAvatar(args.portrait, args.color, args.size, args.output, args.grayscale);
      success('Avatar generation completed!');
      return;
    }

    // Interactive mode
    info('Interaktiver Modus - Bitte beantworten Sie die folgenden Fragen:\n');

    // Check if we should generate multiple avatars
    const generateMultiple = await promptGenerateMultiple();

    if (generateMultiple) {
      // Multiple avatars mode
      const portraitPath = await promptPortraitPath();
      const configs = await promptMultipleAvatars(portraitPath);

      info(`\nGeneriere ${configs.length} Avatar(s)...\n`);

      for (let i = 0; i < configs.length; i++) {
        const config = configs[i];
        info(`[${i + 1}/${configs.length}] Generiere Avatar: ${basename(config.outputPath)}`);
        await generateAvatar(config.portraitPath, config.color, config.size, config.outputPath, config.grayscale);
      }

      success(`\nAlle ${configs.length} Avatar(s) erfolgreich generiert!`);
    } else {
      // Single avatar mode
      const portraitPath = await promptPortraitPath();
      const color = await promptBrandColor();
      const size = await promptAvatarSize();
      const grayscale = await promptGrayscale();
      const outputPath = await promptOutputPath(portraitPath, color, size, grayscale);

      info('\nGeneriere Avatar...\n');
      await generateAvatar(portraitPath, color, size, outputPath, grayscale);
      success('\nAvatar generation completed!');
    }
  } catch (err) {
    if (err.isTtyError) {
      error('Prompt konnte nicht im aktuellen Umfeld ausgeführt werden.');
      error('Bitte verwenden Sie die CLI-Argumente: --portrait, --color, --size, --output');
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

export { generateAvatar, loadBrandColors, hexToRgb };
