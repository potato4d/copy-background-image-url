// Logic to find background images behind other elements
function findBackgroundImageAtCoordinates(x, y) {
  // Get all elements at the coordinates
  const elements = document.elementsFromPoint(x, y);
  
  // Helper function to extract background image URL
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
  
  // Strategy 2: Get the bounding rectangle at coordinates and check all elements within it
  const elementsAtPoint = elements[0] ? elements : [document.elementFromPoint(x, y)];
  
  for (const topElement of elementsAtPoint) {
    if (!topElement) continue;
    
    // Temporarily hide this element to check what's behind it
    const originalDisplay = topElement.style.display;
    const originalVisibility = topElement.style.visibility;
    const originalPointerEvents = topElement.style.pointerEvents;
    
    topElement.style.pointerEvents = 'none';
    
    // Get element behind the hidden one
    const elementBehind = document.elementFromPoint(x, y);
    
    // Restore original styles
    topElement.style.display = originalDisplay;
    topElement.style.visibility = originalVisibility;
    topElement.style.pointerEvents = originalPointerEvents;
    
    if (elementBehind && elementBehind !== topElement) {
      const bgUrl = getBackgroundImageUrl(elementBehind);
      if (bgUrl) {
        return bgUrl;
      }
    }
  }
  
  // Strategy 3: Traverse up the DOM tree from the deepest element
  const deepestElement = elements[elements.length - 1];
  if (deepestElement) {
    let current = deepestElement;
    while (current && current !== document.body) {
      const bgUrl = getBackgroundImageUrl(current);
      if (bgUrl) {
        return bgUrl;
      }
      current = current.parentElement;
    }
  }
  
  return null;
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { findBackgroundImageAtCoordinates };
}