#!/usr/bin/env node
/**
 * Configuration Loader
 * Centralized configuration loader for all scripts
 */

import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { warn } from './misc-cli-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

let cachedConfig = null;

/**
 * Load configuration from config.json
 * @returns {Object} Configuration object
 */
export function loadConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const configPath = join(__dirname, 'config.json');
    if (!existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }
    const configData = JSON.parse(readFileSync(configPath, 'utf-8'));
    cachedConfig = configData;
    return configData;
  } catch (err) {
    throw new Error(`Failed to load config file: ${err.message}`);
  }
}

/**
 * Load brand colors from colors.json with fallback to config
 * @returns {Object} Brand colors object with hex values
 */
export function loadBrandColors() {
  try {
    const colorsPath = join(projectRoot, 'assets', 'colors', 'colors.json');
    if (existsSync(colorsPath)) {
      const colorsData = JSON.parse(readFileSync(colorsPath, 'utf-8'));
      return {
        aqua: colorsData.selection.aqua.hex,
        navy: colorsData.selection.navy.hex,
        fuchsia: colorsData.selection.fuchsia.hex,
      };
    }
  } catch (err) {
    warn(`Could not load colors.json, using defaults from config: ${err.message}`);
  }

  // Fallback to config
  const config = loadConfig();
  return {
    aqua: config.brand.colors.aqua,
    navy: config.brand.colors.navy,
    fuchsia: config.brand.colors.fuchsia,
  };
}

/**
 * Parse hex color to RGB
 * @param {string} hex - Hex color string (e.g., "#00FFDC")
 * @returns {Object} RGB object with r, g, b values (0-255)
 */
export function hexToRgb(hex) {
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
 * Convert hex color to RGB values normalized to 0-1 range (for PDF)
 * @param {string} hex - Hex color string (e.g., "#00FFDC")
 * @returns {Object} RGB object with r, g, b values (0-1)
 */
export function hexToRgbNormalized(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return {
    r: rgb.r / 255,
    g: rgb.g / 255,
    b: rgb.b / 255,
  };
}

/**
 * Get project root directory
 * @returns {string} Project root path
 */
export function getProjectRoot() {
  return projectRoot;
}

/**
 * Get scripts directory
 * @returns {string} Scripts directory path
 */
export function getScriptsDir() {
  return __dirname;
}
