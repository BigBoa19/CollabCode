import type { Message } from './types';
import { WebSocketManager } from './websocket';
import { UIManager } from './ui';
import './output.css';

// main class
class CollaborativeTextEditor {
  private wsManager: WebSocketManager;
  private uiManager: UIManager;
  private username: string = "";

  constructor() {
    this.uiManager = new UIManager(
      (position) => this.handleCursorChange(position),
      (type, content, position) => {
        this.wsManager.sendMessage(type, content, position);
        console.log(`📤 Sent: ${type} "${content}" at position ${position}`);
      }
    );
    
    this.wsManager = new WebSocketManager(
      (message) => this.handleMessage(message),
      (username) => this.updateUserInfo(username)
    );

    this.setupEventListeners();
    this.initialize();
  }

  private setupEventListeners(): void {
    // Make functions globally available for onclick handlers
    (window as any).run = () => this.uiManager.run();
    (window as any).copyLink = () => this.copyLink();
    (window as any).toggleDropdown = (event?: Event) => this.toggleDropdown(event);
    (window as any).saveName = () => this.saveName();

    window.addEventListener('beforeunload', () => {
      this.disconnect();
    });
  }

  private toggleDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const dropdownMenu = document.getElementById('dropdownMenu');
    if (dropdownMenu) {
      dropdownMenu.classList.toggle('hidden');
    }
  }

  private saveName(): void {
    const nameInput = document.getElementById('nameInput') as HTMLInputElement;
    if (!nameInput) return;
    
    const newName = nameInput.value.trim();
    if (newName) {
      // Close dropdown
      const dropdownMenu = document.getElementById('dropdownMenu');
      if (dropdownMenu) {
        dropdownMenu.classList.add('hidden');
      }
      // Handle the save
      this.handleNameSave(newName);
    }
  }

  private handleNameSave(newName: string): void {
    this.username = newName;
    this.updateUserInfo(newName);
    // Force page refresh to reconnect with new user_id
    window.location.reload();
  }

  private copyLink(): void {
    const link = window.location.href;
    navigator.clipboard.writeText(link);
    console.log("Copied link to clipboard: ", link);
  }

  private initialize(): void {
    let id  = location.hash.replace(/^#\/?/, '');
    if (!id || id.length == 0 || id === "") {
      console.log("No initial ID")
      id = generateRoomId();
      window.location.hash = id;
    } 
    this.username = this.getSavedUsername() || "No User";
    this.wsManager.connect(id);
    
    // Set initial name in UI
    this.uiManager.updateNameInput(this.username);
    
    console.log("🚀 Collaborative Text Editor loaded. Ready to connect!");
  }

  private disconnect(): void {
    this.wsManager.disconnect();
    this.uiManager.clearEditor();
    this.uiManager.clearAllCursors();
  }


  // outgoing
  private handleCursorChange(position: number): void {
    this.wsManager.sendMessage('cursor', '', position);
    console.log(`📤 Sent cursor position: ${position}`);
  }

  // handle purely INCOMING messages
  private handleMessage(message: Message): void {
    if (message.type === "insert" || message.type === "delete") {
      console.log(`INCOMING: Handling remote ${message.type}: "${message.content}" at position ${message.position}`);
      this.uiManager.handleRemoteChange(message.type, message.content, message.position);
    } else if (message.type === "cursor") {
      console.log(`INCOMING: Received cursor position: ${message.position} from user ${message.user_id}`);
      this.uiManager.updateRemoteCursorPosition(message.user_id, message.position)
    } else if (message.type === "leave") {
      console.log(`INCOMING: User ${message.user_id} left the room`);
      this.uiManager.removeRemoteCursor(message.user_id);
    } 
  }

  private updateUserInfo(username: string): void {
    console.log("Updating user info to: ", username)
    this.username = username;
    this.uiManager.updateNameInput(this.username);
    this.wsManager.updateUserID(this.username);
    this.saveUsername(this.username)
  }

  private saveUsername(username: string): void {
    try {
      localStorage.setItem('username', username);
    } catch (error) {
      console.warn("Failed to save username")
    }
  }

  private getSavedUsername(): string {
    try {
      const saved = localStorage.getItem('username');
      if (saved) {
        this.username = saved;
        this.wsManager.updateUserID(saved);
      }
      console.log("Username: ", this.username)
      return saved || "";
    } catch (error) {
      console.warn("Failed to read username");
      return "";
    }
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new CollaborativeTextEditor();
});

function generateRoomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const array = new Uint8Array(8); // 8 characters
  crypto.getRandomValues(array); // More secure than Math.random()
  
  for (let i = 0; i < 8; i++) {
    result += chars[array[i] % chars.length];
  }
  console.log("generated", result)
  return result;
}