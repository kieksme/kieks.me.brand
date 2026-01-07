#!/usr/bin/env node
/**
 * README Header Sample Banner Generator
 * Generates sample README header banners for different repository types
 */

import { fileURLToPath } from 'url';
import { dirname, join, resolve, existsSync } from 'path';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import sharp from 'sharp';
import {
  header,
  success,
  error,
  info,
} from './misc-cli-utils.mjs';
import { getProjectRoot } from './config-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = getProjectRoot();

// README header specifications
const README_HEADER_SPECS = {
  width: 1200,
  height: 200,
};

// Example repository types and their titles
const EXAMPLE_REPOSITORIES = [
  {
    id: 'web-app',
    title: 'Web Application',
    description: 'Modern web application with React and TypeScript',
  },
  {
    id: 'api-service',
    title: 'API Service',
    description: 'RESTful API service built with Node.js',
  },
  {
    id: 'mobile-app',
    title: 'Mobile App',
    description: 'Cross-platform mobile application',
  },
  {
    id: 'cli-tool',
    title: 'CLI Tool',
    description: 'Command-line interface tool for developers',
  },
  {
    id: 'library',
    title: 'JavaScript Library',
    description: 'Reusable JavaScript library for modern web development',
  },
  {
    id: 'documentation',
    title: 'Documentation',
    description: 'Comprehensive documentation and guides',
  },
];

/**
 * Generate SVG with custom title
 * @param {string} templatePath - Path to SVG template
 * @param {string} title - Title text to replace
 * @returns {string} Modified SVG content
 */
function generateCustomSVG(templatePath, title) {
  try {
    const svgContent = readFileSync(templatePath, 'utf-8');
    
    // Replace the title text in the SVG
    // The title is in a <text> element at y="150"
    // Escape HTML entities in title
    const escapedTitle = title
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    const titleRegex = /<text[^>]*y="150"[^>]*>.*?<\/text>/s;
    const newTitle = `<text x="60" y="150" font-family="'Hanken Grotesk', sans-serif" font-size="36" font-weight="700" fill="#FFFFFF">${escapedTitle}</text>`;
    
    const modifiedSVG = svgContent.replace(titleRegex, newTitle);
    return modifiedSVG;
  } catch (err) {
    throw new Error(`Failed to generate custom SVG: ${err.message}`);
  }
}

/**
 * Generate sample banners for all repository types
 * @returns {Promise<void>}
 */
async function generateSampleBanners() {
  const templatePath = join(projectRoot, 'assets', 'readme-header.svg');
  const outputDir = join(projectRoot, 'examples', 'github');
  
  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  info(`Generating sample README header banners...`);
  info(`Template: ${templatePath}`);
  info(`Output directory: ${outputDir}`);

  for (const repo of EXAMPLE_REPOSITORIES) {
    try {
      // Generate custom SVG
      const customSVG = generateCustomSVG(templatePath, repo.title);
      const svgPath = join(outputDir, `sample-readme-header-${repo.id}.svg`);
      writeFileSync(svgPath, customSVG);
      success(`Generated SVG: ${svgPath}`);

      // Generate PNG from SVG
      const pngPath = join(outputDir, `sample-readme-header-${repo.id}.png`);
      const pngBuffer = await sharp(Buffer.from(customSVG))
        .resize(README_HEADER_SPECS.width, README_HEADER_SPECS.height, {
          fit: 'contain',
          background: { r: 30, g: 42, b: 69 }, // Navy background
        })
        .png()
        .toBuffer();
      
      writeFileSync(pngPath, pngBuffer);
      const fileSizeMB = pngBuffer.length / (1024 * 1024);
      success(`Generated PNG: ${pngPath} (${fileSizeMB.toFixed(2)}MB)`);
    } catch (err) {
      error(`Failed to generate banner for ${repo.id}: ${err.message}`);
    }
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log(header('README Header Sample Banner Generator', 'Generate sample banners for different repository types'));
    
    await generateSampleBanners();
    success('Sample banner generation completed!');
    info(`Generated ${EXAMPLE_REPOSITORIES.length} sample banners in examples/github/`);
  } catch (err) {
    error(`Error: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run if called directly
const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile || process.argv[1].endsWith('generate-readme-header-samples.mjs')) {
  main().catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
}

export { generateSampleBanners, EXAMPLE_REPOSITORIES };
