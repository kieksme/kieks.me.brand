#!/usr/bin/env node
/**
 * Run all tests
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testsDir = __dirname;

const testFiles = [
  'sample-data.test.mjs',
  'generate-card.test.mjs',
];

async function runTest(file) {
  return new Promise((resolve, reject) => {
    const testPath = join(testsDir, file);
    const proc = spawn('node', [testPath], {
      stdio: 'inherit',
      shell: false,
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Test ${file} failed with code ${code}`));
      }
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log('Running all tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testFile of testFiles) {
    try {
      console.log(`\nRunning ${testFile}...`);
      await runTest(testFile);
      passed++;
    } catch (error) {
      console.error(`\n✗ ${testFile} failed: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n\nTest Summary: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Error running tests:', error);
  process.exit(1);
});
