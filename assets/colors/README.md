# Brand Colors

This directory contains the official kieks.me GbR brand color palette, including developer files and visual swatches.

## Available Files

### Developer Files

- **colors.css** - CSS variables for web projects
- **colors.json** - JSON format with HEX, RGB, and CMYK values for JavaScript/TypeScript projects

### Visual Swatches

- **swatches/** - SVG color swatches for visual reference

## Primary Brand Colors

### Selection Colors

| Color                           | Hex       | RGB                | Description                           |
|---------------------------------|-----------|--------------------|---------------------------------------|
| ![Aqua](swatches/aqua.svg) Aqua          | `#00FFDC` | `rgb(0, 255, 220)` | Bright turquoise/aqua selection color |
| ![Navy](swatches/navy.svg) Navy          | `#1E2A45` | `rgb(30, 42, 69)`  | Dark blue/navy selection color        |
| ![Fuchsia](swatches/fuchsia.svg) Fuchsia | `#FF008F` | `rgb(255, 0, 143)` | Vibrant pink/fuchsia selection color  |

### Text Colors

| Color                                 | Hex       | RGB                  | Usage                          |
|---------------------------------------|-----------|----------------------|--------------------------------|
| ![White](swatches/white.svg) White             | `#FFFFFF` | `rgb(255, 255, 255)` | Text color on white background |
| ![Dark Gray](swatches/dark-gray.svg) Dark Gray | `#333333` | `rgb(51, 51, 51)`    | Text color on white background |

## Usage

### For Developers

**CSS Example**:

```css
@import './colors.css';

.button {
  background-color: var(--color-primary);
  color: var(--color-secondary);
}
```

**JavaScript/TypeScript Example**:

```javascript
import colors from './colors.json';

const primaryColor = colors.primary.hex;
```

### For Designers

- Use the SVG swatches in `swatches/` directory for visual reference
- Import `.ase` (Adobe Swatch Exchange) files into Adobe Creative Cloud applications when available
- Refer to the Color Palette Guidelines for complete specifications

## Color Specifications

Brand colors should be documented with:

- **Hex values** - For digital/web use
- **RGB values** - For digital displays
- **CMYK values** - For print materials (to be added)
- **Pantone codes** - For professional printing (to be added)

## Color Usage

- **Primary colors** - Main brand colors for major elements (Selection colors)
- **Text colors** - Colors for text on white backgrounds
- **Accessibility** - Ensure color combinations meet WCAG contrast requirements

## Adding New Colors

When adding new colors to the palette:

1. Update the color definition files (CSS, JSON)
2. Add SVG swatch to `swatches/` directory
3. Ensure the color meets accessibility contrast requirements
4. Update the Color Palette Guidelines documentation
5. Generate new palette reference images if needed

**Note**: SCSS files are no longer maintained. Use CSS variables or JSON for your projects.

---

*For detailed color usage guidelines, see [COLOR_PALETTE.md](../guidelines/COLOR_PALETTE.md)*
