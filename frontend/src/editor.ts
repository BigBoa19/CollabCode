import { EditorState } from '@codemirror/state';
import { EditorView, keymap, highlightActiveLine, highlightActiveLineGutter, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, foldGutter, indentOnInput } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { collab, sendableUpdates } from '@codemirror/collab';
import { CollabManager } from './collab';
import type { DiffResult } from './types';

export class TextEditor {
  private editorView: EditorView | null = null;
  private lastContent: string = "";
  private onCursorChange?: (position: number) => void;
  private onContentUpdate?: () => void;
  private collabManager: CollabManager;
  private clientID: string;
  private startVersion: number = 0;

  constructor(
    containerId: string,
    clientID: string,
    startVersion: number = 0,
    onCursorChange?: (position: number) => void,
    onContentUpdate?: () => void,
    onPush?: (updates: any[], version: number) => void,
    onPull?: (version: number) => void
  ) {
    this.clientID = clientID;
    this.startVersion = startVersion;
    this.onCursorChange = onCursorChange;
    this.onContentUpdate = onContentUpdate;
    
    // Initialize collab manager
    this.collabManager = new CollabManager(
      onPush,
      onPull
    );
    
    const containerElement = document.getElementById(containerId);
    if (!containerElement) {
      throw new Error(`Editor container with id '${containerId}' not found`);
    }

    // Initialize CodeMirror editor with collab extension
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
        collab({
          startVersion: this.startVersion,
          clientID: this.clientID,
        }),
        EditorView.updateListener.of((update) => {
          // Handle cursor position changes
          if (update.selectionSet) {
            const position = update.state.selection.main.head;
            this.onCursorChange?.(position);
          }
          
          // Handle document changes
          if (update.docChanged) {
            this.lastContent = update.state.doc.toString();
            
            // Check if there are sendable updates (local changes that need to be pushed)
            // Use a timeout to batch updates and avoid flooding the server
            if (this.editorView && this.collabManager) {
              const sendable = sendableUpdates(update.state);
              if (sendable.length > 0) {
                // Debounce pushes to avoid infinite loops
                clearTimeout((this as any).pushTimeout);
                (this as any).pushTimeout = setTimeout(() => {
                  if (this.editorView) {
                    this.collabManager.pushChanges(this.editorView);
                  }
                }, 50); // Wait 50ms for more changes before pushing
              }
            }
            
            this.onContentUpdate?.();
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

  // Handle collab updates from server
  applyCollabUpdates(updates: any[]): boolean {
    if (!this.editorView) return false;
    return this.collabManager.handleUpdatesResponse(this.editorView, updates);
  }

  // Handle version response from server (on initial connection)
  handleVersionResponse(version: number, content?: string): void {
    if (!this.editorView) return;
    this.collabManager.handleVersionResponse(this.editorView, version, content);
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
