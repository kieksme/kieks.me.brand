#!/usr/bin/env node
/**
 * Business Card Generator (pdf-lib version)
 * Generates PDF business cards using pdf-lib directly without browser/Puppeteer
 */

import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { PDFDocument, rgb } from 'pdf-lib';
import sharp from 'sharp';
import QRCode from 'qrcode';
import {
  cardProgress,
  validateContactData,
  validateEmail,
  validateUrl,
  normalizeUrl,
  header,
  success,
  error,
  info,
  warn,
  endGroup,
  formatContactPreview,
} from './misc-cli-utils.mjs';
import { loadConfig, hexToRgbNormalized } from './config-loader.mjs';
import inquirer from 'inquirer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Load configuration
const CONFIG = loadConfig();
const CARD_CONFIG = CONFIG.businessCard;

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

// Business card dimensions from config
const MM_TO_PT = CARD_CONFIG.dimensions.mmToPt;
const CARD_WIDTH_MM = CARD_CONFIG.dimensions.widthMm;
const CARD_HEIGHT_MM = CARD_CONFIG.dimensions.heightMm;
const SAFE_AREA_OFFSET_MM = CARD_CONFIG.dimensions.safeAreaOffsetMm;
const SAFE_AREA_WIDTH_MM = CARD_CONFIG.dimensions.safeAreaWidthMm;
const SAFE_AREA_HEIGHT_MM = CARD_CONFIG.dimensions.safeAreaHeightMm;

// Brand colors from config (normalized to 0-1 for PDF)
function createColor(hex) {
  const normalized = hexToRgbNormalized(hex);
  return rgb(normalized.r, normalized.g, normalized.b);
}

const COLORS = {
  navy: createColor(CONFIG.brand.colors.navy),
  white: createColor(CONFIG.brand.colors.white),
  aqua: createColor(CONFIG.brand.colors.aqua),
  lightGray: createColor(CONFIG.brand.colors.lightGray),
  darkGray: createColor(CONFIG.brand.colors.darkGray),
  mediumGray: createColor(CONFIG.brand.colors.mediumGray),
  black: createColor(CONFIG.brand.colors.black),
};

/**
 * Convert mm to points
 * @param {number} mm - Millimeters
 * @returns {number} Points
 */
function mmToPt(mm) {
  return mm * MM_TO_PT;
}

/**
 * Convert SVG to PNG buffer using sharp
 * @param {string} svgPath - Path to SVG file
 * @param {number} width - Target width in pixels
 * @param {number} height - Target height in pixels
 * @returns {Promise<Buffer>} PNG buffer
 */
async function svgToPng(svgPath, width = 1000, height = 1000) {
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
    throw new Error(`SVG zu PNG Konvertierung fehlgeschlagen: ${err.message}`);
  }
}

/**
 * Convert data URI to buffer
 * @param {string} dataUri - Data URI string
 * @returns {Buffer} Image buffer
 */
function dataUriToBuffer(dataUri) {
  const base64Data = dataUri.split(',')[1];
  return Buffer.from(base64Data, 'base64');
}

/**
 * Load fonts for pdf-lib
 * Loads custom fonts (Hanken Grotesk, Source Sans 3) from assets/fonts/
 * @param {PDFDocument} pdfDoc - PDF document
 * @returns {Promise<Object>} Font objects
 */
async function loadFonts(pdfDoc) {
  try {
    // Try to load and register fontkit for custom font embedding
    let fontkit;
    try {
      const fontkitModule = await import('@pdf-lib/fontkit');
      // Try default export first, then namespace import
      fontkit = fontkitModule.default || fontkitModule;
      if (!fontkit) {
        throw new Error('fontkit module not found');
      }
      pdfDoc.registerFontkit(fontkit);
    } catch (fontkitError) {
      console.warn(`⚠️  fontkit not available (${fontkitError.message}), falling back to standard fonts`);
      const helvetica = await pdfDoc.embedFont('Helvetica');
      const helveticaBold = await pdfDoc.embedFont('Helvetica-Bold');
      return {
        body: helvetica,
        bodyBold: helveticaBold,
        heading: helveticaBold,
        headingItalic: helveticaBold,
        bodyItalic: helvetica,
      };
    }
    
    // Load Hanken Grotesk (heading font) with weight 500 (Medium) for larger text
    const hankenGroteskRegularPath = join(projectRoot, 'assets', 'fonts', 'hanken-grotesk', '500', 'regular.ttf');
    const hankenGroteskItalicPath = join(projectRoot, 'assets', 'fonts', 'hanken-grotesk', '500', 'italic.ttf');
    
    // Load Source Sans 3 (body font) with weight 400 (Regular) for smaller text
    const sourceSans3RegularPath = join(projectRoot, 'assets', 'fonts', 'source-sans-3', '400', 'regular.ttf');
    const sourceSans3ItalicPath = join(projectRoot, 'assets', 'fonts', 'source-sans-3', '400', 'italic.ttf');
    
    // Check if font files exist
    if (!existsSync(hankenGroteskRegularPath) || !existsSync(sourceSans3RegularPath)) {
      console.warn('⚠️  Custom fonts not found, falling back to standard fonts');
      const helvetica = await pdfDoc.embedFont('Helvetica');
      const helveticaBold = await pdfDoc.embedFont('Helvetica-Bold');
      return {
        body: helvetica,
        bodyBold: helveticaBold,
        heading: helveticaBold,
        headingItalic: helveticaBold,
        bodyItalic: helvetica,
      };
    }
    
    // Load font files as ArrayBuffer
    const hankenGroteskRegularBytes = readFileSync(hankenGroteskRegularPath);
    const hankenGroteskItalicBytes = existsSync(hankenGroteskItalicPath) 
      ? readFileSync(hankenGroteskItalicPath) 
      : hankenGroteskRegularBytes;
    
    const sourceSans3RegularBytes = readFileSync(sourceSans3RegularPath);
    const sourceSans3ItalicBytes = existsSync(sourceSans3ItalicPath)
      ? readFileSync(sourceSans3ItalicPath)
      : sourceSans3RegularBytes;
    
    // Embed fonts in PDF
    const hankenGroteskRegular = await pdfDoc.embedFont(hankenGroteskRegularBytes);
    const hankenGroteskItalic = await pdfDoc.embedFont(hankenGroteskItalicBytes);
    
    // Embed Source Sans 3 with weight 400 (Regular) for smaller text
    const sourceSans3Regular = await pdfDoc.embedFont(sourceSans3RegularBytes);
    const sourceSans3Italic = await pdfDoc.embedFont(sourceSans3ItalicBytes);
    
    return {
      // Body fonts (Source Sans 3) - using weight 400 (Regular) for smaller text
      body: sourceSans3Regular,
      bodyBold: sourceSans3Regular,
      bodyItalic: sourceSans3Italic,
      
      // Heading fonts (Hanken Grotesk) - using weight 500 (Medium) for larger text
      heading: hankenGroteskRegular,
      headingItalic: hankenGroteskItalic,
    };
  } catch (error) {
    console.warn(`⚠️  Error loading custom fonts: ${error.message}, falling back to standard fonts`);
    // Fallback to standard fonts
    const helvetica = await pdfDoc.embedFont('Helvetica');
    const helveticaBold = await pdfDoc.embedFont('Helvetica-Bold');
    return {
      body: helvetica,
      bodyBold: helveticaBold,
      heading: helveticaBold,
      headingItalic: helveticaBold,
      bodyItalic: helvetica,
    };
  }
}

/**
 * Generate QR code as PNG buffer
 * @param {string} vCardData - vCard formatted string
 * @returns {Promise<Buffer>} PNG buffer of QR code
 */
async function generateQRCodeBuffer(vCardData) {
  try {
    const qrDataUri = await QRCode.toDataURL(vCardData, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 1,
    });
    return dataUriToBuffer(qrDataUri);
  } catch (err) {
    throw new Error(`QR-Code-Generierung fehlgeschlagen: ${err.message}`);
  }
}

/**
 * Render front side of business card
 * @param {PDFDocument} pdfDoc - PDF document
 * @param {Object} page - PDF page
 * @param {Object} data - Contact data and assets
 * @param {Object} fonts - Font objects
 * @param {Object} images - Image objects (logo, qrCode)
 */
function renderFrontSide(page, data, fonts, images) {
  const pageWidth = mmToPt(CARD_WIDTH_MM);
  const pageHeight = mmToPt(CARD_HEIGHT_MM);
  const safeOffset = mmToPt(SAFE_AREA_OFFSET_MM);
  
  // Background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: COLORS.navy,
  });
  
  // Logo positioning
  // Logo container: left 3.5mm, top 3.5mm, width 40mm, height 52mm
  const logoX = safeOffset;
  const logoY = pageHeight - safeOffset - mmToPt(47); // Max height 47mm, with padding
  const logoWidth = mmToPt(40);
  const logoHeight = mmToPt(47);
  
  if (images.logo) {
    // Calculate logo dimensions maintaining aspect ratio
    const logoDims = images.logo.scale(1);
    const logoAspectRatio = logoDims.width / logoDims.height;
    let finalLogoWidth = logoWidth;
    let finalLogoHeight = logoWidth / logoAspectRatio;
    
    if (finalLogoHeight > logoHeight) {
      finalLogoHeight = logoHeight;
      finalLogoWidth = logoHeight * logoAspectRatio;
    }
    
    // Center logo horizontally and vertically
    const logoXCentered = logoX + (logoWidth - finalLogoWidth) / 2;
    // Vertically center the logo container, then shift 5mm down, then center logo within container
    const logoContainerY = (pageHeight - logoHeight) / 2 - mmToPt(5);
    const logoYCentered = logoContainerY + (logoHeight - finalLogoHeight) / 2;
    
    page.drawImage(images.logo, {
      x: logoXCentered,
      y: logoYCentered,
      width: finalLogoWidth,
      height: finalLogoHeight,
    });
  }
  
  // Contact info positioning
  // Contact info: left 48mm, top 15.5mm
  // Right margin: 4.5mm (minimal margin for safe area)
  const contactX = mmToPt(48);
  const contactY = pageHeight - mmToPt(15.5);
  let currentY = contactY;
  
  // Calculate available width for contact info
  // Card width: 89mm (with bleed), right margin: 4.5mm
  // Contact info starts at 48mm, so available width = 89 - 48 - 4.5 = 36.5mm
  const maxContactWidth = mmToPt(36.5);
  
  // Name (Hanken Grotesk Bold/700, 12pt, white)
  if (data.name) {
    page.drawText(data.name, {
      x: contactX,
      y: currentY,
      size: 12,
      color: COLORS.white,
      font: fonts.heading,
    });
    currentY -= 15; // 1.5mm spacing + line height
  }
  
  // Position (Hanken Grotesk Medium/500, 7.5pt, aqua)
  if (data.position) {
    page.drawText(data.position, {
      x: contactX,
      y: currentY,
      size: 7.5,
      color: COLORS.aqua,
      font: fonts.heading,
    });
    currentY -= 10;
  }
  
  // Company name (Source Sans 3 Regular/400, 7pt, light gray)
  const companyName = data.companyName || 'kieks.me GbR';
  page.drawText(companyName, {
    x: contactX,
    y: currentY,
    size: 7,
    color: COLORS.lightGray,
    font: fonts.body,
  });
  currentY -= 12; // 3mm spacing
  
  // Contact details (Source Sans 3, 7pt, white)
  const contactDetails = [];
  
  if (data.email) {
    contactDetails.push({ label: 'E-Mail:', value: data.email });
  }
  if (data.phone) {
    contactDetails.push({ label: 'Tel:', value: data.phone });
  }
  if (data.mobile) {
    contactDetails.push({ label: 'Mobil:', value: data.mobile });
  }
  if (data.website) {
    contactDetails.push({ label: 'Web:', value: data.website });
  }
  
  // Label width - longest label is "E-Mail:" which needs ~7mm
  // Use 10mm to match original template, giving more space for values
  const labelWidth = mmToPt(10); // 10mm label width (as in original template)
  const valueX = contactX + labelWidth;
  const valueMaxWidth = maxContactWidth - labelWidth; // Available width for values (now ~27.5mm)
  const lineHeight = mmToPt(4); // ~1mm gap between lines
  const fontSize = 7;
  
  contactDetails.forEach((detail) => {
    // Label (semi-bold, light gray)
    page.drawText(detail.label, {
      x: contactX,
      y: currentY,
      size: fontSize,
      color: COLORS.lightGray,
      font: fonts.bodyBold,
    });
    
    // Draw value - with more width available, should fit without wrapping
    page.drawText(detail.value, {
      x: valueX,
      y: currentY,
      size: fontSize,
      color: COLORS.white,
      font: fonts.body,
    });
    
    currentY -= lineHeight;
  });
}

/**
 * Render back side of business card
 * @param {PDFDocument} pdfDoc - PDF document
 * @param {Object} page - PDF page
 * @param {Object} data - Contact data and assets
 * @param {Object} fonts - Font objects
 * @param {Object} images - Image objects (logo, qrCode)
 */
function renderBackSide(page, data, fonts, images) {
  const pageWidth = mmToPt(CARD_WIDTH_MM);
  const pageHeight = mmToPt(CARD_HEIGHT_MM);
  const safeOffset = mmToPt(SAFE_AREA_OFFSET_MM);
  const padding = mmToPt(5); // 5mm padding inside safe area
  
  // Background (white)
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: COLORS.white,
  });
  
  // QR Code container: left 8.5mm (3.5mm offset + 5mm padding), 50mm x 50mm
  // Vertically centered
  const qrX = safeOffset + padding;
  const qrSize = mmToPt(50);
  const qrY = (pageHeight - qrSize) / 2; // Vertically centered
  
  if (images.qrCode) {
    page.drawImage(images.qrCode, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize,
    });
  }
  
  // QR Info text: right side, centered vertically with QR code
  const textX = qrX + qrSize + mmToPt(2); // 2mm gap
  // Calculate text position to be vertically centered with QR code
  // QR code center Y is at qrY + qrSize/2
  const qrCenterY = qrY + qrSize / 2;
  const textY = qrCenterY; // Start from QR center, will adjust for text
  
  // Title (Hanken Grotesk Bold, 9pt, black) - two lines
  // Position title so it's above center, accounting for text height
  const titleLine1 = 'Kontaktdaten';
  const titleLine2 = 'scannen';
  const titleSize = 9;
  const titleLineHeight = 11; // Line height for title
  
  // Draw first line of title
  page.drawText(titleLine1, {
    x: textX,
    y: textY + mmToPt(5), // 5mm above center
    size: titleSize,
    color: COLORS.black,
    font: fonts.heading,
  });
  
  // Draw second line of title
  page.drawText(titleLine2, {
    x: textX,
    y: textY + mmToPt(5) - titleLineHeight, // Below first line
    size: titleSize,
    color: COLORS.black,
    font: fonts.heading,
  });
  
  // Description (Source Sans 3, 7pt, medium gray)
  const description = 'Scannen Sie den QR-Code mit Ihrer Kamera-App, um die Kontaktdaten automatisch zu speichern.';
  // Calculate max width: card width - text start position - right margin (safe offset + padding)
  // Minimal safety margin to maximize text box width
  const rightMargin = safeOffset + mmToPt(1); // Minimal 1mm safety margin (reduced padding)
  const maxWidth = pageWidth - textX - rightMargin;
  const fontSize = 8; // Increased from 7pt to 8pt
  const lineHeight = 11; // Adjusted line height for 8pt font
  
  // Simple text wrapping using pdf-lib's widthOfTextAtSize
  const words = description.split(' ');
  const lines = [];
  let currentLine = '';
  
  words.forEach((word) => {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const textWidth = fonts.body.widthOfTextAtSize(testLine, fontSize);
    
    if (textWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  // Draw text lines, starting below title (which is now 2 lines)
  const titleTotalHeight = titleLineHeight * 2; // Two lines of title
  let yPos = textY + mmToPt(5) - titleTotalHeight - 2; // Below title, 2pt spacing
  lines.forEach((line) => {
    page.drawText(line, {
      x: textX,
      y: yPos,
      size: fontSize,
      color: COLORS.mediumGray,
      font: fonts.body,
    });
    yPos -= lineHeight;
  });
}

/**
 * Save contact data to JSON file
 * @param {Object} contactData - Contact data
 * @param {string} outputDir - Output directory
 * @returns {string} Path to saved JSON file
 */
function saveContactData(contactData, outputDir) {
  const jsonPath = join(outputDir, `${contactData.name.replace(/\s+/g, '-')}.json`);
  writeFileSync(jsonPath, JSON.stringify(contactData, null, 2), 'utf8');
  return jsonPath;
}

/**
 * Prompt user for main menu selection
 * @returns {Promise<Object>} Selected action
 */
async function promptMainMenu() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Was möchten Sie tun?',
      choices: [
        { name: 'Neue Visitenkarte generieren', value: 'generate' },
        { name: 'Bestehende Visitenkarte bearbeiten', value: 'edit' },
        { name: 'Mustervisitenkarten generieren', value: 'generate-samples' },
        { name: 'Beenden', value: 'exit' },
      ],
    },
  ]);
  return { action };
}

/**
 * Prompt user to select existing contact
 * @param {string} outputDir - Output directory
 * @returns {Promise<Object|null>} Selected contact data or null
 */
async function promptSelectExistingContact(outputDir) {
  try {
    // Ensure output directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const files = readdirSync(outputDir).filter((file) => file.endsWith('.json'));
    
    if (files.length === 0) {
      warn('Keine bestehenden Kontaktdaten gefunden.');
      return null;
    }

    const { selectedFile } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedFile',
        message: 'Wählen Sie eine bestehende Visitenkarte:',
        choices: files.map((file) => ({
          name: file.replace('.json', ''),
          value: file,
        })),
      },
    ]);

    const filePath = join(outputDir, selectedFile);
    const fileContent = readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch (err) {
    error(`Fehler beim Laden der Kontaktdaten: ${err.message}`);
    return null;
  }
}

/**
 * Prompt user for contact data
 * @param {Object} [existingData] - Optional existing data to pre-fill
 * @returns {Promise<Object>} Contact data
 */
async function promptContactData(existingData = {}) {
  const questions = [
    {
      type: 'input',
      name: 'name',
      message: 'Name:',
      default: existingData.name,
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Name ist erforderlich';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'position',
      message: 'Position:',
      default: existingData.position,
    },
    {
      type: 'input',
      name: 'email',
      message: 'E-Mail:',
      default: existingData.email,
      validate: (input) => {
        if (input && !validateEmail(input)) {
          return 'Ungültige E-Mail-Adresse';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'phone',
      message: 'Telefon:',
      default: existingData.phone,
    },
    {
      type: 'input',
      name: 'mobile',
      message: 'Mobil:',
      default: existingData.mobile,
    },
    {
      type: 'input',
      name: 'address',
      message: 'Straße und Hausnummer:',
      default: existingData.address,
    },
    {
      type: 'input',
      name: 'postalCode',
      message: 'Postleitzahl:',
      default: existingData.postalCode,
    },
    {
      type: 'input',
      name: 'city',
      message: 'Stadt:',
      default: existingData.city,
    },
    {
      type: 'input',
      name: 'country',
      message: 'Land:',
      default: existingData.country || 'Deutschland',
    },
    {
      type: 'input',
      name: 'website',
      message: 'Website:',
      default: existingData.website,
      validate: (input) => {
        if (input && !validateUrl(input)) {
          return 'Ungültige URL';
        }
        return true;
      },
    },
  ];

  const answers = await inquirer.prompt(questions);
  
  // Handle social media (simplified - can be extended)
  let socialMedia = existingData.socialMedia;
  if (!socialMedia) {
    const { hasSocialMedia } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'hasSocialMedia',
        message: 'Möchten Sie Social Media hinzufügen?',
        default: false,
      },
    ]);

    if (hasSocialMedia) {
      const { socialMediaUrl } = await inquirer.prompt([
        {
          type: 'input',
          name: 'socialMediaUrl',
          message: 'Social Media URL:',
        },
      ]);
      if (socialMediaUrl) {
        socialMedia = [{ name: 'LinkedIn', url: socialMediaUrl }];
      }
    }
  }

  return {
    ...answers,
    socialMedia,
  };
}

/**
 * Prompt user for confirmation with preview
 * @param {Object} contactData - Contact data to preview
 * @returns {Promise<boolean>} True if confirmed
 */
async function promptConfirmation(contactData) {
  console.log('\n' + formatContactPreview(contactData) + '\n');
  
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
 * Prompt user if they want to repeat
 * @returns {Promise<boolean>} True if repeat
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
 * Generate business card PDFs using pdf-lib
 * @param {Object} contactData - Contact data
 * @param {string} outputDir - Output directory
 * @returns {Promise<Object>} Paths to generated files
 */
export async function generateBusinessCardWithPdfLib(contactData, outputDir) {
  // Validate data
  const validation = validateContactData(contactData);
  if (!validation.isValid) {
    throw new Error(`Validierungsfehler: ${validation.errors.join(', ')}`);
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
  const qrCodeBuffer = await generateQRCodeBuffer(vCardData);
  cardProgress('QR-Code generiert', 'done');
  
  // Load and convert logo
  const logoPath = join(projectRoot, 'assets', 'logos', 'kieks.me-single-circle.svg');
  cardProgress('Lade Logo …', 'generating');
  const logoPngBuffer = await svgToPng(logoPath, 1000, 1000);
  cardProgress('Logo geladen', 'done');
  
  // Create PDF document
  cardProgress('Erstelle PDF-Dokument …', 'generating');
  const pdfDoc = await PDFDocument.create();
  
  // Load fonts
  const fonts = await loadFonts(pdfDoc);
  
  // Embed images
  const logoImage = await pdfDoc.embedPng(logoPngBuffer);
  const qrCodeImage = await pdfDoc.embedPng(qrCodeBuffer);
  
  const images = {
    logo: logoImage,
    qrCode: qrCodeImage,
  };
  
  // Prepare template data
  const templateData = {
    ...contactData,
    companyName: 'kieks.me GbR',
  };
  
  // Normalize website URL
  if (templateData.website) {
    templateData.website = normalizeUrl(templateData.website);
  }
  
  // Generate front side
  cardProgress('Generiere Vorderseite …', 'generating');
  const frontPage = pdfDoc.addPage([
    mmToPt(CARD_WIDTH_MM),
    mmToPt(CARD_HEIGHT_MM),
  ]);
  renderFrontSide(frontPage, templateData, fonts, images);
  
  const frontOutputPath = join(outputDir, `${contactData.name.replace(/\s+/g, '-')}-front.pdf`);
  const frontPdfBytes = await pdfDoc.save();
  writeFileSync(frontOutputPath, frontPdfBytes);
  cardProgress(`Vorderseite gespeichert: ${frontOutputPath}`, 'done');
  
  // Generate back side (separate PDF)
  cardProgress('Generiere Rückseite …', 'generating');
  const backPdfDoc = await PDFDocument.create();
  const backFonts = await loadFonts(backPdfDoc);
  const backQrCodeImage = await backPdfDoc.embedPng(qrCodeBuffer);
  
  const backPage = backPdfDoc.addPage([
    mmToPt(CARD_WIDTH_MM),
    mmToPt(CARD_HEIGHT_MM),
  ]);
  renderBackSide(backPage, templateData, backFonts, {
    logo: null,
    qrCode: backQrCodeImage,
  });
  
  const backOutputPath = join(outputDir, `${contactData.name.replace(/\s+/g, '-')}-back.pdf`);
  const backPdfBytes = await backPdfDoc.save();
  writeFileSync(backOutputPath, backPdfBytes);
  cardProgress(`Rückseite gespeichert: ${backOutputPath}`, 'done');
  
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
 * Main CLI function
 */
async function main() {
  try {
    header('Business Card Generator (pdf-lib)', 'Generiere Visitenkarten mit pdf-lib', 'bgCyan');

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
        // Import sample contacts from shared module
        const { sampleContacts } = await import('./sample-data.mjs');

        const outputDir = join(projectRoot, 'examples', 'sample-business-cards');
        
        info(`Generiere ${sampleContacts.length} Mustervisitenkarten...`);

        for (let i = 0; i < sampleContacts.length; i++) {
          const contact = sampleContacts[i];
          info(`\nGeneriere Visitenkarte ${i + 1}/${sampleContacts.length}: ${contact.name}`);
          
          const result = await generateBusinessCardWithPdfLib(contact, outputDir);
          success(`✓ ✓ ${contact.name} - Vorder- und Rückseite generiert`);
        }

        success(`Alle ${sampleContacts.length} Mustervisitenkarten erfolgreich generiert!`);
        info(`Ausgabe-Verzeichnis: ${outputDir}`);
        shouldContinue = false;
        break;
      }

      if (action === 'edit') {
        // Determine output directory
        const outputDir = join(projectRoot, CARD_CONFIG.outputDir);
        
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
          const result = await generateBusinessCardWithPdfLib(contactData, outputDir);

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
        const outputDir = join(projectRoot, CARD_CONFIG.outputDir);
        
        // Generate business cards
        try {
          const result = await generateBusinessCardWithPdfLib(contactData, outputDir);

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
    error(`Unerwarteter Fehler: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

// Run CLI if script is executed directly
// Use the same pattern as generate-card.mjs
const currentFile = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && (
  currentFile === process.argv[1] || 
  currentFile.endsWith(process.argv[1]) ||
  process.argv[1].endsWith('generate-card.mjs')
);

if (isMainModule) {
  main().catch((err) => {
    error(`Fehler: ${err.message}`);
    console.error(err);
    process.exit(1);
  });
}
