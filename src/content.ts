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
          const imageUrl = getElementImageUrl(elementBehind);
          if (imageUrl) {
            // Restore styles before returning
            originalStyles.forEach(({ element, pointerEvents }) => {
              (element as HTMLElement).style.pointerEvents = pointerEvents;
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
      const descendants = Array.from(element.querySelectorAll('*'));
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