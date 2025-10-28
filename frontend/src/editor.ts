import type { DiffResult } from './types';

export class TextEditor {
  private editorElement: HTMLDivElement;
  private lastContent: string = "";
  private onCursorChange?: (position: number) => void;
  private onContentUpdate?: () => void;

  constructor(editorId: string, onCursorChange?: (position: number) => void, onContentUpdate?: () => void) {
    this.editorElement = document.getElementById(editorId) as HTMLDivElement;
    this.onCursorChange = onCursorChange;
    this.onContentUpdate = onContentUpdate;
    if (!this.editorElement) {
      throw new Error(`Editor element with id '${editorId}' not found`);
    }
  }

  // Find difference between old and new text
  findDifference(oldText: string, newText: string): DiffResult | null {
    oldText = oldText.replace(/\u00A0/g, ' ');
    newText = newText.replace(/\u00A0/g, ' ');
    
    if (newText.length > oldText.length) { // Insertion
      let start = 0;
      let end = newText.length;
      let startFound = false;
      
      for (let i = 0; i < newText.length; i++) {
        if (newText[i] !== oldText[i] && !startFound) {
          start = i;
          startFound = true;
        }
        if (newText.slice(i) === oldText.slice(start)) {
          end = i;
        }
      }
      
      return {
        type: 'insert',
        content: newText.slice(start, Math.min(end, newText.length)),
        position: start
      };
    } else if (newText.length < oldText.length) { // Deletion
      let start = 0;
      let end = oldText.length;
      let startFound = false;
      
      for (let i = 0; i < oldText.length; i++) {
        if (newText[i] !== oldText[i] && !startFound) {
          start = i;
          startFound = true;
        }
        if (oldText.slice(i) === newText.slice(start)) {
          end = i;
        }
      }
      
      return {
        type: 'delete',
        content: oldText.slice(start, Math.min(end, oldText.length)),
        position: start
      };
    }
    return null;
  }

  // Handle local content changes
  handleContentChange(onChange: (type: 'insert' | 'delete', content: string, position: number) => void): void {
    const currentContent = this.editorElement.textContent || "";
    
    if (currentContent !== this.lastContent) {
      const diff = this.findDifference(this.lastContent, currentContent);
      if (diff) {
        onChange(diff.type, diff.content, diff.position);
      }
      this.lastContent = currentContent;
    }
  }

  // Handle remote insertions
  insertTextAtPosition(text: string, position: number): void {
    const currentContent = this.editorElement.textContent || "";
    
    if (position >= 0 && position <= currentContent.length) {
      // Store current cursor position before making changes
      const currentCursorPos = this.getCursorPosition();
      
      const newContent = 
        currentContent.slice(0, position) +
        text +
        currentContent.slice(position);

      // Update content
      this.editorElement.textContent = newContent;
      this.lastContent = newContent;
      
      // Restore cursor position (adjusted for inserted text if needed)
      const adjustedCursorPos = currentCursorPos <= position 
        ? currentCursorPos 
        : currentCursorPos + text.length;
      this.setCursorPosition(adjustedCursorPos);
      
      // Notify that content was updated (for cursor re-attachment)
      this.onContentUpdate?.(); // calls reattachDetachedCursors()
    }
  }

  // Handle remote deletions
  deleteTextAtPosition(text: string, position: number): void {
    const currentContent = this.editorElement.textContent || "";

    if (position >= 0 && position < currentContent.length) {
      const endPos = position + text.length;
      if (endPos <= currentContent.length) {
        // Store current cursor position before making changes
        const currentCursorPos = this.getCursorPosition();
        
        const newContent = 
          currentContent.slice(0, position) + 
          currentContent.slice(endPos);
        
        // Update content
        this.editorElement.textContent = newContent;
        this.lastContent = newContent;
        
        // Restore cursor position (adjusted for deleted text if needed)
        const adjustedCursorPos = currentCursorPos <= position 
          ? currentCursorPos 
          : Math.max(position, currentCursorPos - text.length);
        this.setCursorPosition(adjustedCursorPos);
        
        // Notify that content was updated (for cursor re-attachment)
        this.onContentUpdate?.(); // calls reattachDetachedCursors()
      }
    }
  }

  // Handle remote changes
  handleRemoteChange(type: 'insert' | 'delete' | 'cursor', content: string, position: number): void {
    if (type === 'insert') {
      this.insertTextAtPosition(content, position);
    } else if (type === 'delete') {
      this.deleteTextAtPosition(content, position);
    }
  }

  // Update cursor position
  updateCursorPosition(): void {
    const position = this.getCursorPosition();
    
    // Send cursor position to other users
    this.onCursorChange?.(position);
  }

  private getCursorPosition(): number {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return 0;
    }

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(this.editorElement);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    
    return preCaretRange.toString().length;
  }

  private setCursorPosition(position: number): void {
    const selection = window.getSelection();
    if (!selection) return;

    const textContent = this.editorElement.textContent || '';
    const clampedPosition = Math.min(position, textContent.length);
    
    try {
      const range = document.createRange();
      const textNode = this.editorElement.firstChild;
      
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        range.setStart(textNode, clampedPosition);
        range.setEnd(textNode, clampedPosition);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch (error) {
      console.error('Error setting cursor position:', error);
    }
  }

  // Get current content
  getContent(): string {
    return this.editorElement.textContent || "";
  }

  // Set content
  setContent(content: string): void {
    this.editorElement.textContent = content;
    this.lastContent = content;
  }

  // Clear editor content
  clear(): void {
    this.editorElement.textContent = "";
    this.lastContent = "";
  }
}
