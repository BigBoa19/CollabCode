package main

import (
	"encoding/json"
	"time"
	"errors"
)

type MessageType string

const (
	MessageTypeInsert = "insert"
	MessageTypeDelete = "delete"
	MessageTypeCursor = "cursor"
	MessageTypeJoin = "join"
	MessageTypeLeave = "leave"
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
		Type: msgType,
		Content: content,
		Position: position,
		UserID: userID,
		Timestamp: time.Now().UnixNano(),
	}
}

// Converts Message struct to JSON form
func (m *Message) ToJSON() ([]byte, error) {
	return json.Marshal(m)
}

func ParseMessage(data [] byte) (*Message, error) {
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