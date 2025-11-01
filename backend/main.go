package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func handleWebSocket(hub *Hub, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	roomID := vars["roomID"]

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	client := &Client{
		ID:   "user-" + time.Now().Format("0405"),
		Conn: conn,
		Send: make(chan *Message, 256),
		Room: &Room{ID: roomID},
	}

	hub.Register <- client
	log.Printf("Client %s registered for room %s", client.ID, roomID)

	// Send the client ID to the frontend
	welcomeMsg := NewMessage(MessageTypeJoin, client.ID, 0, "server")
	jsonMsg, _ := welcomeMsg.ToJSON()
	client.Conn.WriteMessage(websocket.TextMessage, jsonMsg)

	go client.readPump()
	go client.writePump()
}

func main() {
	log.Println("Starting Server!")
	Hub := NewHub()
	go Hub.Run()

	r := mux.NewRouter()

	r.HandleFunc("/ws/{roomID}", func(w http.ResponseWriter, r *http.Request) {
		handleWebSocket(Hub, w, r)
	})

	// Code execution endpoint
	r.HandleFunc("/api/run", handleRunCode)

	// Serve the HTML file
	r.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "../index.html")
	})

	// Get port from environment variable (for production)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server running on :%s", port)
	http.ListenAndServe(":"+port, r)
}
