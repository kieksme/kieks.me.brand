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
import { loadConfig, loadBrandColors, hexToRgb } from './config-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Load configuration once at module level
const CONFIG = loadConfig();
const AVATAR_CONFIG = CONFIG.avatarGenerator;

/**
 * Get shadow color (different from background color)
 * @param {string} backgroundColor - Background color name (aqua, navy, fuchsia)
 * @returns {string} Shadow color name
 */
function getShadowColor(backgroundColor) {
  const colorMap = AVATAR_CONFIG.shadowColorMap;
  const colorKey = backgroundColor.toLowerCase();
  
  const options = colorMap[colorKey];
  if (!options || options.length === 0) {
    // Fallback: use navy if available
    return 'navy';
  }
  
  // Return first available different color
  return options[0];
}

/**
 * Calculate shadow offset based on avatar size
 * @param {number} size - Avatar size in pixels
 * @returns {Object} Offset object with x and y (negative for top-left)
 */
function calculateShadowOffset(size) {
  const shadowConfig = AVATAR_CONFIG.shadowOffset;
  let offset;
  
  if (size <= shadowConfig.small.maxSize) {
    // Small avatars
    offset = Math.max(
      shadowConfig.small.minOffset,
      Math.floor(size * shadowConfig.small.offsetMultiplier)
    );
  } else if (size <= shadowConfig.medium.maxSize) {
    // Medium avatars
    offset = Math.max(
      shadowConfig.medium.minOffset,
      Math.floor(size * shadowConfig.medium.offsetMultiplier)
    );
  } else {
    // Large avatars
    offset = Math.max(
      shadowConfig.large.minOffset,
      Math.floor(size * shadowConfig.large.offsetMultiplier)
    );
  }
  
  // Top-left offset (negative values)
  return {
    x: -offset,
    y: -offset,
  };
}

/**
 * Generate square avatar with brand color background
 * @param {string} portraitPath - Path to cut-out portrait image (PNG with transparency)
 * @param {string} colorName - Brand color name (aqua, navy, fuchsia)
 * @param {number} size - Output size in pixels (square)
 * @param {string} outputPath - Output file path
 * @param {boolean} grayscale - Whether to convert portrait to grayscale (default: false)
 * @param {boolean} withShadow - Whether to add shadow silhouette (default: true)
 * @returns {Promise<void>}
 */
async function generateAvatar(portraitPath, colorName, size, outputPath, grayscale = false, withShadow = true) {
  try {
    // Validate inputs
    if (!existsSync(portraitPath)) {
      throw new Error(`Portrait image not found: ${portraitPath}`);
    }

    const colors = loadBrandColors();
    const colorHex = colors[colorName.toLowerCase()];
    if (!colorHex) {
      const validColors = Object.keys(CONFIG.brand.colors).filter(c => ['aqua', 'navy', 'fuchsia'].includes(c)).join(', ');
      throw new Error(
        `Invalid color: ${colorName}. Must be one of: ${validColors}`
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
      portraitPipeline = portraitPipeline
        .greyscale()
        .normalise() // Normalize brightness/contrast
        .linear(1.3, -38.4); // Increase contrast by 30% for better visibility (offset: -(128 * 0.3) = -38.4)
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

    // Prepare composite layers
    const compositeLayers = [];

    // Add shadow silhouette if enabled
    if (withShadow) {
      try {
        const shadowColorName = getShadowColor(colorName);
        const shadowColorHex = colors[shadowColorName];
        const shadowRgb = hexToRgb(shadowColorHex);
        
        if (!shadowRgb) {
          throw new Error(`Failed to parse shadow color: ${shadowColorHex}`);
        }
        
        // Calculate offset first
        const offset = calculateShadowOffset(size);
        
        // Calculate shadow size (can overflow canvas)
        // Shadow can be larger than canvas and will be clipped if it overflows
        const desiredShadowSize = Math.floor(targetSize * AVATAR_CONFIG.shadowSize.multiplier);
        const shadowSize = Math.max(1, desiredShadowSize);
        
        // Validate shadow size (only check if it's positive, allow overflow)
        if (shadowSize <= 0) {
          throw new Error(`Invalid shadow size: ${shadowSize}`);
        }
        
        // Create shadow silhouette:
        // 1. Resize portrait to shadow size (120% of target, max canvas size)
        const portraitForShadow = await sharp(portraitPath)
          .resize(shadowSize, shadowSize, {
            fit: 'cover',
            position: 'center',
          })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        
        // 2. Create shadow by replacing RGB with shadow color, keeping alpha
        const { data: portraitData, info } = portraitForShadow;
        const shadowBuffer = Buffer.allocUnsafe(shadowSize * shadowSize * 4);
        
        for (let i = 0; i < shadowSize * shadowSize; i++) {
          const alpha = portraitData[i * 4 + 3];
          shadowBuffer[i * 4 + 0] = shadowRgb.r; // R
          shadowBuffer[i * 4 + 1] = shadowRgb.g; // G
          shadowBuffer[i * 4 + 2] = shadowRgb.b; // B
          shadowBuffer[i * 4 + 3] = alpha; // A (preserve transparency)
        }
        
        // 3. Create shadow silhouette image from buffer
        const shadowSilhouetteRaw = await sharp(shadowBuffer, {
          raw: {
            width: shadowSize,
            height: shadowSize,
            channels: 4,
          },
        })
          .png()
          .toBuffer();
        
        // 4. Calculate position for shadow (centered with offset)
        // Start from center, then apply offset (negative for top-left)
        const centerX = Math.floor((size - shadowSize) / 2);
        const centerY = Math.floor((size - shadowSize) / 2);
        const shadowX = centerX + offset.x;
        const shadowY = centerY + offset.y;
        
        // 5. Crop shadow to visible area within canvas bounds
        // Calculate which part of the shadow is visible
        const cropLeft = Math.max(0, -shadowX);
        const cropTop = Math.max(0, -shadowY);
        const cropRight = Math.min(shadowSize, size - shadowX);
        const cropBottom = Math.min(shadowSize, size - shadowY);
        const cropWidth = cropRight - cropLeft;
        const cropHeight = cropBottom - cropTop;
        
        // Extract visible portion of shadow
        let shadowToComposite = shadowSilhouetteRaw;
        if (cropLeft > 0 || cropTop > 0 || cropWidth < shadowSize || cropHeight < shadowSize) {
          // Crop shadow to visible area
          shadowToComposite = await sharp(shadowSilhouetteRaw)
            .extract({
              left: cropLeft,
              top: cropTop,
              width: cropWidth,
              height: cropHeight,
            })
            .toBuffer();
        }
        
        // 6. Embed cropped shadow in canvas-sized image
        const finalShadowX = Math.max(0, shadowX);
        const finalShadowY = Math.max(0, shadowY);
        
        const shadowCanvas = sharp({
          create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
          },
        });
        
        // Composite cropped shadow onto canvas
        const shadowSilhouette = await shadowCanvas
          .composite([
            {
              input: shadowToComposite,
              blend: 'over',
              left: finalShadowX,
              top: finalShadowY,
            },
          ])
          .png()
          .toBuffer();
        
        compositeLayers.push({
          input: shadowSilhouette,
          blend: 'over',
          left: 0,
          top: 0,
        });
      } catch (err) {
        error(`Failed to create shadow silhouette: ${err.message}`);
        throw err;
      }
    }

    // Add main portrait (centered)
    const portraitX = Math.floor((size - targetSize) / 2);
    const portraitY = Math.floor((size - targetSize) / 2);
    
    compositeLayers.push({
      input: resizedPortrait,
      blend: 'over',
      left: portraitX,
      top: portraitY,
    });

    // Composite all layers
    const avatar = await background
      .composite(compositeLayers)
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
    if (withShadow) {
      const shadowColorName = getShadowColor(colorName);
      const shadowColorHex = colors[shadowColorName];
      info(`Schattenriss: ${shadowColorName} (${shadowColorHex})`);
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
    size: AVATAR_CONFIG.defaults.size,
    output: null,
    grayscale: AVATAR_CONFIG.defaults.grayscale,
    withShadow: AVATAR_CONFIG.defaults.withShadow,
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
    } else if (arg === '--no-shadow') {
      parsed.withShadow = false;
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
  const sizeChoices = [...AVATAR_CONFIG.sizeOptions, { name: 'Benutzerdefiniert', value: 'custom' }];
  const { size } = await inquirer.prompt([
    {
      type: 'list',
      name: 'size',
      message: 'Welche Größe soll der Avatar haben?',
      choices: sizeChoices,
      default: AVATAR_CONFIG.defaults.size,
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
          if (num < AVATAR_CONFIG.sizeLimits.min || num > AVATAR_CONFIG.sizeLimits.max) {
            return `Größe muss zwischen ${AVATAR_CONFIG.sizeLimits.min} und ${AVATAR_CONFIG.sizeLimits.max} Pixeln liegen`;
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
      default: AVATAR_CONFIG.defaults.grayscale,
    },
  ]);
  return grayscale;
}

/**
 * Prompt user if shadow silhouette should be added
 * @returns {Promise<boolean>} True if shadow should be added
 */
async function promptShadow() {
  const { withShadow } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'withShadow',
      message: 'Soll ein Schattenriss hinzugefügt werden? (farbiger Schatten hinter dem Portrait)',
      default: AVATAR_CONFIG.defaults.withShadow,
    },
  ]);
  return withShadow;
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
  const defaultOutputDir = join(projectRoot, AVATAR_CONFIG.defaults.outputDir);
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
      default: AVATAR_CONFIG.defaults.grayscale,
    },
  ]);
  
  const { withShadow } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'withShadow',
      message: 'Soll ein Schattenriss hinzugefügt werden? (farbiger Schatten hinter dem Portrait)',
      default: AVATAR_CONFIG.defaults.withShadow,
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

  const sizeChoices = AVATAR_CONFIG.sizeOptions.map((option, index) => ({
    name: option.name.replace(' (Klein)', '').replace(' (Standard)', '').replace(' (Groß)', ''),
    value: option.value,
    checked: index < 2, // First two sizes checked by default
  }));
  
  const { selectedSizes } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedSizes',
      message: 'Welche Größen sollen generiert werden?',
      choices: sizeChoices,
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
      default: join(projectRoot, AVATAR_CONFIG.defaults.outputDir),
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
        withShadow,
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
${header('Avatar Generator', 'Einfach besser aussehen')}

Usage:
  node scripts/avatar-generator.mjs [--portrait <path>] [--color <color>] [--size <pixels>] [--output <path>]

Options:
  --portrait <path>    Path to cut-out portrait image (PNG with transparency)
  --color <color>      Brand color: aqua, navy, or fuchsia
  --size <pixels>      Output size in pixels (square, default: 512)
  --output <path>      Output file path
  --grayscale          Convert portrait to grayscale (background stays colored)
  --no-shadow          Disable shadow silhouette (default: enabled)
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
  - aqua:    ${CONFIG.brand.colors.aqua}
  - navy:    ${CONFIG.brand.colors.navy}
  - fuchsia: ${CONFIG.brand.colors.fuchsia}
`);
}

/**
 * Main function
 */
async function main() {
  try {
    console.log(header('Avatar Generator', 'Einfach besser aussehen'));
    
    const args = parseArgs();

    if (args.help) {
      showHelp();
      process.exit(0);
    }

    // If all required arguments are provided, use CLI mode
    if (args.portrait && args.color && args.output) {
      // Validate color
      const validColors = Object.keys(CONFIG.brand.colors).filter(c => ['aqua', 'navy', 'fuchsia'].includes(c));
      if (!validColors.includes(args.color)) {
        error(`Invalid color: ${args.color}. Must be one of: ${validColors.join(', ')}`);
        process.exit(1);
      }

      // Generate avatar
      await generateAvatar(args.portrait, args.color, args.size, args.output, args.grayscale, args.withShadow);
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
        await generateAvatar(config.portraitPath, config.color, config.size, config.outputPath, config.grayscale, config.withShadow);
      }

      success(`\nAlle ${configs.length} Avatar(s) erfolgreich generiert!`);
    } else {
      // Single avatar mode
      const portraitPath = await promptPortraitPath();
      const color = await promptBrandColor();
      const size = await promptAvatarSize();
      const grayscale = await promptGrayscale();
      const withShadow = await promptShadow();
      const outputPath = await promptOutputPath(portraitPath, color, size, grayscale);

      info('\nGeneriere Avatar...\n');
      await generateAvatar(portraitPath, color, size, outputPath, grayscale, withShadow);
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

export { generateAvatar, loadBrandColors, hexToRgb, loadConfig };
