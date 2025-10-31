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
      const cursorElement = this.createRemoteCursorElement();
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

  private createRemoteCursorElement(): HTMLElement {
    const cursor = document.createElement('div');
    cursor.className = 'remote-cursor';
    cursor.style.cssText = `
      position: absolute;
      width: 2px;
      height: 18px;
      background-color: #ff6b6b;
      pointer-events: none;
      z-index: 1000;
      opacity: 0.8;
      transition: opacity 0.2s;
    `;
    
    // Add user label (optional)
    // const label = document.createElement('div');
    // label.textContent = userId;
    // label.style.cssText = `
    //   position: absolute;
    //   top: -20px;
    //   left: 0;
    //   background: #ff6b6b;
    //   color: white;
    //   padding: 2px 6px;
    //   border-radius: 3px;
    //   font-size: 12px;
    //   white-space: nowrap;
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
        const leftOffset = coords.left - containerRect.left - 3.2;
        const topOffset = coords.top - containerRect.top - 1;
        
        cursorData.element.style.left = `${leftOffset}px`;
        cursorData.element.style.top = `${topOffset}px`;
        cursorData.element.style.height = `${coords.bottom - coords.top}px`;
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
