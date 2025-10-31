package main

import (
	"encoding/json"
	"errors"
	"time"
)

type MessageType string

const (
	MessageTypeInsert = "insert"
	MessageTypeDelete = "delete"
	MessageTypeCursor = "cursor"
	MessageTypeJoin   = "join"
	MessageTypeLeave  = "leave"
	// Collab message types
	MessageTypePull    = "pull"
	MessageTypePush    = "push"
	MessageTypeVersion = "version"
	MessageTypeUpdates = "updates"
)

type Message struct {
	Type      MessageType `json:"type"`
	Content   string      `json:"content"`
	Position  int         `json:"position"`
	UserID    string      `json:"user_id"`
	Timestamp int64       `json:"timestamp"`
}

func NewMessage(msgType MessageType, content string, position int, userID string) *Message {
	return &Message{
		Type:      msgType,
		Content:   content,
		Position:  position,
		UserID:    userID,
		Timestamp: time.Now().UnixNano(),
	}
}

// Converts Message struct to JSON form
func (m *Message) ToJSON() ([]byte, error) {
	return json.Marshal(m)
}

func ParseMessage(data []byte) (*Message, error) {
	var msg Message
	err := json.Unmarshal(data, &msg)
	if err != nil {
		return nil, err
	}

	if msg.Type == "" || msg.UserID == "" {
		return nil, errors.New("invalid message: missing required fields")
	}

	return &msg, nil
}

// Collab message structures
type CollabUpdate struct {
	Version  int    `json:"version"`
	Changes  string `json:"changes"` // JSON stringified ChangeSet
	ClientID string `json:"clientID"`
}

type CollabMessage struct {
	Type    MessageType    `json:"type"`
	Version int            `json:"version,omitempty"`
	Updates []CollabUpdate `json:"updates,omitempty"`
	Content string         `json:"content,omitempty"`
	UserID  string         `json:"user_id"`
}

func NewCollabVersionMessage(version int, content string, userID string) *CollabMessage {
	return &CollabMessage{
		Type:    MessageTypeVersion,
		Version: version,
		Content: content,
		UserID:  userID,
	}
}

func NewCollabUpdatesMessage(version int, updates []CollabUpdate, userID string) *CollabMessage {
	return &CollabMessage{
		Type:    MessageTypeUpdates,
		Version: version,
		Updates: updates,
		UserID:  userID,
	}
}

func (m *CollabMessage) ToJSON() ([]byte, error) {
	return json.Marshal(m)
}

func ParseCollabMessage(data []byte) (*CollabMessage, error) {
	var msg CollabMessage
	err := json.Unmarshal(data, &msg)
	if err != nil {
		return nil, err
	}

	if msg.Type == "" || msg.UserID == "" {
		return nil, errors.New("invalid collab message: missing required fields")
	}

	return &msg, nil
}
