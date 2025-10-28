export type MessageType = 'insert' | 'delete' | 'cursor' | 'join' | 'leave';

export interface Message {
  type: MessageType;
  content: string;
  position: number;
  user_id: string;
  timestamp: number;
}

export interface DiffResult {
  type: 'insert' | 'delete';
  content: string;
  position: number;
}