const { test, expect } = require('@playwright/test');
const path = require('path');

test('should find background image behind overlapping elements', async ({ page }) => {
  // Load the test HTML page
  const htmlPath = path.join(__dirname, '..', 'testing', 'data', 'page.html');
  await page.goto(`file://${htmlPath}`);
  
  // Inject the background image finder logic
  const finderScript = await page.evaluate(() => {
    // Logic to find background images behind other elements
    function findBackgroundImageAtCoordinates(x, y) {
      // Get all elements at the coordinates
      const elements = document.elementsFromPoint(x, y);
      
      // Helper function to extract background image URL
      function getBackgroundImageUrl(element) {
        const style = window.getComputedStyle(element);
        const backgroundImage = style.backgroundImage;
        
        if (backgroundImage && backgroundImage !== 'none') {
          const urlMatch = backgroundImage.match(/url\\(['"]?(.*?)['"]?\\)/);
          if (urlMatch && urlMatch[1]) {
            return urlMatch[1];
          }
        }
        
        return null;
      }
      
      // Strategy 1: Check all elements at coordinates for background images
      for (const element of elements) {
        const bgUrl = getBackgroundImageUrl(element);
        if (bgUrl) {
          return bgUrl;
        }
      }
      
      // Strategy 2: Temporarily hide overlapping elements to check what's behind
      const originalStyles = [];
      const elementsToHide = elements.slice(0, -1); // Don't hide the deepest element
      
      // Hide elements one by one and check for background images
      for (let i = 0; i < elementsToHide.length; i++) {
        const element = elementsToHide[i];
        originalStyles.push({
          element: element,
          pointerEvents: element.style.pointerEvents
        });
        element.style.pointerEvents = 'none';
        
        const elementBehind = document.elementFromPoint(x, y);
        if (elementBehind) {
          const bgUrl = getBackgroundImageUrl(elementBehind);
          if (bgUrl) {
            // Restore styles before returning
            originalStyles.forEach(({ element, pointerEvents }) => {
              element.style.pointerEvents = pointerEvents;
            });
            return bgUrl;
          }
        }
      }
      
      // Restore all styles
      originalStyles.forEach(({ element, pointerEvents }) => {
        element.style.pointerEvents = pointerEvents;
      });
      
      // Strategy 3: Traverse up the DOM tree from all elements
      for (const element of elements) {
        let current = element;
        while (current && current !== document.body && current !== document.documentElement) {
          const bgUrl = getBackgroundImageUrl(current);
          if (bgUrl) {
            return bgUrl;
          }
          current = current.parentElement;
        }
      }
      
      return null;
    }
    
    // Make function available globally for testing
    window.findBackgroundImageAtCoordinates = findBackgroundImageAtCoordinates;
    return true;
  });
  
  // Get the page dimensions to calculate center
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const horizontalCenter = pageWidth / 2;
  const yCoordinate = 40;
  
  // Test the background image detection at the specified coordinates
  const result = await page.evaluate(({ x, y }) => {
    return window.findBackgroundImageAtCoordinates(x, y);
  }, { x: horizontalCenter, y: yCoordinate });
  
  // Assert the expected result
  expect(result).toBe('https://place-hold.it/1600x900/#ccc/#111');
  
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