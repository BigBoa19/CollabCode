import type { Message } from './types';
import { WebSocketManager } from './websocket';
import { UIManager } from './ui';
import type { CollabMessage, CollabUpdate } from './collab';
import './output.css';

// main class
class CollaborativeTextEditor {
  private wsManager: WebSocketManager;
  private uiManager: UIManager;
  private clientID: string = '';
  private startVersion: number = 0;

  constructor() {
    // Generate a temporary client ID (will be replaced by server)
    this.clientID = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.uiManager = new UIManager(
      this.clientID,
      this.startVersion,
      (position) => this.handleCursorChange(position),
      (updates, version) => this.handleCollabPush(updates, version),
      (version) => this.handleCollabPull(version)
    );
    
    this.wsManager = new WebSocketManager(
      (message) => this.handleMessage(message),
      (connected) => this.handleStatusChange(connected),
      () => this.updateUserInfo(),
      (message) => this.handleCollabMessage(message)
    );

    this.setupEventListeners();
    this.initialize();
  }

  private setupEventListeners(): void {
    // Make functions globally available for onclick handlers
    (window as any).connect = () => this.connect();
    (window as any).disconnect = () => this.disconnect();
    // Note: handleEditorChange and updateCursorPosition are now handled automatically by CodeMirror
    (window as any).handleEditorChange = () => this.handleEditorChange();
    (window as any).updateCursorPosition = () => this.uiManager.updateCursorPosition();
  }

  private initialize(): void {
    this.updateUserInfo();
    console.log("🚀 Collaborative Text Editor loaded. Ready to connect!");
  }

  private connect(): void {
    const roomId = this.uiManager.getRoomInput();
    // Reset version on new connection
    this.startVersion = 0;
    this.wsManager.connect(roomId);
    // Request initial version from server (will be handled by server's version message)
    
    // Set up periodic pull to stay in sync (every 2 seconds)
    clearInterval((this as any).pullInterval);
    (this as any).pullInterval = setInterval(() => {
      if (this.wsManager.isConnected) {
        // Pull updates to stay in sync
        const currentVersion = this.startVersion; // This should be updated when we receive updates
        this.handleCollabPull(currentVersion);
      }
    }, 2000);
  }

  private disconnect(): void {
    clearInterval((this as any).pullInterval);
    this.wsManager.disconnect();
    this.uiManager.clearEditor();
    this.uiManager.clearAllCursors();
  }

  // outgoing
  private handleEditorChange(): void {
    this.uiManager.handleEditorChange((type, content, position) => {
      this.wsManager.sendMessage(type, content, position);
      console.log(`📤 Sent: ${type} "${content}" at position ${position}`);
    });
  }

  // outgoing
  private handleCursorChange(position: number): void {
    this.wsManager.sendMessage('cursor', '', position);
    console.log(`📤 Sent cursor position: ${position}`);
  }

  // handle purely INCOMING messages (legacy format)
  private handleMessage(message: Message): void {
    if (message.type === "join") {
      // Update client ID if server provides one
      if (message.content) {
        this.clientID = message.content;
      }
    } else if (message.type === "cursor") {
      console.log(`INCOMING: Received cursor position: ${message.position} from user ${message.user_id}`);
      this.uiManager.updateRemoteCursorPosition(message.user_id, message.position);
    }
  }

  // Handle collab messages
  private handleCollabMessage(message: CollabMessage): void {
    if (message.type === 'version') {
      console.log(`📥 Received version: ${message.version}`);
      this.startVersion = message.version;
      this.uiManager.handleVersionResponse(message.version, message.content);
    } else if (message.type === 'updates') {
      console.log(`📥 Received updates: version ${message.version}, ${message.updates.length} updates`);
      const applied = this.uiManager.applyCollabUpdates(message.updates);
      if (applied && message.version > this.startVersion) {
        // Update our version tracking after applying updates
        this.startVersion = message.version;
      }
    }
  }

  // Handle collab push (send local changes to server)
  private handleCollabPush(updates: CollabUpdate[], version: number): void {
    console.log(`📤 Pushing ${updates.length} updates at version ${version}`);
    this.wsManager.sendCollabPush(updates, version);
  }

  // Handle collab pull (request updates from server)
  private handleCollabPull(version: number): void {
    console.log(`📤 Pulling updates since version ${version}`);
    this.wsManager.sendCollabPull(version);
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