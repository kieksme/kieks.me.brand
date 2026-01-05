#!/usr/bin/env node
/**
 * Generate sample business cards
 * Creates example business cards for demonstration purposes
 */

import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generateBusinessCard } from './business-card-generator.mjs';
import { header, success, info, endGroup } from './misc-cli-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

/**
 * Sample contact data
 */
const sampleContacts = [
  {
    name: 'Max Mustermann',
    position: 'Geschäftsführer',
    email: 'max@kieks.me',
    phone: '+49 123 456789',
    mobile: '+49 123 4567890',
    address: 'Musterstraße 123',
    postalCode: '12345',
    city: 'Berlin',
    country: 'Deutschland',
    website: 'www.kieks.me',
    socialMedia: [
      { name: 'LinkedIn', url: 'https://linkedin.com/in/max-mustermann' },
      { name: 'Twitter', url: 'https://twitter.com/maxmustermann' },
    ],
  },
  {
    name: 'Anna Schmidt',
    position: 'Lead Developer',
    email: 'anna@kieks.me',
    phone: '+49 123 456788',
    mobile: '+49 123 4567880',
    address: 'Beispielweg 45',
    postalCode: '54321',
    city: 'München',
    country: 'Deutschland',
    website: 'www.kieks.me',
    socialMedia: [
      { name: 'GitHub', url: 'https://github.com/annaschmidt' },
      { name: 'LinkedIn', url: 'https://linkedin.com/in/anna-schmidt' },
    ],
  },
  {
    name: 'Tom Weber',
    position: 'Designer',
    email: 'tom@kieks.me',
    mobile: '+49 123 4567870',
    address: 'Designstraße 78',
    postalCode: '10115',
    city: 'Berlin',
    country: 'Deutschland',
    website: 'www.kieks.me',
  },
];

/**
 * Main function
 */
async function main() {
  try {
    header('Sample Business Cards Generator', 'Generiere Mustervisitenkarten', 'bgCyan');

    const outputDir = join(projectRoot, 'examples', 'sample-business-cards');
    
    info(`Generiere ${sampleContacts.length} Mustervisitenkarten...`);

    for (let i = 0; i < sampleContacts.length; i++) {
      const contact = sampleContacts[i];
      info(`\nGeneriere Visitenkarte ${i + 1}/${sampleContacts.length}: ${contact.name}`);
      
      const result = await generateBusinessCard(contact, outputDir);
      success(`✓ ${contact.name} - Vorder- und Rückseite generiert`);
    }

    endGroup();
    success(`Alle ${sampleContacts.length} Mustervisitenkarten erfolgreich generiert!`);
    info(`Ausgabe-Verzeichnis: ${outputDir}`);
  } catch (err) {
    endGroup();
    console.error('Fehler:', err.message);
    process.exit(1);
  }
}

main();
