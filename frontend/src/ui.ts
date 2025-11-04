import { CursorManager } from "./cursor";
import { TextEditor } from "./editor";

export class UIManager {
  private output: HTMLElement;
  private nameInput: HTMLInputElement;
  private cursorManager: CursorManager;
  private textEditor: TextEditor;

  constructor(
    onCursorChange?: (position: number) => void, 
    onChange?: (type: 'insert' | 'delete', content: string, position: number) => void
  ) {
    this.output = document.getElementById("output") as HTMLSpanElement;
    this.cursorManager = new CursorManager('editor');
    this.nameInput = document.getElementById('nameInput') as HTMLInputElement;
    this.textEditor = new TextEditor('editor', 
      onCursorChange,
      () => this.cursorManager.reattachDetachedCursors(),
      onChange
    );
    // Set the editor view in cursor manager after editor is created
    const editorView = this.textEditor.getEditorView();
    if (editorView) {
      this.cursorManager.setEditorView(editorView);
    }

    this.setupUIEventListeners();
  }

  private setupUIEventListeners(): void {
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const dropdownMenu = document.getElementById('dropdownMenu');
      const dropdownMenuBtn = document.getElementById('dropdownMenuBtn');
      if (!dropdownMenu || !dropdownMenuBtn) return;
      
      const target = e.target as HTMLElement;
      if (!dropdownMenu.contains(target) && !dropdownMenuBtn.contains(target)) {
        dropdownMenu.classList.add('hidden');
      }
    });
    
    // Setup Enter key handler for name input
    if (this.nameInput) {
      this.nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const saveNameBtn = document.getElementById('saveNameBtn');
          saveNameBtn?.click();
        }
      });
    }
  }


  getRoomInput(): string {
    const roomInput = document.getElementById("roomInput") as HTMLInputElement;
    return roomInput?.value || "";
  }

  updateRemoteCursorPosition(userId: string, position: number): void {
    this.cursorManager.updateRemoteCursorPosition(userId, position);
  }

  removeRemoteCursor(userId: string): void {
    this.cursorManager.removeCursor(userId);
  }

  clearAllCursors(): void {
    this.cursorManager.clearAllCursors()
  }

  reattachDetachedCursors(): void {
    this.cursorManager.reattachDetachedCursors();
  }

  handleRemoteChange(type: 'insert' | 'delete' | 'cursor', content: string, position: number): void {
    this.textEditor.handleRemoteChange(type, content, position);
  }

  updateNameInput(username: string): void {
    if (this.nameInput) {
      this.nameInput.value = username;
    }
  }

  async run(): Promise<void> {
    const result = await this.textEditor.run();
    if (result == null) {
      return;
    }
    if (result.exit_code !== 0) {
      this.output.textContent = `Error: ${result.output}`;
      return;
    }
    this.output.textContent = result.output
  }

  clearEditor(): void {
    this.textEditor.clear();
  }
}
