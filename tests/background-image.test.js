const { test, expect } = require('@playwright/test');
const path = require('path');

test('should find background image behind overlapping elements', async ({ page }) => {
  // Load the test HTML page
  const htmlPath = path.join(__dirname, '..', 'testing', 'data', 'page.html');
  await page.goto(`file://${htmlPath}`);
  
  // Inject the actual logic from the built extension
  await page.addScriptTag({
    path: path.join(__dirname, '..', 'dist', 'logic', 'background-image-detector.js')
  });
  
  // Make sure the function is available globally
  await page.evaluate(() => {
    // Since it's a CommonJS module, we need to access it through exports
    if (typeof exports !== 'undefined' && exports.findBackgroundImageAtCoordinates) {
      window.findBackgroundImageAtCoordinates = exports.findBackgroundImageAtCoordinates;
      // Call it once to trigger the internal global assignment
      try {
        window.findBackgroundImageAtCoordinates(0, 0);
      } catch (e) {
        // Expected to fail, but this makes it globally available
      }
    }
  });
  
  // Get the page dimensions to calculate center
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const horizontalCenter = pageWidth / 2;
  const yCoordinate = 40;
  
  // Test the background image detection at the specified coordinates
  const result = await page.evaluate(({ x, y }) => {
    return window.findBackgroundImageAtCoordinates(x, y);
  }, { x: horizontalCenter, y: yCoordinate });
  
  console.log('Background image test result:', JSON.stringify(result, null, 2));
  
  // Assert the expected result
  expect(result.success).toBe(true);
  expect(result.url).toBe('https://place-hold.it/1600x900/#ccc/#111');
  
  // Also test by clicking at the coordinates and logging what we find
  await page.click(`body`, { position: { x: horizontalCenter, y: yCoordinate } });
  
  // Get additional debug information
  const debugInfo = await page.evaluate(({ x, y }) => {
    const elements = document.elementsFromPoint(x, y);
    const info = {
      elementsCount: elements.length,
      elements: elements.map(el => ({
        tagName: el.tagName,
        className: el.className,
        style: {
          backgroundImage: window.getComputedStyle(el).backgroundImage,
          zIndex: window.getComputedStyle(el).zIndex,
          position: window.getComputedStyle(el).position
        }
      }))
    };
    return info;
  }, { x: horizontalCenter, y: yCoordinate });
  
  console.log('Debug info:', JSON.stringify(debugInfo, null, 2));
});