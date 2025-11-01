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

export interface RunResponse {
  output: string;
  exit_code: number;
  duration_ms: number;
}