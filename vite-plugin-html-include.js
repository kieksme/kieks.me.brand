import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Vite plugin to process HTML includes
 * Replaces <!-- include: navigation --> with navigation component
 * and adjusts relative paths based on file depth
 */
export function htmlInclude() {
  const navigationPath = resolve(__dirname, 'app/components/navigation.html');
  
  if (!existsSync(navigationPath)) {
    throw new Error(`Navigation component not found at ${navigationPath}`);
  }

  const navigationTemplate = readFileSync(navigationPath, 'utf-8');

  return {
    name: 'html-include',
    enforce: 'pre',
    transformIndexHtml(html, context) {
      // Only process if navigation include is present
      if (!html.includes('<!-- include: navigation -->')) {
        return html;
      }

      // Get the file path - try different context properties
      const filePath = context.filename || context.path || '';
      const appDir = resolve(__dirname, 'app');
      
      // Normalize path and get relative path
      let relativePath = '';
      if (filePath) {
        try {
          relativePath = relative(appDir, filePath);
        } catch (e) {
          // If path is not relative to appDir, try to extract from filename
          const match = filePath.match(/app[\\/](.+)$/);
          if (match) {
            relativePath = match[1];
          }
        }
      }
      
      // Fallback: try to determine from HTML content or use empty string
      if (!relativePath) {
        // Try to infer from HTML content (e.g., manifest.json path)
        const manifestMatch = html.match(/href=["']([^"']*manifest\.json)["']/);
        if (manifestMatch) {
          const manifestPath = manifestMatch[1];
          if (manifestPath === 'manifest.json') {
            relativePath = 'index.html';
          } else if (manifestPath === '../manifest.json') {
            relativePath = 'fundamentals/index.html';
          } else if (manifestPath.includes('../')) {
            // Count ../ to determine depth
            const depth = (manifestPath.match(/\.\.\//g) || []).length;
            if (depth === 1) {
              relativePath = 'fundamentals/index.html'; // or implementations
            }
          }
        }
      }
      
      // Calculate base path (how many ../ needed)
      // For index.html at root: depth = 0, basePath = ''
      // For fundamentals/index.html: depth = 1, basePath = '../'
      // For implementations/avatars.html: depth = 1, basePath = '../'
      const depth = relativePath ? relativePath.split(/[\\/]/).length - 1 : 0;
      const basePath = depth > 0 ? '../'.repeat(depth) : '';
      
      // Determine active page based on file path
      const activeStates = determineActiveStates(relativePath || 'index.html');
      
      // Replace placeholders in navigation template
      let navigation = navigationTemplate;
      navigation = navigation.replace(/\{\{basePath\}\}/g, basePath);
      
      // Replace active state placeholders
      Object.entries(activeStates).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        navigation = navigation.replace(new RegExp(escapedPlaceholder, 'g'), value ? 'active' : '');
      });
      
      // Replace the include comment with processed navigation
      html = html.replace('<!-- include: navigation -->', navigation);
      
      return html;
    }
  };
}

/**
 * Determine which navigation items should be active based on file path
 */
function determineActiveStates(filePath) {
  const states = {
    activeHome: false,
    activeFundamentals: false,
    activeLogos: false,
    activeColors: false,
    activeFonts: false,
    activeImplementations: false,
    activeBusinessCards: false,
    activeWebApplications: false,
    activeEmailFooter: false,
    activeAvatars: false,
    activeImpressum: false
  };

  // Normalize path
  const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
  
  // Check for home page (only root index.html, not subdirectory index.html)
  if (normalizedPath === 'index.html') {
    states.activeHome = true;
    return states;
  }
  
  // Check for impressum
  if (normalizedPath.includes('impressum.html')) {
    states.activeImpressum = true;
    return states;
  }
  
  // Check for fundamentals
  if (normalizedPath.includes('fundamentals/')) {
    states.activeFundamentals = true;
    
    if (normalizedPath.includes('logos.html')) {
      states.activeLogos = true;
    } else if (normalizedPath.includes('colors.html')) {
      states.activeColors = true;
    } else if (normalizedPath.includes('fonts.html')) {
      states.activeFonts = true;
    }
    
    return states;
  }
  
  // Check for implementations
  if (normalizedPath.includes('implementations/')) {
    states.activeImplementations = true;
    
    if (normalizedPath.includes('business-cards.html')) {
      states.activeBusinessCards = true;
    } else if (normalizedPath.includes('web-applications.html')) {
      states.activeWebApplications = true;
    } else if (normalizedPath.includes('email-footer.html')) {
      states.activeEmailFooter = true;
    } else if (normalizedPath.includes('avatars.html')) {
      states.activeAvatars = true;
    }
    
    return states;
  }
  
  return states;
}
