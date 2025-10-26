package main

import (
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Client struct {
	ID   string
	Conn *websocket.Conn
	Send chan *Message
	Room *Room
	mu   sync.Mutex
}

func (c *Client) readPump() {
	defer func() {
		c.Room.Hub.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadDeadline(time.Now().Add(360 * time.Second))
	c.Conn.SetPingHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, p, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}
		msg, err := ParseMessage(p)
		if err != nil {
			log.Printf("ERROR: Failed to parse message: %v", err)
			continue
		}
		c.Room.Broadcast <- msg
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)

	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.mu.Lock()
			jsonMessage, _ := message.ToJSON()
			c.Conn.WriteMessage(websocket.TextMessage, jsonMessage)
			c.mu.Unlock()
		case <-ticker.C:
			c.mu.Lock()
			c.Conn.WriteMessage(websocket.PingMessage, nil)
			c.mu.Unlock()
		}
	}
}
