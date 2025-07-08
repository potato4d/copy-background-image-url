// Simple Node.js test to validate the background image detection logic
const fs = require('fs');
const path = require('path');

// Mock DOM APIs for testing
function createMockDOM() {
  const mockElements = [
    {
      tagName: 'MAIN',
      className: '',
      style: {
        zIndex: '2',
        position: 'relative',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backgroundImage: 'none'
      }
    },
    {
      tagName: 'DIV',
      className: 'container',
      style: {
        zIndex: '1',
        position: 'absolute',
        backgroundImage: "url('https://place-hold.it/1600x900/#ccc/#111')"
      }
    }
  ];
  
  global.document = {
    elementsFromPoint: (x, y) => mockElements,
    elementFromPoint: (x, y) => mockElements[0],
    body: { tagName: 'BODY' },
    documentElement: { tagName: 'HTML' }
  };
  
  global.window = {
    getComputedStyle: (element) => ({
      backgroundImage: element.style.backgroundImage,
      zIndex: element.style.zIndex,
      position: element.style.position
    })
  };
}

// Test function
function testBackgroundImageDetection() {
  createMockDOM();
  
  // The logic we want to test
  function findBackgroundImageAtCoordinates(x, y) {
    const elements = document.elementsFromPoint(x, y);
    
    function getBackgroundImageUrl(element) {
      const style = window.getComputedStyle(element);
      const backgroundImage = style.backgroundImage;
      
      if (backgroundImage && backgroundImage !== 'none') {
        const urlMatch = backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
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
    
    // Strategy 2: Check elements by z-index order (higher z-index first, then lower)
    const sortedElements = [...elements].sort((a, b) => {
      const aZ = parseInt(window.getComputedStyle(a).zIndex) || 0;
      const bZ = parseInt(window.getComputedStyle(b).zIndex) || 0;
      return bZ - aZ; // Higher z-index first
    });
    
    for (const element of sortedElements) {
      const bgUrl = getBackgroundImageUrl(element);
      if (bgUrl) {
        return bgUrl;
      }
    }
    
    return null;
  }
  
  // Test the function
  const result = findBackgroundImageAtCoordinates(400, 40); // Center and 40px from top
  
  console.log('Test result:', result);
  console.log('Expected:', 'https://place-hold.it/1600x900/#ccc/#111');
  console.log('Test passed:', result === 'https://place-hold.it/1600x900/#ccc/#111');
  
  return result === 'https://place-hold.it/1600x900/#ccc/#111';
}

// Run the test
const passed = testBackgroundImageDetection();
process.exit(passed ? 0 : 1);