// Test for IMG element detection functionality
const fs = require('fs');
const path = require('path');

// Create a test environment with IMG elements
function createTestEnvironment() {
  // Mock DOM elements that include IMG elements
  const mockElements = [
    {
      tagName: 'DIV',
      className: 'overlay',
      style: {
        pointerEvents: '',
        backgroundImage: 'none',
        zIndex: '20'
      },
      querySelectorAll: () => []
    },
    {
      tagName: 'IMG',
      className: 'main-image',
      src: 'https://example.com/main-image.jpg',
      style: {
        pointerEvents: '',
        backgroundImage: 'none',
        zIndex: '10'
      },
      querySelectorAll: () => []
    },
    {
      tagName: 'DIV',
      className: 'container',
      style: {
        pointerEvents: '',
        backgroundImage: 'none',
        zIndex: '1'
      },
      querySelectorAll: () => [
        {
          tagName: 'IMG',
          className: 'nested-image',
          src: 'https://example.com/nested-image.jpg',
          style: {
            pointerEvents: '',
            backgroundImage: 'none',
            zIndex: 'auto'
          },
          querySelectorAll: () => []
        }
      ]
    }
  ];
  
  // Mock elements for child element test
  const mockChildElements = [
    {
      tagName: 'DIV',
      className: 'parent',
      style: {
        pointerEvents: '',
        backgroundImage: 'none',
        zIndex: '1'
      },
      querySelectorAll: () => [
        {
          tagName: 'IMG',
          className: 'child-image',
          src: 'https://example.com/child-image.jpg',
          style: {
            pointerEvents: '',
            backgroundImage: 'none',
            zIndex: 'auto'
          },
          querySelectorAll: () => []
        }
      ]
    }
  ];
  
  global.document = {
    elementsFromPoint: (x, y) => {
      if (x === 400 && y === 200) return mockElements; // Main test coordinates
      if (x === 500 && y === 300) return mockChildElements; // Child element test coordinates
      return [];
    },
    elementFromPoint: (x, y) => mockElements[1] // Return the IMG element
  };
  
  global.window = {
    getComputedStyle: (element) => ({
      backgroundImage: element.style.backgroundImage,
      zIndex: element.style.zIndex
    })
  };
  
  // Define the functions (updated to include IMG element support)
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

  function getElementImageUrl(element) {
    try {
      // Check if it's an IMG element with src attribute
      if (element.tagName === 'IMG') {
        const imgElement = element;
        if (imgElement.src) {
          return imgElement.src;
        }
      }
      
      // Check for background image
      const bgUrl = getElementBackgroundImage(element);
      if (bgUrl) {
        return bgUrl;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting element image URL:', error);
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
      
      // Strategy 1: Check all elements at coordinates for images (both background and img elements)
      debugInfo.strategy = 'direct-check';
      for (const element of elements) {
        const style = window.getComputedStyle(element);
        const imageUrl = getElementImageUrl(element);
        
        debugInfo.elementsChecked.push({
          tagName: element.tagName,
          className: element.className,
          backgroundImage: style.backgroundImage,
          zIndex: style.zIndex
        });
        
        if (imageUrl) {
          return {
            success: true,
            url: imageUrl,
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
            const imageUrl = getElementImageUrl(elementBehind);
            if (imageUrl) {
              // Restore styles before returning
              originalStyles.forEach(({ element, pointerEvents }) => {
                element.style.pointerEvents = pointerEvents;
              });
              return {
                success: true,
                url: imageUrl,
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
        const imageUrl = getElementImageUrl(element);
        if (imageUrl) {
          return {
            success: true,
            url: imageUrl,
            debugInfo
          };
        }
      }
      
      // Strategy 4: Check child elements recursively
      debugInfo.strategy = 'child-element-check';
      for (const element of elements) {
        const descendants = element.querySelectorAll('*');
        for (const descendant of descendants) {
          const imageUrl = getElementImageUrl(descendant);
          if (imageUrl) {
            return {
              success: true,
              url: imageUrl,
              debugInfo
            };
          }
        }
      }
      
      return {
        success: false,
        error: 'No image found at coordinates',
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
  global.getElementImageUrl = getElementImageUrl;
}

function runTests() {
  console.log('Setting up IMG element test environment...');
  createTestEnvironment();
  
  console.log('Testing IMG element detection...');
  
  // Test 1: Direct IMG element detection
  console.log('\n--- Test 1: Direct IMG element detection ---');
  const result1 = findBackgroundImageAtCoordinates(400, 200);
  console.log('Test 1 result:', JSON.stringify(result1, null, 2));
  
  // Test 2: Child element detection
  console.log('\n--- Test 2: Child element detection ---');
  const result2 = findBackgroundImageAtCoordinates(500, 300);
  console.log('Test 2 result:', JSON.stringify(result2, null, 2));
  
  // Test 3: No image coordinates
  console.log('\n--- Test 3: No image coordinates ---');
  const result3 = findBackgroundImageAtCoordinates(100, 100);
  console.log('Test 3 result:', JSON.stringify(result3, null, 2));
  
  // Test 4: Test getElementImageUrl function directly
  console.log('\n--- Test 4: getElementImageUrl function ---');
  const testImgElement = {
    tagName: 'IMG',
    src: 'https://example.com/test.jpg',
    style: { backgroundImage: 'none' }
  };
  const imgResult = getElementImageUrl(testImgElement);
  console.log('IMG element URL:', imgResult);
  
  // Verify the results
  const tests = [
    {
      name: 'Direct IMG element detection',
      result: result1,
      expected: 'https://example.com/main-image.jpg'
    },
    {
      name: 'Child element detection',
      result: result2,
      expected: 'https://example.com/child-image.jpg'
    },
    {
      name: 'No image coordinates should fail',
      result: result3,
      shouldFail: true
    },
    {
      name: 'getElementImageUrl function',
      result: { success: true, url: imgResult },
      expected: 'https://example.com/test.jpg'
    }
  ];
  
  console.log('\n--- Test Results ---');
  let allPassed = true;
  
  tests.forEach(test => {
    if (test.shouldFail) {
      const passed = !test.result.success;
      console.log(`${test.name}: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
      if (!passed) {
        console.log(`  Expected: failure`);
        console.log(`  Got: success with ${test.result.url}`);
        allPassed = false;
      }
    } else {
      const passed = test.result.success && test.result.url === test.expected;
      console.log(`${test.name}: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
      if (!passed) {
        console.log(`  Expected: ${test.expected}`);
        console.log(`  Got: ${test.result.url || 'No URL'}`);
        console.log(`  Error: ${test.result.error || 'None'}`);
        allPassed = false;
      }
    }
  });
  
  console.log(`\nOverall result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (!allPassed) {
    console.error('Some tests failed!');
    process.exit(1);
  } else {
    console.log('All IMG element tests passed!');
  }
}

// Run the tests
runTests();