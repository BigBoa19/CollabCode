package main

import (
	"log"
	"os"
	"path/filepath"
	"time"
)

type Document struct {
	Content      string
	LastModified time.Time
}


// getDocumentPath returns the file path for this room's document
func (r *Room) getDocumentPath() string {
	// Create documents directory if it doesn't exist
	docDir := "./documents"
	os.MkdirAll(docDir, 0755)

	// Return path like: ./documents/room-test-room.txt
	return filepath.Join(docDir, "doc-"+r.ID+".txt")
}

// loadDocument loads the document content from file
func (r *Room) loadDocument() error {
	filePath := r.getDocumentPath()

	// Try to read the file
	content, err := os.ReadFile(filePath)
	if err != nil {
		// File doesn't exist or can't be read - start with empty document
		log.Printf("No existing document for room %s, starting fresh", r.ID)
		return nil
	}

	// Load the content
	r.Document.Content = string(content)
	r.Document.LastModified = time.Now()
	log.Printf("Loaded document for room %s (%d characters)", r.ID, len(r.Document.Content))

	return nil
}

// saveDocument saves the document content to file
func (r *Room) saveDocument() error {
	filePath := r.getDocumentPath()

	// Write content to file
	log.Printf("Saving document with content: \"%s\"", r.Document.Content)
	err := os.WriteFile(filePath, []byte(r.Document.Content), 0644)
	if err != nil {
		log.Printf("ERROR: Failed to save document for room %s: %v", r.ID, err)
		return err
	}

	r.Document.LastModified = time.Now()

	return nil
}
