package main

import "log"

type Hub struct {
	Rooms      map[string]*Room
	Register   chan *Client
	Unregister chan *Client
}

func NewHub() *Hub {
	return &Hub{
		Rooms:      make(map[string]*Room),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register: // when a new client wants to register
			roomID := client.Room.ID
			room := h.Rooms[roomID]
			if room == nil { // room doesn't exist, so make a new one
				room := NewRoom(h, roomID)
				h.Rooms[roomID] = room
				go room.Run()
			}
			// now, add the client to the room
			h.Rooms[roomID].Clients[client] = true
			client.Room = h.Rooms[roomID]
			log.Printf("Client %s added to room %s (total clients: %d)", client.ID, roomID, len(h.Rooms[roomID].Clients))

			// Send join message with client ID (legacy)
			welcomeMsg := NewMessage(MessageTypeJoin, client.ID, 0, "server")
			client.Send <- welcomeMsg

			// Send version response with current document state (collab)
			version, content := h.Rooms[roomID].GetVersionInfo()
			versionMsg := NewCollabVersionMessage(version, content, "server")
			client.CollabSend <- versionMsg
		case client := <-h.Unregister: // when a client wants to unregister
			room := client.Room
			if room != nil {
				delete(room.Clients, client) // remove the client from the room
				// Close channels safely (check if already closed)
				select {
				case <-client.Send:
				default:
					close(client.Send)
				}
				select {
				case <-client.CollabSend:
				default:
					close(client.CollabSend)
				}
			}
			if room != nil && len(room.Clients) == 0 { // room is empty, so delete the room
				delete(h.Rooms, room.ID)
			}
		}
	}
}
