package ws

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/coder/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 65536 // 64 KB
)

// Client represents a single WebSocket connection
type Client struct {
	UserID   string
	Username string
	conn     *websocket.Conn
	hub      *Hub
	send     chan []byte
	done     chan struct{}
	once     sync.Once
}

func NewClient(hub *Hub, conn *websocket.Conn, userID, username string) *Client {
	return &Client{
		UserID:   userID,
		Username: username,
		conn:     conn,
		hub:      hub,
		send:     make(chan []byte, 256),
		done:     make(chan struct{}),
	}
}

func (c *Client) Send(data []byte) {
	select {
	case c.send <- data:
	default:
		log.Printf("⚠️ Send buffer full for user %s, dropping message", c.UserID)
	}
}

func (c *Client) Close() {
	c.once.Do(func() {
		close(c.done)
		c.conn.Close(websocket.StatusNormalClosure, "connection closed")
	})
}

// ReadPump reads messages from the WebSocket connection
func (c *Client) ReadPump() {
	defer func() {
		c.hub.unregister <- c
		c.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)

	for {
		_, data, err := c.conn.Read(context.Background())
		if err != nil {
			if websocket.CloseStatus(err) == websocket.StatusNormalClosure ||
				websocket.CloseStatus(err) == websocket.StatusGoingAway {
				log.Printf("👤 User %s disconnected normally", c.UserID)
			} else {
				log.Printf("❌ Read error for user %s: %v", c.UserID, err)
			}
			return
		}

		var msg WSMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			log.Printf("❌ Invalid JSON from user %s: %v", c.UserID, err)
			continue
		}

		c.hub.HandleMessage(c, msg)
	}
}

// WritePump writes messages to the WebSocket connection
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				return
			}
			ctx, cancel := context.WithTimeout(context.Background(), writeWait)
			err := c.conn.Write(ctx, websocket.MessageText, message)
			cancel()
			if err != nil {
				log.Printf("❌ Write error for user %s: %v", c.UserID, err)
				return
			}

		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), writeWait)
			err := c.conn.Ping(ctx)
			cancel()
			if err != nil {
				log.Printf("❌ Ping error for user %s: %v", c.UserID, err)
				return
			}

		case <-c.done:
			return
		}
	}
}
