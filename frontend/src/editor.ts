import { EditorState } from '@codemirror/state';
import { EditorView, keymap, highlightActiveLine, highlightActiveLineGutter, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, foldGutter, indentOnInput } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import type { DiffResult } from './types';

export class TextEditor {
  private editorView: EditorView | null = null;
  private lastContent: string = "";
  private onChangeCallback?: (type: 'insert' | 'delete', content: string, position: number) => void;
  private onCursorChange?: (position: number) => void;
  private onContentUpdate?: () => void;
  private isApplyingRemoteChange: boolean = false;

  constructor(containerId: string, onCursorChange?: (position: number) => void, onContentUpdate?: () => void, onChange?: (type: 'insert' | 'delete', content: string, position: number) => void) {
    this.onCursorChange = onCursorChange;
    this.onContentUpdate = onContentUpdate;
    this.onChangeCallback = onChange;
    
    const containerElement = document.getElementById(containerId);
    if (!containerElement) {
      throw new Error(`Editor container with id '${containerId}' not found`);
    }

    // Initialize CodeMirror editor
    const startState = EditorState.create({
      doc: "",
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        foldGutter(),
        indentOnInput(),
        bracketMatching(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        javascript(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !this.isApplyingRemoteChange && this.onChangeCallback) {
            // Use CodeMirror's change tracking to detect exact changes
            // Get the old document content before changes
            const oldDoc = update.startState.doc;
            
            update.changes.iterChanges((fromA: number, toA: number, fromB: number, _toB: number, inserted: any) => {
              // Handle deletions (text that existed in oldDoc but not in newDoc)
              if (toA > fromA) {
                const deletedText = oldDoc.sliceString(fromA, toA);
                this.onChangeCallback!('delete', deletedText, fromA);
              }
              // Handle insertions
              if (inserted.length > 0) {
                const insertedText = inserted.toString();
                this.onChangeCallback!('insert', insertedText, fromB);
              }
            });
            this.lastContent = update.state.doc.toString();
          }
          if (update.selectionSet && !this.isApplyingRemoteChange) {
            // Cursor position changed
            const position = update.state.selection.main.head;
            this.onCursorChange?.(position);
          }
        }),
        EditorView.theme({
          '&': {
            fontSize: '14px',
            height: '100%',
          },
          '.cm-editor': {
            height: '100%',
          },
          '.cm-scroller': {
            height: '100%',
            overflow: 'auto',
          },
          '.cm-content': {
            padding: '16px',
            minHeight: '100%',
          },
        }),
      ],
    });

    this.editorView = new EditorView({
      state: startState,
      parent: containerElement,
    });

    this.lastContent = this.editorView.state.doc.toString();
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
    if (!this.editorView) return;
    
    const currentContent = this.editorView.state.doc.toString();
    
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
    if (!this.editorView) return;

    const doc = this.editorView.state.doc;
    const docLength = doc.length;

    if (position >= 0 && position <= docLength) {
      this.isApplyingRemoteChange = true;
      
      // Store current cursor position
      const currentCursorPos = this.editorView.state.selection.main.head;
      
      // Create transaction to insert text
      const transaction = this.editorView.state.update({
        changes: {
          from: position,
          insert: text,
        },
        selection: {
          anchor: currentCursorPos <= position 
            ? currentCursorPos 
            : currentCursorPos + text.length,
        },
      });

      this.editorView.dispatch(transaction);
      this.lastContent = this.editorView.state.doc.toString();
      
      this.isApplyingRemoteChange = false;
      
      // Notify that content was updated (for cursor re-attachment)
      this.onContentUpdate?.();
    }
  }

  // Handle remote deletions
  deleteTextAtPosition(text: string, position: number): void {
    if (!this.editorView) return;

    const doc = this.editorView.state.doc;
    const docLength = doc.length;

    if (position >= 0 && position < docLength) {
      const endPos = position + text.length;
      if (endPos <= docLength) {
        this.isApplyingRemoteChange = true;
        
        // Store current cursor position
        const currentCursorPos = this.editorView.state.selection.main.head;
        
        // Create transaction to delete text
        const transaction = this.editorView.state.update({
          changes: {
            from: position,
            to: endPos,
          },
          selection: {
            anchor: currentCursorPos <= position 
              ? currentCursorPos 
              : Math.max(position, currentCursorPos - text.length),
          },
        });

        this.editorView.dispatch(transaction);
        this.lastContent = this.editorView.state.doc.toString();
        
        this.isApplyingRemoteChange = false;
        
        // Notify that content was updated (for cursor re-attachment)
        this.onContentUpdate?.();
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
    if (!this.editorView) return;
    
    const position = this.editorView.state.selection.main.head;
    this.onCursorChange?.(position);
  }

  // Get current content
  getContent(): string {
    return this.editorView?.state.doc.toString() || "";
  }

  // Set content
  setContent(content: string): void {
    if (!this.editorView) return;
    
    const transaction = this.editorView.state.update({
      changes: {
        from: 0,
        to: this.editorView.state.doc.length,
        insert: content,
      },
    });
    
    this.editorView.dispatch(transaction);
    this.lastContent = content;
  }

  // Clear editor content
  clear(): void {
    this.setContent("");
  }

  // Get editor view for cursor positioning (used by CursorManager)
  getEditorView(): EditorView | null {
    return this.editorView;
  }

  // Get editor container element
  getContainerElement(): HTMLElement | null {
    return this.editorView?.dom || null;
  }
}
