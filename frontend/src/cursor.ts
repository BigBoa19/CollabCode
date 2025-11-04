import { EditorView } from '@codemirror/view';

export class CursorManager {
  private remoteCursors: Map<string, {position: number; element: HTMLElement}> = new Map();
  private editorView: EditorView | null = null;
  private containerElement: HTMLElement;

  constructor(containerId: string) {
    this.containerElement = document.getElementById(containerId) as HTMLElement;
    if (!this.containerElement) {
      throw new Error(`Editor container with id '${containerId}' not found`);
    }
  }

  // Set the CodeMirror EditorView instance
  setEditorView(editorView: EditorView): void {
    this.editorView = editorView;
  }

  updateRemoteCursorPosition(user_id: string, position: number): void {
    // Create cursor if it doesn't exist
    if (!this.remoteCursors.has(user_id)) {
      const cursorElement = this.createRemoteCursorElement(user_id);
      this.containerElement.appendChild(cursorElement);
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

  private getCursorColor(user_id: string): string {
    // Colors: blue, red, pink, yellow
    const colors = ['#3b82f6', '#ef4444', '#ec4899', '#eab308'];
    // Use a simple hash of user_id to deterministically assign colors
    let hash = 0;
    for (let i = 0; i < user_id.length; i++) {
      hash = ((hash << 5) - hash) + user_id.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return colors[Math.abs(hash) % colors.length];
  }

  private createRemoteCursorElement(user_id: string): HTMLElement {
    const color = this.getCursorColor(user_id);
    
    // Create wrapper container for hover functionality
    const wrapper = document.createElement('div');
    wrapper.className = 'remote-cursor-wrapper';
    wrapper.style.cssText = `
      position: absolute;
      z-index: 1000;
    `;
    
    // Create hover zone (invisible area that detects hover)
    const hoverZone = document.createElement('div');
    hoverZone.className = 'remote-cursor-hover-zone';
    hoverZone.style.cssText = `
      position: absolute;
      left: -4px;
      top: -4px;
      width: 10px;
      height: 26px;
      pointer-events: auto;
    `;
    
    // Create the visible cursor line
    const cursor = document.createElement('div');
    cursor.className = 'remote-cursor';
    cursor.style.cssText = `
      position: absolute;
      left: 4px;
      top: 0;
      width: 2px;
      height: 18px;
      background-color: ${color};
      pointer-events: none;
      opacity: 0.8;
      transition: opacity 0.2s;
    `;
    
    // Add user label (hidden by default, shown on hover)
    const label = document.createElement('div');
    label.className = 'remote-cursor-label';
    label.textContent = user_id;
    label.style.cssText = `
      position: absolute;
      top: -14px;
      left: 4px;
      background: ${color};
      color: white;
      padding: 1px 4px;
      border-radius: 2px;
      font-size: 10px;
      white-space: nowrap;
      line-height: 1.2;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s;
      pointer-events: none;
    `;
    
    // Show label on hover
    hoverZone.addEventListener('mouseenter', () => {
      label.style.opacity = '1';
      label.style.visibility = 'visible';
    });
    
    hoverZone.addEventListener('mouseleave', () => {
      label.style.opacity = '0';
      label.style.visibility = 'hidden';
    });
    
    wrapper.appendChild(hoverZone);
    wrapper.appendChild(cursor);
    wrapper.appendChild(label);
    
    // Store references for height updates
    (wrapper as any).cursorLine = cursor;
    
    return wrapper;
  }

  private positionRemoteCursor(userId: string, position: number): void {
    const cursorData = this.remoteCursors.get(userId);
    if (!cursorData) {
      console.log(`❌ No cursor data found for user ${userId}`);
      return;
    }

    if (!this.editorView) {
      // Fallback positioning if CodeMirror not ready
      cursorData.element.style.left = '16px';
      cursorData.element.style.top = '16px';
      cursorData.element.style.opacity = '0';
      return;
    }

    try {
      const doc = this.editorView.state.doc;
      const docLength = doc.length;
      
      // Clamp position to valid range
      const clampedPosition = Math.min(Math.max(0, position), docLength);
      
      // Use CodeMirror's coordinate conversion
      const coords = this.editorView.coordsAtPos(clampedPosition);
      const containerRect = this.containerElement.getBoundingClientRect();
      
      if (coords) {
        // Position cursor relative to container
        const leftOffset = coords.left - containerRect.left;
        const topOffset = coords.top - containerRect.top;
        const lineHeight = coords.bottom - coords.top;
        
        cursorData.element.style.left = `${leftOffset - 4}px`;
        cursorData.element.style.top = `${topOffset}px`;
        
        // Update cursor line height
        const cursorLine = (cursorData.element as any).cursorLine;
        if (cursorLine) {
          cursorLine.style.height = `${lineHeight}px`;
        }
        
        cursorData.element.style.opacity = '0.8';
      } else {
        // Fallback if coordinates not available (e.g., position out of view)
        cursorData.element.style.opacity = '0';
      }
    } catch (error) {
      console.error('Error positioning cursor:', error);
      // Fallback positioning
      cursorData.element.style.opacity = '0';
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

  // Re-append any detached cursor elements after content updates
  reattachDetachedCursors(): void {
    this.remoteCursors.forEach((cursorData, userId) => {
      if (cursorData.element.parentElement === null) {
        console.log(`🔗 Re-attaching detached cursor for ${userId}`);
        this.containerElement.appendChild(cursorData.element);
      }
      // Reposition all cursors after content update
      this.positionRemoteCursor(userId, cursorData.position);
    });
  }

  // Update all cursor positions (useful after scroll or resize)
  updateAllCursors(): void {
    this.remoteCursors.forEach((cursorData, userId) => {
      this.positionRemoteCursor(userId, cursorData.position);
    });
  }
}
