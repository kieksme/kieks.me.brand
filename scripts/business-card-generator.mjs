#!/usr/bin/env node
/**
 * Business Card Generator
 * Generates PDF business cards from templates with QR code containing vCard data
 */

import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, unlinkSync, renameSync } from 'fs';
import { execSync, spawn } from 'child_process';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import inquirer from 'inquirer';
import {
  header,
  success,
  error,
  info,
  warn,
  cardProgress,
  validateContactData,
  normalizeUrl,
  endGroup,
  formatContactPreview,
  summaryBox,
} from './misc-cli-utils.mjs';
import { generateBusinessCardWithPdfLib } from './business-card-generator-pdflib.mjs';

/**
 * Convert SVG file to data URI (URL-encoded for better compatibility)
 * @param {string} filePath - Path to SVG file
 * @returns {string} Data URI
 */
function svgToDataUri(filePath) {
  try {
    const svgContent = readFileSync(filePath, 'utf-8');
    // URL-encode SVG content (more reliable than base64 for SVG)
    const encoded = encodeURIComponent(svgContent);
    return `data:image/svg+xml;charset=utf-8,${encoded}`;
  } catch (err) {
    throw new Error(`Logo konnte nicht geladen werden: ${err.message}`);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

/**
 * Generate vCard string from contact data
 * @param {Object} data - Contact data
 * @returns {string} vCard formatted string
 */
function generateVCard(data) {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];

  if (data.name) {
    lines.push(`FN:${data.name}`);
    // Split name into parts if possible
    const nameParts = data.name.split(' ');
    if (nameParts.length >= 2) {
      lines.push(`N:${nameParts.slice(-1)[0]};${nameParts.slice(0, -1).join(' ')};;;`);
    } else {
      lines.push(`N:${data.name};;;;`);
    }
  }

  if (data.position) {
    lines.push(`TITLE:${data.position}`);
  }

  // Add organization/company name
  const companyName = data.companyName || 'kieks.me GbR';
  lines.push(`ORG:${companyName}`);

  if (data.email) {
    lines.push(`EMAIL;TYPE=WORK,INTERNET:${data.email}`);
  }

  if (data.phone) {
    lines.push(`TEL;TYPE=WORK,VOICE:${data.phone}`);
  }

  if (data.mobile) {
    lines.push(`TEL;TYPE=CELL:${data.mobile}`);
  }

  if (data.address || data.city || data.postalCode) {
    const addressParts = [
      '', // Post office box
      '', // Extended address
      data.address || '', // Street address
      data.city || '', // City
      '', // State
      data.postalCode || '', // Postal code
      data.country || 'Deutschland', // Country
    ];
    lines.push(`ADR;TYPE=WORK:${addressParts.join(';')}`);
  }

  // Add website URL (if present)
  if (data.website) {
    const url = normalizeUrl(data.website);
    lines.push(`URL:${url}`);
  }

  // Add social media URLs as separate URL entries with TYPE parameter
  if (data.socialMedia) {
    // Handle both array format (new) and string format (legacy)
    if (Array.isArray(data.socialMedia)) {
      // New format: array of objects with name and url
      // Each social media entry becomes a separate URL entry in the vCard
      data.socialMedia.forEach((entry) => {
        if (entry.url) {
          const url = normalizeUrl(entry.url);
          // Use URL with TYPE parameter for social media profiles
          // Format: URL;TYPE=ServiceName:https://...
          lines.push(`URL;TYPE=${entry.name}:${url}`);
        } else if (entry.name) {
          // If no URL provided, add as note
          lines.push(`NOTE:Social Media: ${entry.name}`);
        }
      });
    } else {
      // Legacy format: simple string
      lines.push(`NOTE:Social Media: ${data.socialMedia}`);
    }
  }

  lines.push('END:VCARD');
  return lines.join('\n');
}

/**
 * Generate QR code as data URI
 * @param {string} vCardData - vCard formatted string
 * @returns {Promise<string>} Data URI of QR code image
 */
async function generateQRCode(vCardData) {
  try {
    const qrDataUri = await QRCode.toDataURL(vCardData, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 1,
    });
    return qrDataUri;
  } catch (err) {
    throw new Error(`QR-Code-Generierung fehlgeschlagen: ${err.message}`);
  }
}

/**
 * Simple template engine - replaces {{variable}} placeholders
 * Also supports {{#if variable}} …{{/if}} conditionals and {{#each array}} …{{/each}} loops
 * @param {string} template - Template string
 * @param {Object} data - Data object
 * @returns {string} Rendered template
 */
function renderTemplate(template, data) {
  let result = template;

  // Handle {{#each array}} …{{/each}} loops (must be processed before conditionals)
  const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  result = result.replace(eachRegex, (match, arrayName, content) => {
    const array = data[arrayName];
    if (Array.isArray(array) && array.length > 0) {
      return array.map((item) => {
        // Create a context with 'this' pointing to the current item
        const itemContext = { ...data, this: item };
        // Render the content for each item
        let itemContent = content;
        // Replace {{this.property}} with item.property
        const thisPropertyRegex = /\{\{this\.(\w+)\}\}/g;
        itemContent = itemContent.replace(thisPropertyRegex, (m, prop) => {
          return item[prop] || '';
        });
        // Also replace {{this}} with the item itself (for string arrays)
        itemContent = itemContent.replace(/\{\{this\}\}/g, () => {
          return typeof item === 'string' ? item : '';
        });
        // Process nested conditionals and placeholders
        return renderTemplate(itemContent, itemContext);
      }).join('');
    }
    return '';
  });

  // Handle conditionals {{#if variable}} …{{/if}}
  const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  result = result.replace(conditionalRegex, (match, variable, content) => {
    const value = data[variable];
    if (value && (Array.isArray(value) ? value.length > 0 : value.toString().trim() !== '')) {
      return content;
    }
    return '';
  });

  // Replace simple placeholders {{variable}}
  const placeholderRegex = /\{\{(\w+)\}\}/g;
  result = result.replace(placeholderRegex, (match, variable) => {
    return data[variable] || '';
  });

  return result;
}

/**
 * Load and render HTML template
 * @param {string} templatePath - Path to template file
 * @param {Object} data - Data to inject
 * @returns {string} Rendered HTML
 */
function loadTemplate(templatePath, data) {
  try {
    const template = readFileSync(templatePath, 'utf-8');
    return renderTemplate(template, data);
  } catch (err) {
    throw new Error(`Template konnte nicht geladen werden: ${err.message}`);
  }
}

/**
 * Check if Ghostscript is available
 * @returns {boolean} True if Ghostscript is available
 */
function checkGhostscriptAvailable() {
  try {
    execSync('gs --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert fonts to paths in PDF using Ghostscript
 * @param {string} inputPath - Input PDF path
 * @param {string} outputPath - Output PDF path
 * @returns {Promise<void>}
 */
async function convertFontsToPaths(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    // Ghostscript command to convert fonts to paths
    // Using simpler parameters that work better with variable fonts
    // -dNOPAUSE -dBATCH: non-interactive mode
    // -sDEVICE=pdfwrite: output as PDF
    // -dNoOutputFonts: don't embed fonts (forces path conversion)
    // -dCompatibilityLevel=1.7: PDF version (more compatible)
    // -dPDFSETTINGS=/prepress: high quality settings for prepress
    // -dColorConversionStrategy=/LeaveColorUnchanged: preserve colors
    // -dProcessColorModel=/DeviceRGB: use RGB color model
    // -dAutoRotatePages=/None: don't auto-rotate pages
    const gsProcess = spawn('gs', [
      '-dNOPAUSE',
      '-dBATCH',
      '-dQUIET',
      '-sDEVICE=pdfwrite',
      '-dNoOutputFonts',
      '-dCompatibilityLevel=1.7',
      '-dPDFSETTINGS=/prepress',
      '-dColorConversionStrategy=/LeaveColorUnchanged',
      '-dProcessColorModel=/DeviceRGB',
      '-dAutoRotatePages=/None',
      `-sOutputFile=${outputPath}`,
      inputPath,
    ], {
      // Set timeout for the process
      timeout: 30000,
    });

    let stderr = '';
    let stdout = '';
    
    gsProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    gsProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    gsProcess.on('close', (code) => {
      if (code === 0) {
        // Check if output file was created and has reasonable size
        if (!existsSync(outputPath)) {
          reject(new Error(`Output file not created`));
          return;
        }
        const stats = statSync(outputPath);
        if (stats.size === 0) {
          reject(new Error(`Output file is empty`));
          return;
        }
        resolve();
      } else {
        // Extract meaningful error message (first line usually contains the key info)
        const errorLines = (stderr || stdout || `Exit code ${code}`).split('\n').filter(line => line.trim());
        const errorMsg = errorLines.length > 0 ? errorLines[0] : `Exit code ${code}`;
        reject(new Error(`GPL Ghostscript: ${errorMsg}`));
      }
    });

    gsProcess.on('error', (err) => {
      reject(new Error(`Failed to execute Ghostscript: ${err.message}`));
    });
  });
}

/**
 * Generate PDF from HTML
 * @param {string} html - HTML content
 * @param {string} outputPath - Output PDF path
 * @param {boolean} convertFonts - Whether to convert fonts to paths (requires Ghostscript)
 * @returns {Promise<void>}
 */
async function generatePDF(html, outputPath, convertFonts = false) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
      ],
      timeout: 60000,
    });

    const page = await browser.newPage();
    
    // Set viewport for 300 DPI output with bleed (89mm x 59mm)
    // At 300 DPI: 89mm = 1051px, 59mm = 697px
    // Using deviceScaleFactor of 3 to achieve 300 DPI from base 100 DPI
    await page.setViewport({
      width: 1051, // 89mm at 300 DPI (with 2mm bleed on each side)
      height: 697, // 59mm at 300 DPI (with 2mm bleed on each side)
      deviceScaleFactor: 1,
    });
    
    // Set timeouts
    page.setDefaultNavigationTimeout(20000);
    page.setDefaultTimeout(20000);
    
    // Set content - use networkidle0 but with shorter timeout
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 15000,
    }).catch(() => {
      // Fallback: if networkidle0 fails, try with load
      return page.setContent(html, {
        waitUntil: 'load',
        timeout: 10000,
      });
    });

    // Wait for rendering (waitForTimeout was removed in newer Puppeteer versions)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate PDF with business card dimensions including bleed
    // Final size: 85mm x 55mm, with 2mm bleed = 89mm x 59mm
    const tempOutputPath = convertFonts ? outputPath.replace('.pdf', '.temp.pdf') : outputPath;
    
    await page.pdf({
      path: tempOutputPath,
      width: '89mm', // 85mm + 2mm bleed on each side
      height: '59mm', // 55mm + 2mm bleed on each side
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm',
      },
      // Note: Puppeteer doesn't directly support CMYK color profile setting
      // Color profile conversion should be done via post-processing
      timeout: 30000,
    });

    // Convert fonts to paths if requested and Ghostscript is available
    if (convertFonts) {
      if (checkGhostscriptAvailable()) {
        try {
          await convertFontsToPaths(tempOutputPath, outputPath);
          // Remove temporary file
          if (existsSync(tempOutputPath)) {
            try {
              unlinkSync(tempOutputPath);
            } catch {
              // Ignore deletion errors
            }
          }
        } catch (err) {
          // If conversion fails, use original file
          // Extract meaningful error message
          const errorMsg = err.message.split('\n')[0].trim();
          warn(`Font-zu-Pfad-Konvertierung fehlgeschlagen: ${errorMsg}`);
          warn('Hinweis: Die PDFs enthalten weiterhin eingebettete Fonts (Hanken Grotesk, Source Sans 3).');
          warn('Tipp: Um die Konvertierung zu deaktivieren, setzen Sie DISABLE_FONT_CONVERSION=true');
          if (existsSync(tempOutputPath)) {
            renameSync(tempOutputPath, outputPath);
          }
        }
      } else {
        warn('Ghostscript nicht gefunden. Schriften werden nicht in Pfade umgewandelt.');
        if (existsSync(tempOutputPath)) {
          renameSync(tempOutputPath, outputPath);
        }
      }
    }
  } catch (err) {
    throw new Error(`PDF-Generierung fehlgeschlagen: ${err.message}`);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        // Ignore close errors
      }
    }
  }
}

/**
 * Prompt user for generation method
 * @returns {Promise<string>} Generation method ('html' or 'pdflib')
 */
async function promptGenerationMethod() {
  const { method } = await inquirer.prompt([
    {
      type: 'list',
      name: 'method',
      message: 'Welche Generierungsmethode möchten Sie verwenden?',
      choices: [
        {
          name: 'HTML/CSS (Puppeteer) - Standard',
          value: 'html',
        },
        {
          name: 'pdf-lib (Direkt) - Schneller, keine Browser-Abhängigkeit',
          value: 'pdflib',
        },
      ],
      default: 'html',
    },
  ]);
  return method;
}

/**
 * Prompt user for main menu selection
 * @returns {Promise<Object>} Menu selection object
 */
async function promptMainMenu() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Was möchten Sie tun?',
      choices: [
        {
          name: 'Visitenkarte generieren',
          value: 'generate',
        },
        {
          name: 'Bestehende Visitenkarte bearbeiten',
          value: 'edit',
        },
        {
          name: 'Mustervisitenkarten generieren',
          value: 'generate-samples',
        },
        {
          name: 'Beenden',
          value: 'exit',
        },
      ],
    },
  ]);
  return { action };
}

/**
 * Prompt user for contact data with enhanced prompts
 * @param {Object} [existingData] - Optional existing contact data to pre-fill
 * @returns {Promise<Object>} Contact data object
 */
async function promptContactData(existingData = null) {
  // Always show checkbox selection, but pre-select fields that have values when editing
  const message = existingData 
    ? 'Welche Felder möchten Sie bearbeiten? (Sie können Felder hinzufügen oder entfernen)'
    : 'Welche optionalen Felder möchten Sie hinzufügen?';
  
  const result = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'includeFields',
      message: message,
      choices: [
        { 
          name: 'Position/Titel', 
          value: 'position', 
          checked: existingData ? !!existingData.position : true 
        },
        { 
          name: 'E-Mail-Adresse', 
          value: 'email', 
          checked: existingData ? !!existingData.email : true 
        },
        { 
          name: 'Telefonnummer', 
          value: 'phone', 
          checked: existingData ? !!existingData.phone : false 
        },
        { 
          name: 'Mobilnummer', 
          value: 'mobile', 
          checked: existingData ? !!existingData.mobile : true 
        },
        { 
          name: 'Adresse', 
          value: 'address', 
          checked: existingData ? !!(existingData.address || existingData.city || existingData.postalCode) : true 
        },
        { 
          name: 'Website', 
          value: 'website', 
          checked: existingData ? !!existingData.website : true 
        },
        { 
          name: 'Social Media', 
          value: 'socialMedia', 
          checked: existingData ? !!(existingData.socialMedia && (Array.isArray(existingData.socialMedia) ? existingData.socialMedia.length > 0 : existingData.socialMedia)) : false 
        },
      ],
    },
  ]);
  
  const includeFields = result.includeFields;

  const questions = [
    {
      type: 'input',
      name: 'name',
      message: 'Name (erforderlich):',
      default: existingData?.name || undefined,
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Name ist erforderlich';
        }
        return true;
      },
    },
  ];

  // Add position if selected
  if (includeFields.includes('position')) {
    questions.push({
      type: 'input',
      name: 'position',
      message: 'Position/Titel:',
      default: existingData?.position || undefined,
    });
  }

  // Add email if selected
  if (includeFields.includes('email')) {
    questions.push({
      type: 'input',
      name: 'email',
      message: 'E-Mail-Adresse:',
      default: existingData?.email || undefined,
      validate: (input) => {
        if (!input) return true;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(input) || 'Ungültige E-Mail-Adresse';
      },
    });
  }

  // Add phone if selected
  if (includeFields.includes('phone')) {
    questions.push({
      type: 'input',
      name: 'phone',
      message: 'Telefonnummer:',
      default: existingData?.phone || undefined,
      validate: (input) => {
        if (!input) return true;
        const phoneRegex = /^[\d\s\+\-\(\)]+$/;
        return phoneRegex.test(input) && input.replace(/\D/g, '').length >= 6 || 'Ungültige Telefonnummer';
      },
    });
  }

  // Add mobile if selected
  if (includeFields.includes('mobile')) {
    questions.push({
      type: 'input',
      name: 'mobile',
      message: 'Mobilnummer:',
      default: existingData?.mobile || undefined,
      validate: (input) => {
        if (!input) return true;
        const phoneRegex = /^[\d\s\+\-\(\)]+$/;
        return phoneRegex.test(input) && input.replace(/\D/g, '').length >= 6 || 'Ungültige Mobilnummer';
      },
    });
  }

  // Add address fields if selected
  if (includeFields.includes('address')) {
    questions.push(
      {
        type: 'input',
        name: 'address',
        message: 'Straße und Hausnummer:',
        default: existingData?.address || undefined,
      },
      {
        type: 'input',
        name: 'postalCode',
        message: 'Postleitzahl:',
        default: existingData?.postalCode || undefined,
      },
      {
        type: 'input',
        name: 'city',
        message: 'Stadt:',
        default: existingData?.city || undefined,
      },
      {
        type: 'list',
        name: 'country',
        message: 'Land:',
        choices: [
          'Deutschland',
          'Österreich',
          'Schweiz',
          'Andere',
        ],
        default: existingData?.country || 'Deutschland',
      },
    );
  }

  // Add website if selected
  if (includeFields.includes('website')) {
    questions.push({
      type: 'input',
      name: 'website',
      message: 'Website (mit oder ohne https://):',
      default: existingData?.website || undefined,
      validate: (input) => {
        if (!input) return true;
        try {
          const urlWithProtocol = input.startsWith('http://') || input.startsWith('https://')
            ? input
            : `https://${input}`;
          new URL(urlWithProtocol);
          return true;
        } catch {
          return 'Ungültige Website-URL';
        }
      },
    });
  }

  const answers = await inquirer.prompt(questions);

  // Handle social media if selected (after prompt to have access to answers object)
  if (includeFields.includes('socialMedia')) {
    // Convert existing string format to array format for backward compatibility
    let existingSocialMedia = [];
    if (existingData?.socialMedia) {
      if (Array.isArray(existingData.socialMedia)) {
        existingSocialMedia = existingData.socialMedia;
      } else {
        // Legacy format: try to parse as comma-separated string
        const parts = existingData.socialMedia.split(',').map(s => s.trim()).filter(Boolean);
        existingSocialMedia = parts.map(part => ({ name: part, url: '' }));
      }
    }

    // Prompt for social media entries
    const socialMediaEntries = [];
    let addMore = true;
    let editExisting = false;
    
    if (existingSocialMedia.length > 0) {
      // Show existing entries and ask if user wants to edit them
      const editPrompt = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'editExisting',
          message: `Bestehende Social-Media-Einträge bearbeiten? (${existingSocialMedia.length} Einträge gefunden)`,
          default: false,
        },
      ]);
      
      editExisting = editPrompt.editExisting;
      
      if (editExisting) {
        // Edit existing entries
        for (let i = 0; i < existingSocialMedia.length; i++) {
          const entry = existingSocialMedia[i];
          const { name, url, keep } = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: `Social-Media-Name (z.B. LinkedIn, GitHub, Twitter):`,
              default: entry.name || entry || '',
              validate: (input) => {
                if (!input || input.trim().length === 0) {
                  return 'Name ist erforderlich';
                }
                return true;
              },
            },
            {
              type: 'input',
              name: 'url',
              message: 'URL (mit oder ohne https://):',
              default: entry.url || '',
              validate: (input) => {
                if (!input) return true;
                try {
                  const urlWithProtocol = input.startsWith('http://') || input.startsWith('https://')
                    ? input
                    : `https://${input}`;
                  new URL(urlWithProtocol);
                  return true;
                } catch {
                  return 'Ungültige URL';
                }
              },
            },
            {
              type: 'confirm',
              name: 'keep',
              message: 'Diesen Eintrag behalten?',
              default: true,
            },
          ]);
          
          if (keep && name && name.trim()) {
            socialMediaEntries.push({
              name: name.trim(),
              url: url ? normalizeUrl(url) : '',
            });
          }
        }
      } else {
        // Use existing entries as-is
        socialMediaEntries.push(...existingSocialMedia.map(e => ({
          name: e.name || e,
          url: e.url || '',
        })));
      }
    }
    
    // Ask if user wants to add more entries
    if (existingSocialMedia.length === 0 || editExisting) {
      const { addNew } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'addNew',
          message: existingSocialMedia.length > 0 
            ? 'Weitere Social-Media-Einträge hinzufügen?'
            : 'Social-Media-Einträge hinzufügen?',
          default: true,
        },
      ]);
      
      addMore = addNew;
    } else {
      const { addNew } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'addNew',
          message: 'Weitere Social-Media-Einträge hinzufügen?',
          default: false,
        },
      ]);
      addMore = addNew;
    }
    
    // Add new entries
    while (addMore) {
      const { name, url, addAnother } = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Social-Media-Name (z.B. LinkedIn, GitHub, Twitter):',
          validate: (input) => {
            if (!input || input.trim().length === 0) {
              return 'Name ist erforderlich';
            }
            return true;
          },
        },
        {
          type: 'input',
          name: 'url',
          message: 'URL (mit oder ohne https://):',
          validate: (input) => {
            if (!input) return true;
            try {
              const urlWithProtocol = input.startsWith('http://') || input.startsWith('https://')
                ? input
                : `https://${input}`;
              new URL(urlWithProtocol);
              return true;
            } catch {
              return 'Ungültige URL';
            }
          },
        },
        {
          type: 'confirm',
          name: 'addAnother',
          message: 'Weiteren Social-Media-Eintrag hinzufügen?',
          default: false,
        },
      ]);
      
      if (name && name.trim()) {
        socialMediaEntries.push({
          name: name.trim(),
          url: url ? normalizeUrl(url) : '',
        });
      }
      
      addMore = addAnother;
    }
    
    // Store as array in answers
    if (socialMediaEntries.length > 0) {
      answers.socialMedia = socialMediaEntries;
    }
  }

  // Handle country selection - only prompt for custom country if "Andere" was selected
  if (answers.country === 'Andere') {
    const { countryOther } = await inquirer.prompt([
      {
        type: 'input',
        name: 'countryOther',
        message: 'Land eingeben:',
        default: 'Deutschland',
      },
    ]);
    answers.country = countryOther;
  }

  // Ensure country has a default value if address was selected
  if (!answers.country && includeFields.includes('address')) {
    answers.country = 'Deutschland';
  }

  // Remove fields that were not selected (to allow removing fields when editing)
  // This ensures that if a user unchecks a field, its value is removed
  if (!includeFields.includes('position')) {
    delete answers.position;
  }
  if (!includeFields.includes('email')) {
    delete answers.email;
  }
  if (!includeFields.includes('phone')) {
    delete answers.phone;
  }
  if (!includeFields.includes('mobile')) {
    delete answers.mobile;
  }
  if (!includeFields.includes('address')) {
    delete answers.address;
    delete answers.postalCode;
    delete answers.city;
    delete answers.country;
  }
  if (!includeFields.includes('website')) {
    delete answers.website;
  }
  if (!includeFields.includes('socialMedia')) {
    delete answers.socialMedia;
  }

  // Clean up empty strings and undefined values
  const cleanedAnswers = {};
  for (const [key, value] of Object.entries(answers)) {
    // Keep the value if it's not undefined, null, or empty string
    if (value !== undefined && value !== null && value !== '') {
      cleanedAnswers[key] = value;
    }
  }

  return cleanedAnswers;
}

/**
 * Prompt user for confirmation with data preview
 * @param {Object} contactData - Contact data to preview
 * @returns {Promise<boolean>} True if confirmed, false otherwise
 */
async function promptConfirmation(contactData) {
  // Show preview
  console.log('\n');
  summaryBox('Vorschau der Kontaktdaten', formatContactPreview(contactData), 'cyan');
  console.log('\n');

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Möchten Sie mit diesen Daten fortfahren?',
      default: true,
    },
  ]);

  return confirmed;
}

/**
 * Prompt user if they want to generate another card
 * @returns {Promise<boolean>} True if user wants to generate another card
 */
async function promptRepeat() {
  const { repeat } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'repeat',
      message: 'Möchten Sie eine weitere Visitenkarte generieren?',
      default: false,
    },
  ]);

  return repeat;
}

/**
 * Get filename for contact data JSON file
 * @param {Object} contactData - Contact data
 * @returns {string} Filename
 */
function getContactDataFilename(contactData) {
  const nameSlug = contactData.name.replace(/\s+/g, '-');
  return `${nameSlug}.json`;
}

/**
 * Save contact data to JSON file
 * @param {Object} contactData - Contact data to save
 * @param {string} outputDir - Output directory
 * @returns {string} Path to saved JSON file
 */
function saveContactData(contactData, outputDir) {
  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const filename = getContactDataFilename(contactData);
  const filePath = join(outputDir, filename);
  
  // Add metadata
  const dataToSave = {
    ...contactData,
    _metadata: {
      savedAt: new Date().toISOString(),
      version: '1.0',
    },
  };

  writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
  return filePath;
}

/**
 * Load contact data from JSON file
 * @param {string} filePath - Path to JSON file
 * @returns {Object} Contact data
 */
function loadContactData(filePath) {
  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    
    // Remove metadata before returning
    const { _metadata, ...contactData } = data;
    return contactData;
  } catch (err) {
    throw new Error(`Fehler beim Laden der Kontaktdaten: ${err.message}`);
  }
}

/**
 * List all available contact data files in output directory
 * @param {string} outputDir - Output directory
 * @returns {Array<Object>} Array of file info objects with name, path, and contact data
 */
function listContactDataFiles(outputDir) {
  if (!existsSync(outputDir)) {
    return [];
  }

  try {
    const files = readdirSync(outputDir);
    const jsonFiles = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = join(outputDir, file);
        try {
          const contactData = loadContactData(filePath);
          const stats = statSync(filePath);
          return {
            name: contactData.name || file.replace('.json', ''),
            filename: file,
            path: filePath,
            contactData,
            modified: stats.mtime,
          };
        } catch (err) {
          // Skip files that can't be loaded
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.modified - a.modified); // Sort by modification date, newest first

    return jsonFiles;
  } catch (err) {
    error(`Fehler beim Auflisten der Kontaktdaten: ${err.message}`);
    return [];
  }
}

/**
 * Prompt user to select an existing contact data file
 * @param {string} outputDir - Output directory
 * @returns {Promise<Object|null>} Selected contact data or null if cancelled
 */
async function promptSelectExistingContact(outputDir) {
  const files = listContactDataFiles(outputDir);

  if (files.length === 0) {
    warn('Keine gespeicherten Kontaktdaten gefunden.');
    return null;
  }

  const { selectedFile } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedFile',
      message: 'Welche Visitenkarte möchten Sie bearbeiten?',
      choices: [
        ...files.map(file => ({
          name: `${file.name} (${new Date(file.modified).toLocaleDateString('de-DE')})`,
          value: file.path,
        })),
        {
          name: 'Abbrechen',
          value: null,
        },
      ],
    },
  ]);

  if (!selectedFile) {
    return null;
  }

  return loadContactData(selectedFile);
}

/**
 * Generate business card PDFs
 * @param {Object} contactData - Contact data
 * @param {string} outputDir - Output directory
 * @returns {Promise<void>}
 */
async function generateBusinessCard(contactData, outputDir) {
  // Validate data
  const validation = validateContactData(contactData);
  if (!validation.isValid) {
    error('Validierungsfehler:');
    validation.errors.forEach((err) => error(`  - ${err}`));
    throw new Error('Kontaktdaten sind ungültig');
  }

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Generate vCard
  cardProgress('Generiere vCard-Daten …', 'generating');
  const vCardData = generateVCard(contactData);
  cardProgress('vCard-Daten generiert', 'done');

  // Generate QR code
  cardProgress('Generiere QR-Code …', 'generating');
  const qrCodeDataUri = await generateQRCode(vCardData);
  cardProgress('QR-Code generiert', 'done');

  // Load logo as SVG content
  const logoPath = join(projectRoot, 'assets', 'logos', 'kieks.me-single-circle.svg');
  cardProgress('Lade Logo …', 'generating');
  const logoSvgContent = readFileSync(logoPath, 'utf-8');
  const logoDataUri = svgToDataUri(logoPath);
  cardProgress('Logo geladen', 'done');

  // Prepare template data
  const templateData = {
     ...contactData,
    qrCodeDataUri,
    logoPath: logoDataUri,
    logoSvgContent: logoSvgContent, // Also provide raw SVG for inline embedding
    companyName: 'kieks.me GbR', // Company name for display on business card
  };

  // Normalize website URL
  if (templateData.website) {
    templateData.website = normalizeUrl(templateData.website);
  }

  // Check if Ghostscript is available for font-to-path conversion
  // Can be disabled via environment variable DISABLE_FONT_CONVERSION=true
  const disableFontConversion = process.env.DISABLE_FONT_CONVERSION === 'true';
  const convertFonts = !disableFontConversion && checkGhostscriptAvailable();
  
  if (convertFonts) {
    info('Ghostscript gefunden. Schriften werden in Pfade umgewandelt.');
  } else if (disableFontConversion) {
    info('Font-zu-Pfad-Konvertierung deaktiviert (DISABLE_FONT_CONVERSION=true).');
  } else {
    warn('Ghostscript nicht gefunden. Schriften werden nicht in Pfade umgewandelt.');
    warn('Für Druckqualität wird empfohlen, Ghostscript zu installieren.');
  }

  // Load CSS once for both sides
  const cssPath = join(projectRoot, 'assets', 'templates', 'business-card-styles.css');
  const css = readFileSync(cssPath, 'utf-8');

  // Generate front side (Page 1)
  cardProgress('Generiere Vorderseite (Seite 1) …', 'generating');
  const frontTemplatePath = join(projectRoot, 'assets', 'templates', 'business-card-front.html');
  const frontHtml = loadTemplate(frontTemplatePath, templateData);
  
  // Inject CSS
  const frontHtmlFinal = frontHtml.replace(
    '<link rel="stylesheet" href="business-card-styles.css">',
    `<style>${css}</style>`
  );

  const frontOutputPath = join(outputDir, `${contactData.name.replace(/\s+/g, '-')}-front.pdf`);
  try {
    await generatePDF(frontHtmlFinal, frontOutputPath, convertFonts);
    cardProgress(`Vorderseite gespeichert: ${frontOutputPath}`, 'done');
  } catch (err) {
    cardProgress(`Fehler bei Vorderseite: ${err.message}`, 'error');
    throw err;
  }

  // Generate back side (Page 2)
  cardProgress('Generiere Rückseite (Seite 2) …', 'generating');
  const backTemplatePath = join(projectRoot, 'assets', 'templates', 'business-card-back.html');
  const backHtml = loadTemplate(backTemplatePath, templateData);
  
  // Inject CSS
  const backHtmlFinal = backHtml.replace(
    '<link rel="stylesheet" href="business-card-styles.css">',
    `<style>${css}</style>`
  );

  const backOutputPath = join(outputDir, `${contactData.name.replace(/\s+/g, '-')}-back.pdf`);
  try {
    await generatePDF(backHtmlFinal, backOutputPath, convertFonts);
    cardProgress(`Rückseite gespeichert: ${backOutputPath}`, 'done');
  } catch (err) {
    cardProgress(`Fehler bei Rückseite: ${err.message}`, 'error');
    throw err;
  }

  // Save contact data to JSON file
  cardProgress('Speichere Kontaktdaten …', 'generating');
  const jsonPath = saveContactData(contactData, outputDir);
  cardProgress(`Kontaktdaten gespeichert: ${jsonPath}`, 'done');

  return {
    front: frontOutputPath,
    back: backOutputPath,
    json: jsonPath,
  };
}

/**
 * Main function
 */
async function main() {
  try {
    header('Business Card Generator', 'Generiere Visitenkarten mit QR-Code', 'bgCyan');

    let shouldContinue = true;

    while (shouldContinue) {
      // Show main menu
      const { action } = await promptMainMenu();

      if (action === 'exit') {
        info('Auf Wiedersehen!');
        shouldContinue = false;
        break;
      }

      if (action === 'generate-samples') {
        // Import and run sample generator
        const sampleGeneratorPath = join(__dirname, 'generate-sample-cards.mjs');
        const { default: generateSamples } = await import(`file://${sampleGeneratorPath}`);
        // Note: generate-sample-cards.mjs doesn't export a default function,
        // so we'll handle it differently - just execute the script logic here
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

        const outputDir = join(projectRoot, 'examples', 'sample-business-cards');
        
        info(`Generiere ${sampleContacts.length} Mustervisitenkarten...`);

        for (let i = 0; i < sampleContacts.length; i++) {
          const contact = sampleContacts[i];
          info(`\nGeneriere Visitenkarte ${i + 1}/${sampleContacts.length}: ${contact.name}`);
          
          const result = await generateBusinessCard(contact, outputDir);
          success(`✓ ${contact.name} - Vorder- und Rückseite generiert`);
        }

        success(`Alle ${sampleContacts.length} Mustervisitenkarten erfolgreich generiert!`);
        info(`Ausgabe-Verzeichnis: ${outputDir}`);
        endGroup();
        shouldContinue = false;
        break;
      }

      if (action === 'edit') {
        // Prompt for generation method
        const generationMethod = await promptGenerationMethod();
        
        // Determine output directory
        const outputDir = join(projectRoot, 'output');
        
        // Prompt user to select existing contact
        const existingData = await promptSelectExistingContact(outputDir);
        
        if (!existingData) {
          // User cancelled or no files found
          const repeat = await promptRepeat();
          if (!repeat) {
            shouldContinue = false;
          }
          continue;
        }

        info('Bearbeite bestehende Visitenkarte:');
        // Prompt for contact data with pre-filled values
        const contactData = await promptContactData(existingData);

        // Show confirmation with preview
        const confirmed = await promptConfirmation(contactData);

        if (!confirmed) {
          warn('Bearbeitung abgebrochen.');
          const repeat = await promptRepeat();
          if (!repeat) {
            shouldContinue = false;
            break;
          }
          continue;
        }

        // Generate business cards
        try {
          let result;
          if (generationMethod === 'pdflib') {
            result = await generateBusinessCardWithPdfLib(contactData, outputDir);
          } else {
            result = await generateBusinessCard(contactData, outputDir);
          }

          success('Visitenkarten erfolgreich aktualisiert!');
          info(`Vorderseite: ${result.front}`);
          info(`Rückseite: ${result.back}`);
          if (result.json) {
            info(`Kontaktdaten: ${result.json}`);
          }
        } catch (err) {
          error(`Fehler bei der Generierung: ${err.message}`);
          const { retry } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'retry',
              message: 'Möchten Sie es erneut versuchen?',
              default: false,
            },
          ]);
          if (retry) {
            continue;
          }
        }

        // Ask if user wants to generate another card
        const repeat = await promptRepeat();
        if (!repeat) {
          shouldContinue = false;
        }
      }

      if (action === 'generate') {
        // Prompt for generation method
        const generationMethod = await promptGenerationMethod();
        
        // Prompt for contact data
        info('Bitte geben Sie die Kontaktdaten ein:');
        const contactData = await promptContactData();

        // Show confirmation with preview
        const confirmed = await promptConfirmation(contactData);

        if (!confirmed) {
          warn('Generierung abgebrochen.');
          const repeat = await promptRepeat();
          if (!repeat) {
            shouldContinue = false;
            break;
          }
          continue;
        }

        // Determine output directory
        const outputDir = join(projectRoot, 'output');
        
        // Generate business cards
        try {
          let result;
          if (generationMethod === 'pdflib') {
            result = await generateBusinessCardWithPdfLib(contactData, outputDir);
            // Save contact data to JSON file (same as HTML method)
            cardProgress('Speichere Kontaktdaten …', 'generating');
            const jsonPath = saveContactData(contactData, outputDir);
            cardProgress(`Kontaktdaten gespeichert: ${jsonPath}`, 'done');
            result.json = jsonPath;
          } else {
            result = await generateBusinessCard(contactData, outputDir);
          }

          success('Visitenkarten erfolgreich generiert!');
          info(`Vorderseite: ${result.front}`);
          info(`Rückseite: ${result.back}`);
          if (result.json) {
            info(`Kontaktdaten: ${result.json}`);
          }
        } catch (err) {
          error(`Fehler bei der Generierung: ${err.message}`);
          const { retry } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'retry',
              message: 'Möchten Sie es erneut versuchen?',
              default: false,
            },
          ]);
          if (retry) {
            continue;
          }
        }

        // Ask if user wants to generate another card
        const repeat = await promptRepeat();
        if (!repeat) {
          shouldContinue = false;
        }
      }
    }

    endGroup();
  } catch (err) {
    endGroup();
    error(`Fehler: ${err.message}`);
    process.exit(1);
  }
}

// Run if called directly (check if this file is being executed, not imported)
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]);
if (isMainModule) {
  main();
}

export {
  generateBusinessCard,
  generateVCard,
  generateQRCode,
  promptContactData,
  promptMainMenu,
  promptConfirmation,
  promptRepeat,
  saveContactData,
  loadContactData,
  listContactDataFiles,
  promptSelectExistingContact,
};
