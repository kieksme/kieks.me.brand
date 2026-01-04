# Brand Fonts

This directory contains the official kieks.me GbR brand fonts and typography assets.

**Note**: Assets are distributed as ZIP archives only. Individual font files are not available for download. Download the complete font assets as part of the [latest release ZIP](https://github.com/kieksme/kieks.me.cicd/releases).

## Directory Structure

```plaintext
assets/fonts/
├── README.md           # This file
├── [font-family]/      # Font family directories (e.g., "inter", "roboto")
│   ├── [weight]/       # Font weight directories (e.g., "400", "700")
│   │   ├── [style]/    # Font style files (e.g., "regular.woff2", "italic.woff2")
│   │   └── ...
│   └── ...
└── fonts.css           # CSS @font-face declarations (to be created)
```

### Primary Brand Font (Hausschrift)

**Hanken Grotesk** is the official brand font (Hausschrift) for kieks.me GbR.

- **Font Family**: Hanken Grotesk
- **Usage**: Headings, UI elements, and brand-specific typography
- **Style**: Sans-serif
- **Source**: [Google Fonts](https://fonts.google.com/specimen/Hanken+Grotesk)

### Body Text Font (Fließtext)

**Source Sans 3** is used for body text and long-form content.

- **Font Family**: Source Sans 3
- **Usage**: Body text, paragraphs, and readable content
- **Style**: Sans-serif
- **Source**: [Google Fonts](https://fonts.google.com/specimen/Source+Sans+3)

### Font Organization

Fonts should be organized by:

1. **Font Family** - Each font family gets its own directory
2. **Font Weight** - Subdirectories for different weights (100, 200, 300, 400, 500, 600, 700, 800, 900)
3. **Font Style** - Individual font files for regular, italic, etc.

### Example Structure

```plaintext
assets/fonts/
├── hanken-grotesk/
│   ├── 400/
│   │   ├── regular.woff2
│   │   └── italic.woff2
│   ├── 500/
│   │   └── regular.woff2
│   └── 700/
│       └── regular.woff2
└── source-sans-3/
    ├── 400/
    │   ├── regular.woff2
    │   └── italic.woff2
    └── 600/
        └── regular.woff2
```

## Supported Font Formats

For optimal browser support, fonts should be provided in the following formats (in order of preference):

1. **WOFF2** - Modern, compressed format with best compression (recommended)
2. **WOFF** - Fallback for older browsers
3. **TTF/OTF** - Source formats (can be converted to web formats)

## Usage

### For Developers

**CSS Example** (using fonts.css):

```css
@import './fonts.css';

body {
  font-family: var(--font-body), sans-serif; /* Source Sans 3 */
  font-weight: 400;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-primary), sans-serif; /* Hanken Grotesk */
}
```

**Direct @font-face Declaration**:

```css
/* Primary Brand Font - Hanken Grotesk */
@font-face {
  font-family: 'Hanken Grotesk';
  src: url('./hanken-grotesk/400/regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Hanken Grotesk';
  src: url('./hanken-grotesk/400/italic.woff2') format('woff2');
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}

/* Body Text Font - Source Sans 3 */
@font-face {
  font-family: 'Source Sans 3';
  src: url('./source-sans-3/400/regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Source Sans 3';
  src: url('./source-sans-3/400/italic.woff2') format('woff2');
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}
```

**JavaScript/TypeScript Example**:

```javascript
// Load fonts dynamically
const hankenGrotesk = new FontFace('Hanken Grotesk', 'url(./hanken-grotesk/400/regular.woff2)');
const sourceSans3 = new FontFace('Source Sans 3', 'url(./source-sans-3/400/regular.woff2)');

await Promise.all([hankenGrotesk.load(), sourceSans3.load()]);
document.fonts.add(hankenGrotesk);
document.fonts.add(sourceSans3);
```

### For Designers

- Use font files from this directory in design applications
- Ensure font licensing allows web usage
- Refer to Typography Guidelines for font pairing and usage recommendations

## Font Specifications

Brand fonts should be documented with:

- **Font Family Name** - Official name of the font
- **Font Weights** - Available weights (100-900)
- **Font Styles** - Available styles (regular, italic, etc.)
- **File Formats** - Available formats (WOFF2, WOFF, TTF, OTF)
- **License** - Font license information
- **Source** - Where the font was obtained (Google Fonts, Adobe Fonts, custom, etc.)

## Font Usage Guidelines

- **Primary Font (Hanken Grotesk)** - Brand font for headings, UI elements, and brand-specific typography
- **Body Text Font (Source Sans 3)** - Main font for body text, paragraphs, and readable content
- **Monospace Font** - For code blocks and technical content (to be defined)
- **Accessibility** - Ensure fonts meet readability requirements (minimum 16px for body text)

## Adding New Fonts

When adding new fonts to the brand assets:

1. Create a directory structure: `[font-family]/[weight]/[style].woff2`
2. Add font files in WOFF2 format (preferred) or other web formats
3. Update `fonts.css` with @font-face declarations
4. Document the font family, weights, and styles in this README
5. Ensure proper licensing for web usage
6. Test font loading and fallbacks
7. Update Typography Guidelines documentation

### Font File Naming Convention

- Use lowercase with hyphens: `font-family-weight-style.woff2`
- Examples:
  - `hanken-grotesk-400-regular.woff2`
  - `hanken-grotesk-400-italic.woff2`
  - `hanken-grotesk-700-regular.woff2`
  - `source-sans-3-400-regular.woff2`
  - `source-sans-3-400-italic.woff2`
  - `source-sans-3-600-regular.woff2`

## Performance Considerations

- **Preload critical fonts**: Use `<link rel="preload">` for above-the-fold fonts
- **Font-display**: Use `font-display: swap` to prevent invisible text during font load
- **Subset fonts**: Only include characters needed for your language/locale
- **Limit font families**: Use 2-3 font families maximum to reduce page weight

## Browser Support

- **WOFF2**: Supported in all modern browsers (Chrome 36+, Firefox 39+, Safari 10+, Edge 14+)
- **WOFF**: Fallback for older browsers (IE 9+, Chrome 5+, Firefox 3.6+)
- **TTF/OTF**: Fallback for very old browsers (not recommended for production)

---

*For detailed typography guidelines, see [TYPOGRAPHY.md](../guidelines/TYPOGRAPHY.md)*
