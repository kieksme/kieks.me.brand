#!/usr/bin/env node
/**
 * Test script for pdf-lib business card generator
 */

import { generateBusinessCardWithPdfLib } from './generate-card.mjs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Test data
const testData = {
  name: 'Anna Schmidt',
  position: 'Lead Developer',
  email: 'anna@kieks.me',
  phone: '+49 123 456788',
  mobile: '+49 123 4567880',
  website: 'www.kieks.me',
  companyName: 'kieks.me GbR',
};

const outputDir = join(projectRoot, 'output');

console.log('Generating test business card with pdf-lib...');
console.log('Output directory:', outputDir);

try {
  const result = await generateBusinessCardWithPdfLib(testData, outputDir);
  console.log('\n✅ Success!');
  console.log('Front:', result.front);
  console.log('Back:', result.back);
  console.log('JSON:', result.json);
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error);
  process.exit(1);
}
