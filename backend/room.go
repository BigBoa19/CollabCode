package main

import (
	"log"
	"sync"
	"time"
)

type Room struct {
	ID        string
	Clients   map[*Client]bool
	Broadcast chan *Message
	Hub       *Hub
	Document  *Document
	// Collab fields
	Version    int
	ChangeLog  []CollabUpdate
	CollabChan chan *CollabMessage
	mu         sync.Mutex // Mutex for version and changelog access
}

func NewRoom(h *Hub, roomID string) *Room {
	room := &Room{
		ID:         roomID,
		Clients:    make(map[*Client]bool),
		Broadcast:  make(chan *Message),
		Hub:        h,
		Document:   &Document{Content: "", LastModified: time.Now()},
		Version:    0,
		ChangeLog:  make([]CollabUpdate, 0),
		CollabChan: make(chan *CollabMessage, 256),
	}

	// Load existing document
	room.loadDocument()

	return room
}

func (room *Room) Run() {
	for {
		select {
		case message := <-room.Broadcast: // legacy message format
			room.applyOperation(message)

			for client := range room.Clients {
				if client.ID == message.UserID {
					continue
				}
				select {
				case client.Send <- message:
					// Message Sent
				default: // channel is full/blocked, remove client
					close(client.Send)
					delete(room.Clients, client)
				}
			}
		case collabMsg := <-room.CollabChan: // collab message
			room.handleCollabMessage(collabMsg)
		}
	}
}

func (room *Room) applyOperation(message *Message) {
	switch message.Type {
	case MessageTypeInsert:
		log.Printf("Applying insert operation: \"%s\" to position: %d", message.Content, message.Position)
		content := message.Content
		position := room.validatePosition(message.Position)
		room.Document.Content = room.Document.Content[:position] + content + room.Document.Content[position:]
		room.Document.LastModified = time.Now()
		room.saveDocument()
	case MessageTypeDelete:
		log.Printf("Applying delete operation:\"%s\" to position: %d", message.Content, message.Position)
		content := message.Content
		position := room.validatePosition(message.Position)
		endPos := position + len(content)
		if endPos > len(room.Document.Content) {
			endPos = len(room.Document.Content)
		}
		room.Document.Content = room.Document.Content[:position] + room.Document.Content[endPos:]
		room.Document.LastModified = time.Now()
		room.saveDocument()
	case MessageTypeCursor:
		log.Printf("Received cursor position: %d from user: %s", message.Position, message.UserID)
		// Cursor messages don't modify the document, just broadcast to other clients
	}
}

func (room *Room) validatePosition(position int) int {
	if position < 0 {
		return 0
	}
	if position > len(room.Document.Content) {
		return len(room.Document.Content)
	}
	return position
}

// Collab handlers
func (room *Room) handleCollabMessage(msg *CollabMessage) {
	room.mu.Lock()
	defer room.mu.Unlock()

	switch msg.Type {
	case MessageTypePull:
		room.handlePull(msg)
	case MessageTypePush:
		room.handlePush(msg)
	}
}

func (room *Room) handlePull(msg *CollabMessage) {
	requestedVersion := msg.Version
	log.Printf("Pull request from %s: version %d (current: %d)", msg.UserID, requestedVersion, room.Version)

	// Find updates since requested version
	updates := make([]CollabUpdate, 0)
	for i := requestedVersion; i < room.Version && i < len(room.ChangeLog); i++ {
		if i >= 0 {
			updates = append(updates, room.ChangeLog[i])
		}
	}

	// Send updates response to requesting client through channel
	for client := range room.Clients {
		if client.ID == msg.UserID {
			response := NewCollabUpdatesMessage(room.Version, updates, "server")
			select {
			case client.CollabSend <- response:
				// Message sent successfully
			default:
				// Channel is full, client might be slow - log but don't block
				log.Printf("Warning: CollabSend channel full for client %s", client.ID)
			}
			break
		}
	}
}

func (room *Room) handlePush(msg *CollabMessage) {
	log.Printf("Push from %s: %d updates at version %d (current: %d)", msg.UserID, len(msg.Updates), msg.Version, room.Version)

	// If client version is way behind, reject and tell them to pull first
	if msg.Version < room.Version-len(room.ChangeLog) {
		log.Printf("Client %s version %d too far behind (current: %d), requesting pull", msg.UserID, msg.Version, room.Version)
		// Send them a pull request instruction (they should pull)
		for client := range room.Clients {
			if client.ID == msg.UserID {
				// Send them all updates since version 0
				allUpdates := make([]CollabUpdate, 0)
				for i := 0; i < len(room.ChangeLog) && i < room.Version; i++ {
					if i >= 0 && i < len(room.ChangeLog) {
						allUpdates = append(allUpdates, room.ChangeLog[i])
					}
				}
				response := NewCollabUpdatesMessage(room.Version, allUpdates, "server")
				select {
				case client.CollabSend <- response:
				default:
					log.Printf("Warning: Could not send updates to client %s", client.ID)
				}
				break
			}
		}
		return
	}

	// Accept the push and increment version
	for _, update := range msg.Updates {
		room.Version++
		update.Version = room.Version
		room.ChangeLog = append(room.ChangeLog, update)
	}

	// Broadcast updates to ALL clients including sender (sender needs confirmation)
	response := NewCollabUpdatesMessage(room.Version, msg.Updates, "server")
	for client := range room.Clients {
		select {
		case client.CollabSend <- response:
			// Message sent successfully
		default:
			// Channel is full, client might be slow - log but don't close (might be temporary)
			log.Printf("Warning: CollabSend channel full for client %s", client.ID)
		}
	}
}

// Get current version and content for new client
func (room *Room) GetVersionInfo() (int, string) {
	room.mu.Lock()
	defer room.mu.Unlock()
	return room.Version, room.Document.Content
}
