import { CursorManager } from "./cursor";
import { TextEditor } from "./editor";

export class UIManager {
  private statusElement: HTMLDivElement; // connection status
  private userIdElement: HTMLSpanElement; // user id
  private currentRoomElement: HTMLSpanElement; // current room
  private cursorManager: CursorManager;
  private textEditor: TextEditor;

  constructor(onCursorChange?: (position: number) => void, onChange?: (type: 'insert' | 'delete', content: string, position: number) => void) {
    this.statusElement = document.getElementById("status") as HTMLDivElement;
    this.userIdElement = document.getElementById("userId") as HTMLSpanElement;
    this.currentRoomElement = document.getElementById("currentRoom") as HTMLSpanElement;
    this.cursorManager = new CursorManager('editor');
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

    if (!this.statusElement || !this.userIdElement || !this.currentRoomElement) {
      throw new Error("Required DOM elements not found");
    }
  }

  updateStatus(message: string, connected: boolean): void {
    this.statusElement.textContent = message;
    this.statusElement.className = connected 
      ? "p-4 rounded mb-5 font-bold text-center bg-green-100 text-green-800 border border-green-200"
      : "p-4 rounded mb-5 font-bold text-center bg-red-100 text-red-800 border border-red-200";
  }

  updateUserInfo(userId: string | null, roomId: string): void {
    this.userIdElement.textContent = userId || "Not connected";
    this.currentRoomElement.textContent = roomId || "None";
  }

  updateConnectionButtons(connected: boolean): void {
    const connectBtn = document.getElementById("connectBtn") as HTMLButtonElement;
    const disconnectBtn = document.getElementById("disconnectBtn") as HTMLButtonElement;
    
    if (connectBtn && disconnectBtn) {
      connectBtn.disabled = connected;
      disconnectBtn.disabled = !connected;
    }
  }

  getRoomInput(): string {
    const roomInput = document.getElementById("roomInput") as HTMLInputElement;
    return roomInput?.value || "";
  }

  updateRemoteCursorPosition(userId: string, position: number): void {
    this.cursorManager.updateRemoteCursorPosition(userId, position);
  }

  clearAllCursors(): void {
    this.cursorManager.clearAllCursors()
  }

  reattachDetachedCursors(): void {
    this.cursorManager.reattachDetachedCursors();
  }

  // TextEditor methods
  // Note: With CodeMirror, changes are automatically tracked via the onChange callback
  // This method is kept for compatibility but may not be needed
  handleEditorChange(_onChange: (type: 'insert' | 'delete', content: string, position: number) => void): void {
    // CodeMirror handles change tracking automatically through the callback
    // This is a no-op now, but kept for API compatibility
  }

  handleRemoteChange(type: 'insert' | 'delete' | 'cursor', content: string, position: number): void {
    this.textEditor.handleRemoteChange(type, content, position);
  }

  updateCursorPosition(): void {
    this.textEditor.updateCursorPosition();
  }

  clearEditor(): void {
    this.textEditor.clear();
  }
}
