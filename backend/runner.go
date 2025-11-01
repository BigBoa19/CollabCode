package main

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os/exec"
	"time"
)

// ExecutionRequest represents the incoming code execution request
type ExecutionRequest struct {
	Language string `json:"language"`
	Code     string `json:"code"`
}

// ExecutionResult represents the result of code execution
type ExecutionResult struct {
	Output   string `json:"output"`
	Error    string `json:"error,omitempty"`
	ExitCode int    `json:"exit_code"`
	Duration int64  `json:"duration_ms"`
}

func handleRunCode(w http.ResponseWriter, r *http.Request) {
	// Handle CORS preflight requests
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.WriteHeader(http.StatusOK)
		return
	}

	// Set CORS headers for actual request
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	
	if r.Method != http.MethodPost { // Only allow POST requests
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ExecutionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Language == "" || req.Code == "" {
		http.Error(w, "Missing required fields: language and code", http.StatusBadRequest)
		return
	}

	// TODO: Add rate limiting

	result := executeCode(req.Language, req.Code)

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(result); err != nil {
		log.Printf("Error encoding response: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

// Executes code in the specified language
// Returns the execution result with output, errors, and exit code
func executeCode(language string, code string) *ExecutionResult {
	startTime := time.Now()

	result := &ExecutionResult{
		Output:   "",
		Error:    "",
		ExitCode: 0,
		Duration: time.Since(startTime).Milliseconds(),
	}

	switch language {
	case "javascript":
		executeJavaScript(code, result)
	case "python":
		executePython(code, result)
	default:
		result.Error = "Unsupported language: " + language
		result.ExitCode = 1
	}

	result.Duration = time.Since(startTime).Milliseconds()

	return result
}

// executeJavaScript executes JavaScript code using Node.js
func executeJavaScript(code string, result *ExecutionResult) error {
	ctx, cancel := createExecutionContext(5)
	defer cancel()

	cmd := exec.CommandContext(ctx, "node", "-e", code)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	result.ExitCode = cmd.ProcessState.ExitCode()

	if err != nil {
	    result.Error = stderr.String()
	    if stdout.Len() > 0 {
	        result.Output = stdout.String()
	    }
	    return err
	}

	result.Output = stdout.String()
	if stderr.Len() > 0 {
	    result.Error = stderr.String()
	}

	return nil
}

// executePython executes Python code using Python3
func executePython(code string, result *ExecutionResult) error {
	ctx, cancel := createExecutionContext(5)
	defer cancel()

	cmd := exec.CommandContext(ctx, "python3", "-c", code)

	var stdout, stderr bytes.Buffer

	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	result.ExitCode = cmd.ProcessState.ExitCode()

	if (err != nil) {
	    result.Error = stderr.String()
	    if stdout.Len() > 0 {
	        result.Output = stdout.String()
	    }
	    return err
	}

	result.Output = stdout.String()
	if stderr.Len() > 0 {
	    result.Error = stderr.String()
	}
	return nil
}

// createExecutionContext creates a context with timeout for code execution
func createExecutionContext(timeoutSeconds int) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), time.Duration(timeoutSeconds)*time.Second)
}
