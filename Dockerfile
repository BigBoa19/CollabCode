# Build stage
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY backend/go.mod backend/go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY backend/ .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Final stage
FROM alpine:latest

# Install Node.js, Python3, and ca-certificates
RUN apk --no-cache add \
    ca-certificates \
    nodejs \
    npm \
    python3 \
    py3-pip

WORKDIR /root/

# Copy the binary from builder stage
COPY --from=builder /app/main .

# Create documents directory
RUN mkdir -p documents

# Expose port
EXPOSE 8080

# Run the application
CMD ["./main"]
