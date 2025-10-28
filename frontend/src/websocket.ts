import type { Message } from './types';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private roomId: string = "";
  private userId: string | null = null;
  private messagesSent: number = 0;
  private messagesReceived: number = 0;

  // Callbacks for external handlers
  private onMessageHandler?: (message: Message) => void;
  private onStatusChange?: (connected: boolean) => void;
  private onUserInfoChange?: () => void;

  constructor(
    onMessage?: (message: Message) => void,
    onStatusChange?: (connected: boolean) => void,
    onUserInfoChange?: () => void
  ) {
    this.onMessageHandler = onMessage;
    this.onStatusChange = onStatusChange;
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
    const wsUrl = `${baseUrl}/ws/${this.roomId}`;
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.onStatusChange?.(true);
      };

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

      this.ws.onclose = () => {
        this.onStatusChange?.(false);
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
      alert("Not connected to WebSocket");
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
      this.userId = message.content;
      this.onUserInfoChange?.();
    }
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
