import { EditorState } from '@codemirror/state';
import { EditorView, keymap, highlightActiveLine, highlightActiveLineGutter, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, foldGutter, indentOnInput } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import type { DiffResult, RunResponse } from './types';
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint'
import { Linter } from "eslint-linter-browserify";

const eslint = new Linter();
const flatConfig = [{
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",            // use "script" if not modules
    globals:  {
      window: "readonly",
      document: "readonly",
      console: "readonly",
    },
  },
  rules: {
    "no-undef": "error", 
    "no-unused-vars": ["warn", { args: "none" }],
    "eqeqeq": "error",
  },
}];

export class TextEditor {
  private editorView: EditorView | null = null;
  private lastContent: string = "";
  private onChangeCallback?: (type: 'insert' | 'delete', content: string, position: number) => void;
  private onCursorChange?: (position: number) => void;
  private onContentUpdate?: () => void;
  private isApplyingRemoteChange: boolean = false;

  constructor(containerId: string, onCursorChange?: (position: number) => void, onContentUpdate?: () => void, onChange?: (type: 'insert' | 'delete', content: string, position: number) => void) {
    this.onCursorChange = onCursorChange; // called in main.ts to update cursor position
    this.onContentUpdate = onContentUpdate; // called in ui.ts to reattach detached cursors
    this.onChangeCallback = onChange; // called in main.ts to send change to websocket
    const containerElement = document.getElementById(containerId);
    if (!containerElement) {
      throw new Error(`Editor container with id '${containerId}' not found`);
    }

    function posFromLineCol(state: EditorState, line?: number, col?: number) {
      const l = state.doc.line(line ?? 1);
      const c = Math.max(0, (col ?? 1) - 1);
      return l.from + c;
    }
    // create linter 
    const codeLinter = linter(async (view) => {
      const code = view.state.doc.toString();

      const messages = eslint.verify(code, flatConfig, {
        filename: "virtual.js",                                  // <- any label you want
      });

      const diagnostics: Diagnostic[] = messages.map((m: any) => {
        const from = posFromLineCol(view.state, m.line, m.column);
        const to = posFromLineCol(view.state, m.endLine ?? m.line, m.endColumn ?? m.column);
        return {
          from,
          to: Math.max(from, to),
          message: m.message,
          severity: m.severity === 2 ? "error" : "warning",
          source: m.ruleId || "eslint",
        };
      });

      console.log("DIAGNOSTICS", diagnostics)
      return diagnostics;
    }, { delay: 350 })

    // Initialize CodeMirror editor
    const startState = EditorState.create({
      doc: "",
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        codeLinter,
        lintGutter(),
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
            this.onCursorChange?.(position); // update position
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

  // (NO LONGER USED) Find difference between old and new text
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

  // (NO LONGER USED) Handle local content changes
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

  async run(): Promise<RunResponse | null> {
    try {
      const response = await fetch('https://collabcode-production-b41e.up.railway.app/api/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          language: 'javascript',
          code: this.lastContent
        })
      })
  
      const result = await response.json()
  
      return result
    } catch(e) {
      console.error("Error running code", e)
      return null
    }
  }
}
