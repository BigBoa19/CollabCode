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
			log.Printf(" lient %s added to room %s (total clients: %d)", client.ID, roomID, len(h.Rooms[roomID].Clients))

			// Send existing document content to the new client
			if h.Rooms[roomID].Document.Content != "" {
				client.Send <- NewMessage(MessageTypeInsert, h.Rooms[roomID].Document.Content, 0, client.ID)
			}
		case client := <-h.Unregister: // when a client wants to unregister
			room := client.Room
			if room != nil {
				// Broadcast leave message to other clients before removing
				leaveMessage := NewMessage(MessageTypeLeave, "", 0, client.ID)
				for otherClient := range room.Clients {
					if otherClient.ID != client.ID {
						select {
						case otherClient.Send <- leaveMessage:
							// Message sent
						default:
							// Channel blocked, skip
						}
					}
				}

				delete(room.Clients, client) // remove the client from the room
				close(client.Send)           // close the client's send channel
				log.Printf("Client %s left room %s (remaining clients: %d)", client.ID, room.ID, len(room.Clients))
			}
			if len(room.Clients) == 0 { // room is empty, so delete the room
				delete(h.Rooms, room.ID)
			}
		}
	}
}
