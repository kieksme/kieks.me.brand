#!/usr/bin/env node
/**
 * Generate sample avatars
 * Creates example avatars with different variants (colors, sizes, grayscale, shadow)
 */

import { join, resolve, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { generateAvatar } from './avatar-generator.mjs';
import { header, success, info, error, endGroup } from './misc-cli-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

/**
 * Generate all sample avatar variants
 */
async function generateSampleAvatars() {
  const sourceDir = join(projectRoot, 'source', 'avatars');
  const outputDir = join(projectRoot, 'examples', 'avatars');
  
  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  // Find all portrait images in source directory
  const { readdirSync } = await import('fs');
  const portraitFiles = readdirSync(sourceDir)
    .filter(file => {
      const ext = extname(file).toLowerCase();
      return ext === '.png' || ext === '.jpg' || ext === '.jpeg';
    })
    .map(file => join(sourceDir, file));
  
  if (portraitFiles.length === 0) {
    error('Keine Portrait-Dateien in source/avatars gefunden!');
    process.exit(1);
  }
  
  // Define variants to generate
  // Standard variants: all colors, standard sizes, with shadow (default)
  const colors = ['aqua', 'navy', 'fuchsia'];
  const sizes = [256, 512]; // Standard sizes for examples
  const variants = [
    { grayscale: false, withShadow: true, suffix: '', description: 'Standard' },
    { grayscale: true, withShadow: true, suffix: '-grayscale', description: 'Graustufen' },
  ];
  
  let totalAvatars = 0;
  const generatedAvatars = [];
  
  for (const portraitPath of portraitFiles) {
    const portraitName = basename(portraitPath, extname(portraitPath));
    info(`\nVerarbeite Portrait: ${portraitName}`);
    
    for (const color of colors) {
      for (const size of sizes) {
        for (const variant of variants) {
          const suffix = variant.suffix ? variant.suffix : '';
          const outputFileName = `avatar-${portraitName}-${color}-${size}${suffix}.png`;
          const outputPath = join(outputDir, outputFileName);
          
          try {
            const variantDesc = variant.description || (variant.grayscale ? 'Graustufen' : 'Standard');
            info(`  Generiere: ${outputFileName} (${variantDesc})`);
            await generateAvatar(
              portraitPath,
              color,
              size,
              outputPath,
              variant.grayscale,
              variant.withShadow
            );
            generatedAvatars.push(outputFileName);
            totalAvatars++;
          } catch (err) {
            error(`  Fehler bei ${outputFileName}: ${err.message}`);
          }
        }
      }
    }
  }
  
  return { totalAvatars, generatedAvatars, outputDir };
}

/**
 * Main function
 */
async function main() {
  try {
    header('Sample Avatars Generator', 'Generiere Beispiel-Avatare mit verschiedenen Varianten', 'bgCyan');
    
    info('Generiere Beispiel-Avatare mit verschiedenen Varianten:');
    info('  - Farben: Aqua, Navy, Fuchsia');
    info('  - Größen: 256px, 512px');
    info('  - Varianten: Standard (mit Schattenriss), Graustufen (mit Schattenriss)');
    info('');
    
    const result = await generateSampleAvatars();
    
    endGroup();
    success(`Alle ${result.totalAvatars} Beispiel-Avatare erfolgreich generiert!`);
    info(`Ausgabe-Verzeichnis: ${result.outputDir}`);
    info(`\nGenerierte Dateien:`);
    result.generatedAvatars.forEach(file => {
      info(`  - ${file}`);
    });
  } catch (err) {
    endGroup();
    error(`Fehler: ${err.message}`);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

main();
