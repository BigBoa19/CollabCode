import type { Message } from './types';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private roomId: string = "";
  private userId: string = "empty_user_id_!";
  private messagesSent: number = 0;
  private messagesReceived: number = 0;

  // Callbacks for external handlers
  private onMessageHandler?: (message: Message) => void;
  private onUserInfoChange?: (username: string) => void;

  constructor(
    onMessage?: (message: Message) => void,
    onUserInfoChange?: (username: string) => void
  ) {
    this.onMessageHandler = onMessage;
    this.onUserInfoChange = onUserInfoChange;
  }

  connect(roomId: string): void {
    this.roomId = roomId.trim();
    if (!this.roomId) {
      alert("Please enter a room ID");
      return;
    }

    // Use production URL or fallback to localhost for development
    const baseUrl = 'wss://collabcode-production-b41e.up.railway.app';
    const devBaseUrl = 'ws://localhost:8080';
    const wsUrl = `${devBaseUrl}/ws/${this.roomId}?user_id=${this.userId}`;
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = (event: MessageEvent) => {
        this.messagesReceived++;
        try {
          const message: Message = JSON.parse(event.data);
          this.handleMessage(message);
          this.onMessageHandler?.(message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      this.ws.onerror = (error: Event) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Connection failed:', error);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  sendMessage(type: Message['type'], content: string, position: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: Message = {
      type,
      content,
      position,
      user_id: this.userId || "",
      timestamp: Date.now(),
    };

    this.ws.send(JSON.stringify(message));
    this.messagesSent++;
  }

  private handleMessage(message: Message): void {
    if (message.type === "join") {
      console.log(message.content)
      this.userId = message.content;
      this.onUserInfoChange?.(this.userId);
    }
  }

  updateUserID(username: string): void {
    console.log("ran")
    this.userId = username;
  }

  // Getters
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get currentRoomId(): string {
    return this.roomId;
  }

  get currentUserId(): string | null {
    return this.userId;
  }

  get connectionUrl(): string {
    if (!this.ws) return "";
    const baseUrl = 'wss://collabcode-production-b41e.up.railway.app';
    return `${baseUrl}/ws/${this.roomId}`;
  }

  get stats() {
    return {
      sent: this.messagesSent,
      received: this.messagesReceived
    };
  }
}
