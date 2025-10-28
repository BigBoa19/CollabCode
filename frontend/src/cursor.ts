export class CursorManager {
    private remoteCursors: Map<string, {position:number; element: HTMLElement}> = new Map() // map key: userIDs

    private editorElement: HTMLDivElement;
    constructor(editorId: string) {
        this.editorElement = document.getElementById(editorId) as HTMLDivElement;
        if (!this.editorElement) {
          throw new Error(`Editor element with id '${editorId}' not found`);
        }
    }

    updateRemoteCursorPosition(user_id: string, position: number): void {
        // Create cursor if it doesn't exist
        if (!this.remoteCursors.has(user_id)) {
            const cursorElement = this.createRemoteCursorElement();
            this.editorElement.appendChild(cursorElement);
            this.remoteCursors.set(user_id, {
                position: position,
                element: cursorElement
            });
        }

        // Update cursor position
        const cursorData = this.remoteCursors.get(user_id);
        if (cursorData) {
            cursorData.position = position;
            this.positionRemoteCursor(user_id, position);
        }
    }

  private createRemoteCursorElement() {
    const cursor = document.createElement('div');
    cursor.className = 'remote-cursor';
    cursor.style.cssText = `
      position: absolute; width: 2px; height: 16px; background-color: #ff6b6b;
      pointer-events: none; z-index: 1000; opacity: 0.8;
    `;
    
    // Add user label
    // const label = document.createElement('div');
    // label.textContent = userId;
    // label.style.cssText = `
    //   position: absolute; top: -20px; left: 0; background: #ff6b6b;
    //   color: white; padding: 2px 6px; border-radius: 3px;
    //   font-size: 12px; white-space: nowrap;
    // `;
    // cursor.appendChild(label);
    return cursor;
  }

  private positionRemoteCursor(userId: string, position: number): void {
    const cursorData = this.remoteCursors.get(userId);
    if (!cursorData) {
      console.log(`❌ No cursor data found for user ${userId}`);
      return;
    }

    const textContent = this.editorElement.textContent || '';

    // Handle empty editor
    if (textContent.length === 0) {
      cursorData.element.style.left = '16px';
      cursorData.element.style.top = '16px';
      return;
    }

    // Store current selection to restore later
    const currentSelection = window.getSelection();
    const currentRange = currentSelection?.rangeCount ? currentSelection.getRangeAt(0) : null;
    
    try {
      // Create a new range for positioning
      const range = document.createRange();
      const textNode = this.editorElement.firstChild;
      
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const clampedPosition = Math.min(position, textContent.length);
        range.setStart(textNode, clampedPosition);
        range.setEnd(textNode, clampedPosition);
        
        // Temporarily set this range as the selection to get accurate positioning
        currentSelection?.removeAllRanges();
        currentSelection?.addRange(range);
        
        // Get the bounding rect of our temporary selection
        const rect = range.getBoundingClientRect();
        const editorRect = this.editorElement.getBoundingClientRect();
        
        // Position cursor relative to editor with fine-tuned offsets
        const leftOffset = rect.left - editorRect.left - 3.2; // Small horizontal adjustment
        const topOffset = rect.top - editorRect.top - 1; // Small vertical adjustment
          
        cursorData.element.style.left = `${leftOffset}px`;
        cursorData.element.style.top = `${topOffset}px`;
        console.log(`🎯 Positioning cursor for ${userId} at position ${position}, text length: ${textContent.length} which has 
        leftOffset: ${leftOffset}px, topOffset: ${topOffset}px`);
        console.log(`🔍 Cursor element in DOM:`, cursorData.element);
        console.log(`🔍 Cursor parent:`, cursorData.element.parentElement);
    
        // Restore original selection
        currentSelection?.removeAllRanges();
        if (currentRange) {
          currentSelection?.addRange(currentRange);
        }
      } else {
        // Fallback for unexpected DOM structure
        cursorData.element.style.left = '16px';
        cursorData.element.style.top = '16px';
      }
    } catch (error) {
      console.error('Error positioning cursor:', error);
      // Fallback positioning
      cursorData.element.style.left = '16px';
      cursorData.element.style.top = '16px';
    }
  }

  removeCursor(userId: string): void {
    const cursorData = this.remoteCursors.get(userId);
    if (cursorData) {
      cursorData.element.remove();
      this.remoteCursors.delete(userId);
    }
  }

  clearAllCursors(): void {
    this.remoteCursors.forEach((cursorData) => {
      cursorData.element.remove();
    });
    this.remoteCursors.clear();
  }

  updateAllCursors(): void {
    console.log(`🔄 Updating all cursors. Total cursors: ${this.remoteCursors.size}`);
    this.remoteCursors.forEach((cursorData, userId) => {
      console.log(`📍 Updating cursor for ${userId} at position ${cursorData.position}`);
      this.positionRemoteCursor(userId, cursorData.position);
    });
  }

  // Re-append any detached cursor elements after content updates
  reattachDetachedCursors(): void {
    this.remoteCursors.forEach((cursorData, userId) => {
      if (cursorData.element.parentElement === null) {
        console.log(`🔗 Re-attaching detached cursor for ${userId}`);
        this.editorElement.appendChild(cursorData.element);
      }
    });
  }
}