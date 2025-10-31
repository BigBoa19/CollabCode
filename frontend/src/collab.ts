import { sendableUpdates, receiveUpdates, getSyncedVersion, type Update } from '@codemirror/collab';
import { ChangeSet, EditorState, Transaction } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

export interface CollabUpdate {
  version: number;
  changes: string; // JSON stringified ChangeSet
  clientID: string;
}

export interface CollabPullRequest {
  type: 'pull';
  version: number;
  user_id: string;
}

export interface CollabPushMessage {
  type: 'push';
  updates: CollabUpdate[]; // Array of updates
  version: number; // Version these updates are based on
  user_id: string;
}

export interface CollabVersionResponse {
  type: 'version';
  version: number;
  content?: string; // Initial document content
}

export interface CollabUpdatesResponse {
  type: 'updates';
  version: number; // Current server version
  updates: CollabUpdate[];
}

export type CollabMessage = CollabPullRequest | CollabPushMessage | CollabVersionResponse | CollabUpdatesResponse;

export class CollabManager {
  private onPush?: (updates: CollabUpdate[], version: number) => void;
  private onPull?: (version: number) => void;
  private pendingPull: number | null = null;

  constructor(
    onPush?: (updates: CollabUpdate[], version: number) => void,
    onPull?: (version: number) => void
  ) {
    this.onPush = onPush;
    this.onPull = onPull;
  }

  // Send local changes to server
  pushChanges(view: EditorView): void {
    const updates = sendableUpdates(view.state);
    if (updates.length === 0) return;

    // Get the version we're pushing from
    const version = getSyncedVersion(view.state);

    // Convert updates to CollabUpdate format
    const collabUpdates: CollabUpdate[] = updates.map(update => ({
      version,
      changes: JSON.stringify(update.changes.toJSON()),
      clientID: update.clientID,
    }));

    // Send all updates
    if (collabUpdates.length > 0 && this.onPush) {
      this.onPush(collabUpdates, version);
    }
  }

  // Apply updates received from server
  applyUpdates(state: EditorState, updates: CollabUpdate[]): Transaction | null {
    if (updates.length === 0) return null;

    try {
      // Parse ChangeSets from JSON and create Update objects
      const parsedUpdates: Update[] = updates.map(update => {
        const changesJSON = JSON.parse(update.changes);
        const changes = ChangeSet.fromJSON(changesJSON);
        return {
          changes,
          clientID: update.clientID,
        };
      });

      // Use CodeMirror's receiveUpdates to create transaction
      const transaction = receiveUpdates(state, parsedUpdates);
      
      return transaction;
    } catch (error) {
      console.error('Error applying collab updates:', error);
      return null;
    }
  }

  // Request updates from server
  requestPull(version: number): void {
    if (this.onPull) {
      this.pendingPull = version;
      this.onPull(version);
    }
  }

  // Handle version response from server (initial connection)
  handleVersionResponse(view: EditorView, version: number, content?: string): void {
    if (content !== undefined && content !== view.state.doc.toString()) {
      // Set initial content
      const transaction = view.state.update({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: content,
        },
      });
      view.dispatch(transaction);
    }
    
    // Request any updates since the version we received
    this.requestPull(version);
  }

  // Handle updates response from server (after pull request or broadcast)
  handleUpdatesResponse(view: EditorView, updates: CollabUpdate[]): boolean {
    if (updates.length === 0) {
      if (this.pendingPull !== null) {
        // No updates, we're in sync
        this.pendingPull = null;
      }
      return false;
    }

    // Apply updates regardless of whether there's a pending pull
    // (could be a broadcast from server or response to pull)
    const transaction = this.applyUpdates(view.state, updates);
    if (transaction) {
      view.dispatch(transaction);
      if (this.pendingPull !== null) {
        this.pendingPull = null;
      }
      return true;
    }
    
    return false;
  }
}

