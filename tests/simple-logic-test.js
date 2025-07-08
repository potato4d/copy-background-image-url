// Simple test to verify the logic works with the test page
const fs = require('fs');
const path = require('path');

// Create a basic test environment
function createTestEnvironment() {
  // Mock DOM elements that match the test HTML structure
  const mockElements = [
    {
      tagName: 'MAIN',
      className: '',
      style: {
        pointerEvents: '',
        backgroundImage: 'none',
        zIndex: '2'
      }
    },
    {
      tagName: 'DIV',
      className: 'container',
      style: {
        pointerEvents: '',
        backgroundImage: "url('https://place-hold.it/1600x900/#ccc/#111')",
        zIndex: '1'
      }
    }
  ];
  
  global.document = {
    elementsFromPoint: (x, y) => mockElements,
    elementFromPoint: (x, y) => mockElements[1] // Return the background element
  };
  
  global.window = {
    getComputedStyle: (element) => ({
      backgroundImage: element.style.backgroundImage,
      zIndex: element.style.zIndex
    })
  };
  
  // Define the functions directly (converted from ES6 to CommonJS style)
  function extractBackgroundImageUrl(backgroundImageValue) {
    if (!backgroundImageValue || backgroundImageValue === 'none') {
      return null;
    }
    const urlMatch = backgroundImageValue.match(/url\(['"]?(.*?)['"]?\)/);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
    return null;
  }
  
  function getElementBackgroundImage(element) {
    try {
      const style = window.getComputedStyle(element);
      const backgroundImage = style.backgroundImage;
      return extractBackgroundImageUrl(backgroundImage);
    } catch (error) {
      console.error('Error getting computed style:', error);
      return null;
    }
  }
  
  function findBackgroundImageAtCoordinates(x, y) {
    const debugInfo = {
      coordinates: { x, y },
      elementsFound: 0,
      strategy: '',
      elementsChecked: []
    };
    
    try {
      // Get all elements at the coordinates
      const elements = document.elementsFromPoint(x, y);
      debugInfo.elementsFound = elements.length;
      
      if (elements.length === 0) {
        return {
          success: false,
          error: 'No elements found at coordinates',
          debugInfo
        };
      }
      
      // Strategy 1: Check all elements at coordinates for background images
      debugInfo.strategy = 'direct-check';
      for (const element of elements) {
        const style = window.getComputedStyle(element);
        const bgUrl = getElementBackgroundImage(element);
        
        debugInfo.elementsChecked.push({
          tagName: element.tagName,
          className: element.className,
          backgroundImage: style.backgroundImage,
          zIndex: style.zIndex
        });
        
        if (bgUrl) {
          return {
            success: true,
            url: bgUrl,
            debugInfo
          };
        }
      }
      
      // Strategy 2: Temporarily hide overlapping elements to check what's behind
      debugInfo.strategy = 'pointer-events-manipulation';
      const originalStyles = [];
      const elementsToHide = elements.slice(0, -1); // Don't hide the deepest element
      
      try {
        // Hide elements one by one and check for background images
        for (let i = 0; i < elementsToHide.length; i++) {
          const element = elementsToHide[i];
          const htmlElement = element;
          originalStyles.push({
            element: element,
            pointerEvents: htmlElement.style.pointerEvents
          });
          htmlElement.style.pointerEvents = 'none';
          
          const elementBehind = document.elementFromPoint(x, y);
          if (elementBehind) {
            const bgUrl = getElementBackgroundImage(elementBehind);
            if (bgUrl) {
              // Restore styles before returning
              originalStyles.forEach(({ element, pointerEvents }) => {
                element.style.pointerEvents = pointerEvents;
              });
              return {
                success: true,
                url: bgUrl,
                debugInfo
              };
            }
          }
        }
      } finally {
        // Always restore styles
        originalStyles.forEach(({ element, pointerEvents }) => {
          element.style.pointerEvents = pointerEvents;
        });
      }
      
      // Strategy 3: Check elements by z-index order (lower z-index first for background images)
      debugInfo.strategy = 'z-index-sorting';
      const sortedElements = [...elements].sort((a, b) => {
        const aZ = parseInt(window.getComputedStyle(a).zIndex) || 0;
        const bZ = parseInt(window.getComputedStyle(b).zIndex) || 0;
        return aZ - bZ; // Lower z-index first for background images
      });
      
      for (const element of sortedElements) {
        const bgUrl = getElementBackgroundImage(element);
        if (bgUrl) {
          return {
            success: true,
            url: bgUrl,
            debugInfo
          };
        }
      }
      
      return {
        success: false,
        error: 'No background image found at coordinates',
        debugInfo
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Error detecting background image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        debugInfo
      };
    }
  }
  
  global.findBackgroundImageAtCoordinates = findBackgroundImageAtCoordinates;
}

function runTests() {
  console.log('Setting up test environment...');
  createTestEnvironment();
  
  console.log('Testing background image detection...');
  
  // Test the main function
  const result = findBackgroundImageAtCoordinates(400, 40);
  
  console.log('Test result:', JSON.stringify(result, null, 2));
  
  // Verify the result
  const success = result.success === true && result.url === 'https://place-hold.it/1600x900/#ccc/#111';
  
  console.log('Test passed:', success);
  
  if (!success) {
    console.error('Test failed!');
    process.exit(1);
  } else {
    console.log('All tests passed!');
  }
}

// Run the tests
runTests();