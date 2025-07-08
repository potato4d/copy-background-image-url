# Copy Background Image URL Chrome Extension

A Chrome extension that adds a context menu option to copy background image URLs when right-clicking on elements.

## Features

- Right-click context menu integration
- Detects background images on clicked elements and their parent elements
- Automatically copies the background image URL to clipboard
- TypeScript implementation with proper type safety

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run build`
4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select this directory

## Usage

1. Right-click on any element with a background image
2. Select "Copy background image URL" from the context menu
3. The background image URL will be copied to your clipboard

## Development

- `npm run build` - Build the extension for production (CommonJS)
- `npm run build:dev` - Build for development/testing (ES2020 modules)
- `npm run watch` - Watch for changes and rebuild automatically
- `npm run clean` - Clean the dist directory
- `npm test` - Run logic tests
- `npm run test:playwright` - Run Playwright tests (requires browser dependencies)

## File Structure

- `src/background.ts` - Service worker handling context menu and clipboard operations
- `src/content.ts` - Content script for detecting background images
- `manifest.json` - Chrome extension manifest
- `tsconfig.json` - TypeScript configuration