// Inline the background image detection logic to avoid ES6 module issues
interface BackgroundImageResult {
  success: boolean;
  url?: string;
  error?: string;
  debugInfo?: {
    coordinates: { x: number; y: number };
    elementsFound: number;
    strategy: string;
    elementsChecked: Array<{
      tagName: string;
      className: string;
      backgroundImage: string;
      zIndex: string;
    }>;
  };
}

function extractBackgroundImageUrl(backgroundImageValue: string): string | null {
  if (!backgroundImageValue || backgroundImageValue === 'none') {
    return null;
  }
  
  const urlMatch = backgroundImageValue.match(/url\(['"]?(.*?)['"]?\)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  
  return null;
}

function getElementBackgroundImage(element: Element): string | null {
  try {
    const style = window.getComputedStyle(element);
    const backgroundImage = style.backgroundImage;
    return extractBackgroundImageUrl(backgroundImage);
  } catch (error) {
    console.error('Error getting computed style:', error);
    return null;
  }
}

function getElementImageUrl(element: Element): string | null {
  try {
    // Check if it's an IMG element with src attribute
    if (element.tagName === 'IMG') {
      const imgElement = element as HTMLImageElement;
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

function findBackgroundImageAtCoordinates(x: number, y: number): BackgroundImageResult {
  const debugInfo = {
    coordinates: { x, y },
    elementsFound: 0,
    strategy: '',
    elementsChecked: [] as Array<{
      tagName: string;
      className: string;
      backgroundImage: string;
      zIndex: string;
    }>
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
    
    // Strategy 2: Check elements by spatial analysis (no DOM modification)
    debugInfo.strategy = 'spatial-analysis';
    
    // Get element bounding boxes and check elements that might be behind others
    const elementsWithBounds = elements.map(element => ({
      element,
      rect: element.getBoundingClientRect(),
      zIndex: parseInt(window.getComputedStyle(element).zIndex) || 0
    }));
    
    // Sort by z-index to check background elements first
    elementsWithBounds.sort((a, b) => a.zIndex - b.zIndex);
    
    for (const { element, rect } of elementsWithBounds) {
      // Check if the click coordinates are within this element's bounds
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const imageUrl = getElementImageUrl(element);
        if (imageUrl) {
          return {
            success: true,
            url: imageUrl,
            debugInfo
          };
        }
      }
    }
    
    // Strategy 3: Check parent elements for background images
    debugInfo.strategy = 'parent-traversal';
    
    // Start with the deepest element and traverse up the DOM tree
    const deepestElement = elements[elements.length - 1];
    let currentElement = deepestElement?.parentElement;
    
    while (currentElement && currentElement !== document.body) {
      const imageUrl = getElementImageUrl(currentElement);
      if (imageUrl) {
        return {
          success: true,
          url: imageUrl,
          debugInfo
        };
      }
      currentElement = currentElement.parentElement;
    }
    
    // Strategy 4: Check elements within viewport bounds (read-only analysis)
    debugInfo.strategy = 'viewport-bounds-check';
    
    // Get all elements with background images within a reasonable area around the click
    const searchRadius = 10;
    const searchArea = {
      left: x - searchRadius,
      right: x + searchRadius,
      top: y - searchRadius,
      bottom: y + searchRadius
    };
    
    const allElements = Array.from(document.querySelectorAll('*'));
    for (const element of allElements) {
      const rect = element.getBoundingClientRect();
      
      // Check if element intersects with search area
      if (rect.left <= searchArea.right && rect.right >= searchArea.left &&
          rect.top <= searchArea.bottom && rect.bottom >= searchArea.top) {
        
        const imageUrl = getElementImageUrl(element);
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

let lastRightClickCoordinates: { x: number; y: number } | null = null;

document.addEventListener('contextmenu', (event) => {
  lastRightClickCoordinates = { x: event.clientX, y: event.clientY };
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getBackgroundImageUrl') {
    if (!lastRightClickCoordinates) {
      console.error('No right-click coordinates available');
      sendResponse({ found: false, error: 'No right-click coordinates available' });
      return;
    }
    
    const result = findBackgroundImageAtCoordinates(
      lastRightClickCoordinates.x,
      lastRightClickCoordinates.y
    );
    
    console.log('Background image detection result:', result);
    
    if (result.success && result.url) {
      // Try to copy directly in content script first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(result.url).then(() => {
          console.log('Background image URL copied successfully:', result.url);
        }).catch((error) => {
          console.error('Failed to copy to clipboard:', error);
          // Fallback to background script
          chrome.runtime.sendMessage({
            action: 'copyToClipboard',
            url: result.url
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Runtime error:', chrome.runtime.lastError.message);
              return;
            }
            if (response?.success) {
              console.log('Background image URL copied successfully via background:', result.url);
            } else {
              console.error('Failed to copy background image URL:', response?.error || 'Unknown error');
            }
          });
        });
      } else {
        // Fallback to background script
        chrome.runtime.sendMessage({
          action: 'copyToClipboard',
          url: result.url
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Runtime error:', chrome.runtime.lastError.message);
            return;
          }
          if (response?.success) {
            console.log('Background image URL copied successfully via background:', result.url);
          } else {
            console.error('Failed to copy background image URL:', response?.error || 'Unknown error');
          }
        });
      }
      
      sendResponse({ found: true, url: result.url });
    } else {
      console.log('No background image found:', result.error);
      if (result.debugInfo) {
        console.log('Debug info:', result.debugInfo);
      }
      sendResponse({ found: false, error: result.error });
    }
  }
});