package main

import (
	"log"
	"time"
)

type Room struct {
	ID        string
	Clients   map[*Client]bool
	Broadcast chan *Message
	Hub       *Hub
	Document  *Document
}

func NewRoom(h *Hub, roomID string) *Room {
	room := &Room{
		ID:        roomID,
		Clients:   make(map[*Client]bool),
		Broadcast: make(chan *Message),
		Hub:       h,
		Document:  &Document{Content: "", LastModified: time.Now()},
	}

	// Load existing document
	room.loadDocument()

	return room
}

func (room *Room) Run() {
	for {
		select {
		case message := <-room.Broadcast: // new message needs to be broadcast
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
