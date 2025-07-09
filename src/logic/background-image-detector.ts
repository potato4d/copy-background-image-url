export interface BackgroundImageResult {
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

export function extractBackgroundImageUrl(backgroundImageValue: string): string | null {
  if (!backgroundImageValue || backgroundImageValue === 'none') {
    return null;
  }
  
  const urlMatch = backgroundImageValue.match(/url\(['"]?(.*?)['"]?\)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  
  return null;
}

export function getElementBackgroundImage(element: Element): string | null {
  try {
    const style = window.getComputedStyle(element);
    const backgroundImage = style.backgroundImage;
    return extractBackgroundImageUrl(backgroundImage);
  } catch (error) {
    console.error('Error getting computed style:', error);
    return null;
  }
}

export function getElementImageUrl(element: Element): string | null {
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

export function findBackgroundImageAtCoordinates(x: number, y: number): BackgroundImageResult {
  // Make function available globally for testing
  if (typeof window !== 'undefined') {
    (window as any).findBackgroundImageAtCoordinates = findBackgroundImageAtCoordinates;
  }
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