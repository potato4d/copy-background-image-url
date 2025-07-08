const { test, expect } = require('@playwright/test');
const path = require('path');

test('background image detection logic integration test', async ({ page }) => {
  // Load the test HTML page
  const htmlPath = path.join(__dirname, '..', 'testing', 'data', 'page.html');
  await page.goto(`file://${htmlPath}`);
  
  // Inject the actual logic from the built extension
  await page.addScriptTag({
    path: path.join(__dirname, '..', 'dist', 'logic', 'background-image-detector.js')
  });
  
  // Get the page dimensions to calculate center
  const pageWidth = await page.evaluate(() => window.innerWidth);
  const horizontalCenter = pageWidth / 2;
  const yCoordinate = 40;
  
  // Test the background image detection at the specified coordinates
  const result = await page.evaluate(({ x, y }) => {
    // Use the actual logic from the extension
    return window.findBackgroundImageAtCoordinates(x, y);
  }, { x: horizontalCenter, y: yCoordinate });
  
  console.log('Test result:', JSON.stringify(result, null, 2));
  
  // Assert the expected result
  expect(result.success).toBe(true);
  expect(result.url).toBe('https://place-hold.it/1600x900/#ccc/#111');
  
  // Verify debug info is populated
  expect(result.debugInfo).toBeDefined();
  expect(result.debugInfo.coordinates).toEqual({ x: horizontalCenter, y: yCoordinate });
  expect(result.debugInfo.elementsFound).toBeGreaterThan(0);
});

test('background image detection with no background image', async ({ page }) => {
  // Create a simple page with no background images
  await page.setContent(`
    <html>
      <body>
        <div style="width: 100%; height: 100px; background-color: red;">
          <p>No background image here</p>
        </div>
      </body>
    </html>
  `);
  
  // Inject the actual logic from the built extension
  await page.addScriptTag({
    path: path.join(__dirname, '..', 'dist', 'logic', 'background-image-detector.js')
  });
  
  // Test at center of the div
  const result = await page.evaluate(() => {
    return window.findBackgroundImageAtCoordinates(50, 50);
  });
  
  console.log('No background image test result:', JSON.stringify(result, null, 2));
  
  // Assert the expected result
  expect(result.success).toBe(false);
  expect(result.error).toBe('No background image found at coordinates');
  expect(result.debugInfo).toBeDefined();
});

test('background image detection error handling', async ({ page }) => {
  // Create a page and inject faulty logic to test error handling
  await page.setContent(`
    <html>
      <body>
        <div>Test content</div>
      </body>
    </html>
  `);
  
  // Inject the actual logic from the built extension
  await page.addScriptTag({
    path: path.join(__dirname, '..', 'dist', 'logic', 'background-image-detector.js')
  });
  
  // Test error handling by calling with invalid coordinates
  const result = await page.evaluate(() => {
    // Mock the window.getComputedStyle to throw an error
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = () => {
      throw new Error('Mock error for testing');
    };
    
    try {
      return window.findBackgroundImageAtCoordinates(0, 0);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });
  
  console.log('Error handling test result:', JSON.stringify(result, null, 2));
  
  // Assert error is properly handled
  expect(result.success).toBe(false);
  expect(result.error).toContain('Error detecting background image');
});