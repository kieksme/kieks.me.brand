# Typography Guidelines

## Type System

Typography is a key component of our visual identity. Consistent use of typefaces helps maintain brand recognition and readability.

## Primary Typeface

### Heading Font

**Hanken Grotesk** is the primary typeface for all headings and headlines.

```
Font Family: Hanken Grotesk
Weights Available: Light (300), Regular (400), Medium (500), Bold (700)
License: [License type]
```

**Usage**: Headlines, page titles, major headings

**Character Set**: Latin, Extended Latin

### Body Font

*[To be defined: Your body text font]*

```plaintext
Font Family: [Body Font Name]
Weights Available: Regular (400), Medium (500), Bold (700)
License: [License type]
```

**Usage**: Body text, paragraphs, descriptions

**Character Set**: Latin, Extended Latin

## Type Scale

### Desktop/Web

```plaintext
H1: 48px / 3rem (Bold)
H2: 40px / 2.5rem (Bold)
H3: 32px / 2rem (Medium)
H4: 24px / 1.5rem (Medium)
H5: 20px / 1.25rem (Medium)
H6: 16px / 1rem (Medium)

Body Large: 18px / 1.125rem (Regular)
Body: 16px / 1rem (Regular)
Body Small: 14px / 0.875rem (Regular)
Caption: 12px / 0.75rem (Regular)
```

### Mobile

```plaintext
H1: 36px / 2.25rem (Bold)
H2: 32px / 2rem (Bold)
H3: 28px / 1.75rem (Medium)
H4: 20px / 1.25rem (Medium)
H5: 18px / 1.125rem (Medium)
H6: 16px / 1rem (Medium)

Body: 16px / 1rem (Regular)
Body Small: 14px / 0.875rem (Regular)
Caption: 12px / 0.75rem (Regular)
```

## Line Height

```plaintext
Headings: 1.2 - 1.3
Body Text: 1.5 - 1.6
Captions: 1.4
```

## Letter Spacing

```plaintext
Headings: -0.02em to 0em
Body Text: 0em (normal)
All Caps: 0.05em - 0.1em
```

## Fallback Fonts

### Web Fallback Stack

**Headings**:

```css
font-family: 'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 
             'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
```

**Body**:

```css
font-family: '[Body Font]', -apple-system, BlinkMacSystemFont, 
             'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
```

## Usage Guidelines

### Headings

- Use heading hierarchy (H1 → H2 → H3, etc.) semantically
- H1 should appear once per page/document
- Don't skip heading levels
- Use bold weight for primary headings
- Keep headings concise and clear

### Body Text

- Use 16px as the base font size for readability
- Maintain comfortable line length (45-75 characters per line)
- Use proper line height for readability (1.5-1.6)
- Align text left for better readability (avoid justified text in digital)

### Emphasis

- **Bold**: Use for strong emphasis
- *Italic*: Use for subtle emphasis or citations
- Avoid underlining except for links
- Don't use all caps for large blocks of text

### Lists

- Use bulleted lists for unordered information
- Use numbered lists for sequential steps or rankings
- Maintain consistent spacing between list items

## Special Typography

### Quotes

```
"Use proper quotation marks"
— Attribution (if applicable)
```

### Code

```
Use monospace font for code snippets
Font: Monaco, 'Courier New', monospace
```

## Accessibility

- Minimum font size: 16px for body text
- Ensure sufficient color contrast (see Color Palette)
- Use relative units (rem, em) for better scaling
- Test readability with screen readers
- Maintain clear visual hierarchy

## Print Typography

### Print Adjustments

- Increase body text to 10-12pt
- Adjust line height to 1.4-1.5 for better print readability
- Use CMYK color values (see Color Palette)
- Embed fonts when sharing PDFs

## Web Font Loading

- Use `font-display: swap` for better performance
- Subset fonts to include only necessary characters
- Self-host fonts when possible for better control
- Provide fallbacks for older browsers

## Font Files

Font files are located in:

- `assets/fonts/` - Font files in various formats (.woff, .woff2, .ttf, .otf)
- Include license information for each font
