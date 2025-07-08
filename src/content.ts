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
    const originalStyles: Array<{element: Element, pointerEvents: string}> = [];
    const elementsToHide = elements.slice(0, -1); // Don't hide the deepest element
    
    try {
      // Hide elements one by one and check for background images
      for (let i = 0; i < elementsToHide.length; i++) {
        const element = elementsToHide[i];
        const htmlElement = element as HTMLElement;
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
              (element as HTMLElement).style.pointerEvents = pointerEvents;
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
        (element as HTMLElement).style.pointerEvents = pointerEvents;
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
      chrome.runtime.sendMessage({
        action: 'copyToClipboard',
        url: result.url
      }, (response) => {
        if (response?.success) {
          console.log('Background image URL copied successfully:', result.url);
        } else {
          console.error('Failed to copy background image URL:', response?.error || 'Unknown error');
        }
      });
      
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