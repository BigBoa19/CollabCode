import type { Message } from './types';
import { WebSocketManager } from './websocket';
import { UIManager } from './ui';
import './output.css';

// main class
class CollaborativeTextEditor {
  private wsManager: WebSocketManager;
  private uiManager: UIManager;

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
      (connected) => this.handleStatusChange(connected),
      () => this.updateUserInfo()
    );

    this.setupEventListeners();
    this.initialize();
  }

  private setupEventListeners(): void {
    // Make functions globally available for onclick handlers
    (window as any).connect = () => this.connect();
    (window as any).disconnect = () => this.disconnect();
    (window as any).run = () => this.uiManager.run();
    
    window.addEventListener('beforeunload', () => {
      this.disconnect();
    });
    
  }

  private initialize(): void {
    const id  = location.hash.replace(/^#\/?/, '');
    this.wsManager.connect(id);
    this.updateUserInfo();
    console.log("🚀 Collaborative Text Editor loaded. Ready to connect!");
  }

  private connect(): void {
    const roomId = this.uiManager.getRoomInput();
    this.wsManager.connect(roomId);
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

  private handleStatusChange(connected: boolean): void {
    const message = connected 
      ? `✅ Connected to room: ${this.wsManager.currentRoomId}`
      : "❌ Disconnected";
    
    this.uiManager.updateStatus(message, connected);
    this.uiManager.updateConnectionButtons(connected);
    
    if (connected) {
      console.log(`✅ Connected to room "${this.wsManager.currentRoomId}"`);
    } else {
      console.log("❌ Connection closed");
    }
  }

  private updateUserInfo(): void {
    this.uiManager.updateUserInfo(
      this.wsManager.currentUserId,
      this.wsManager.currentRoomId,
    );
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new CollaborativeTextEditor();
});