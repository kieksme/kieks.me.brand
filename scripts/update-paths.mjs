#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Create directories
mkdirSync(join(projectRoot, 'app', 'fundamentals'), { recursive: true });
mkdirSync(join(projectRoot, 'app', 'implementations'), { recursive: true });

// Files to copy and update
const filesToMove = [
  { src: 'app/logos.html', dst: 'app/fundamentals/logos.html', urlPath: 'fundamentals/logos.html' },
  { src: 'app/colors.html', dst: 'app/fundamentals/colors.html', urlPath: 'fundamentals/colors.html' },
  { src: 'app/fonts.html', dst: 'app/fundamentals/fonts.html', urlPath: 'fundamentals/fonts.html' },
];

for (const { src, dst, urlPath } of filesToMove) {
  const srcPath = join(projectRoot, src);
  const dstPath = join(projectRoot, dst);
  
  let content = readFileSync(srcPath, 'utf-8');
  
  // Update relative paths
  content = content.replace(/href="favicon\.svg"/g, 'href="../favicon.svg"');
  content = content.replace(/href="manifest\.json"/g, 'href="../manifest.json"');
  content = content.replace(/href="styles\.css"/g, 'href="../styles.css"');
  content = content.replace(/href="impressum\.html"/g, 'href="../impressum.html"');
  content = content.replace(/href="index\.html"/g, 'href="../index.html"');
  
  // Update OpenGraph URLs
  const oldUrl = src.replace('app/', '').replace('.html', '');
  content = content.replace(
    new RegExp(`https://kieksme\\.github\\.io/kieks\\.me\\.cicd/${oldUrl}\\.html`, 'g'),
    `https://brand.kieks.me/${urlPath}`
  );
  
  // Update canonical URLs
  content = content.replace(
    new RegExp(`https://kieksme\\.github\\.io/kieks\\.me\\.cicd/${oldUrl}\\.html`, 'g'),
    `https://brand.kieks.me/${urlPath}`
  );
  
  // Update JSON-LD URLs
  content = content.replace(
    new RegExp(`"url":\\s*"https://kieksme\\.github\\.io/kieks\\.me\\.cicd/${oldUrl}\\.html"`, 'g'),
    `"url": "https://brand.kieks.me/${urlPath}"`
  );
  
  // Update navigation - replace old flat navigation with hierarchical
  const navPattern = /<div class="hidden md:flex items-center space-x-6">([\s\S]*?)<\/div>/;
  const mobileNavPattern = /<div class="nav-menu md:hidden" id="mobile-menu">([\s\S]*?)<\/div>/;
  
  const newNav = `<div class="hidden md:flex items-center space-x-6">
                    <a href="../index.html" class="nav-link font-body">Home</a>
                    <div class="relative group">
                        <a href="index.html" class="nav-link font-body">Fundamentals</a>
                        <div class="absolute left-0 mt-2 w-48 bg-navy rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                            <div class="py-2">
                                <a href="index.html" class="block px-4 py-2 text-sm hover:bg-navy-medium">Overview</a>
                                <a href="logos.html" class="block px-4 py-2 text-sm hover:bg-navy-medium">Logos</a>
                                <a href="colors.html" class="block px-4 py-2 text-sm hover:bg-navy-medium">Colors</a>
                                <a href="fonts.html" class="block px-4 py-2 text-sm hover:bg-navy-medium">Fonts</a>
                            </div>
                        </div>
                    </div>
                    <div class="relative group">
                        <a href="../implementations/index.html" class="nav-link font-body">Implementations</a>
                        <div class="absolute left-0 mt-2 w-48 bg-navy rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                            <div class="py-2">
                                <a href="../implementations/index.html" class="block px-4 py-2 text-sm hover:bg-navy-medium">Overview</a>
                                <a href="../implementations/business-cards.html" class="block px-4 py-2 text-sm hover:bg-navy-medium">Business Cards</a>
                            </div>
                        </div>
                    </div>
                    <a href="../impressum.html" class="nav-link font-body">Impressum</a>
                </div>`;
  
  const activeClass = urlPath.includes('logos') ? 'active' : '';
  const newNavWithActive = newNav.replace(
    '<a href="logos.html" class="block px-4 py-2 text-sm hover:bg-navy-medium">Logos</a>',
    `<a href="logos.html" class="block px-4 py-2 text-sm hover:bg-navy-medium ${activeClass}">Logos</a>`
  );
  
  content = content.replace(navPattern, newNavWithActive);
  
  const newMobileNav = `<div class="nav-menu md:hidden" id="mobile-menu">
                <a href="../index.html" class="nav-link font-body block py-2">Home</a>
                <div class="pl-4">
                    <div class="font-body font-semibold text-aqua py-2">Fundamentals</div>
                    <a href="index.html" class="nav-link font-body block py-2 pl-4">Overview</a>
                    <a href="logos.html" class="nav-link ${urlPath.includes('logos') ? 'active' : ''} font-body block py-2 pl-4">Logos</a>
                    <a href="colors.html" class="nav-link ${urlPath.includes('colors') ? 'active' : ''} font-body block py-2 pl-4">Colors</a>
                    <a href="fonts.html" class="nav-link ${urlPath.includes('fonts') ? 'active' : ''} font-body block py-2 pl-4">Fonts</a>
                </div>
                <div class="pl-4">
                    <div class="font-body font-semibold text-aqua py-2">Implementations</div>
                    <a href="../implementations/index.html" class="nav-link font-body block py-2 pl-4">Overview</a>
                    <a href="../implementations/business-cards.html" class="nav-link font-body block py-2 pl-4">Business Cards</a>
                </div>
                <a href="../impressum.html" class="nav-link font-body block py-2">Impressum</a>
            </div>`;
  
  content = content.replace(mobileNavPattern, newMobileNav);
  
  // Update footer links
  content = content.replace(/href="impressum\.html"/g, 'href="../impressum.html"');
  
  writeFileSync(dstPath, content, 'utf-8');
  console.log(`Created ${dst}`);
}

console.log('All files copied and updated!');
