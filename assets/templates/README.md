# Business Card Templates

This directory contains HTML/CSS templates for generating business cards.

## Files

- `business-card-front.html` - Front side template with contact information
- `business-card-back.html` - Back side template with QR code
- `business-card-styles.css` - Stylesheet for business cards

## Template Syntax

The templates use a simple template engine with the following syntax:

### Variables

Replace `{{variableName}}` with actual values:

```html
<div class="name">{{name}}</div>
```

### Conditionals

Use `{{#if variable}}...{{/if}}` to conditionally render content:

```html
{{#if email}}
<div class="contact-item">{{email}}</div>
{{/if}}
```

## Available Variables

- `name` - Full name (required)
- `position` - Job title/position
- `email` - Email address
- `phone` - Phone number
- `mobile` - Mobile number
- `address` - Street address
- `postalCode` - Postal code
- `city` - City
- `country` - Country
- `website` - Website URL
- `socialMedia` - Social media information
- `logoPath` - Logo image (base64 data URI)
- `qrCodeDataUri` - QR code image (base64 data URI)

## Card Dimensions

**Print Specifications:**
- Final size: **85mm x 55mm** (landscape format)
- PDF size with bleed: **89mm x 59mm** (includes 2mm bleed on all sides)
- Safe area: **82mm x 52mm** (content must be 1.5mm from edge)
- Resolution: Minimum 300 DPI
- Color mode: CMYK with "PSO Uncoated ISO12647 (Fogra 47L)" profile
- Page order: Front = Page 1, Back = Page 2

## Brand Guidelines

The templates follow kieks.me brand guidelines:
- Colors from `assets/colors/colors.json`
- Typography: Hanken Grotesk (headings), Source Sans 3 (body)
- Logo: kieks.me horizontal aqua dark variant

## Dependencies

The business card generator requires the following dependencies:

### Node.js Dependencies
- `puppeteer` - For PDF generation from HTML
- `qrcode` - For QR code generation
- `inquirer` - For interactive CLI prompts

### External Tools
- **Ghostscript** (optional but recommended) - For converting fonts to paths in PDFs
  - Installation:
    - macOS: `brew install ghostscript`
    - Linux: `sudo apt-get install ghostscript` or `sudo yum install ghostscript`
    - Windows: Download from [Ghostscript website](https://www.ghostscript.com/download/gsdnld.html)
  - The generator will automatically detect Ghostscript and convert fonts to paths if available
  - If Ghostscript is not installed, a warning will be displayed but PDFs will still be generated

## Print Requirements

When preparing business cards for printing, ensure:
- All fonts are converted to paths (automatic if Ghostscript is installed)
- Backgrounds and images extend to the bleed area (2mm on all sides)
- Content is within the safe area (1.5mm from edge)
- No crop marks or trim frames are included
- CMYK color mode with "PSO Uncoated ISO12647 (Fogra 47L)" profile
- Minimum 300 DPI resolution

## Usage

Templates are used by the business card generator (`scripts/generate-card.mjs`). Do not edit templates directly unless you understand the template engine implementation.
