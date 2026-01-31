import type { WebSocket } from 'ws';

interface WSConnection {
  socket: WebSocket;
  userId: string;
  authenticatedAt: Date;
}

class WSConnectionManager {
  // Map of userId -> Set of connections
  private connections = new Map<string, Set<WSConnection>>();
  
  // Map of socket -> connection info
  private socketMap = new WeakMap<WebSocket, WSConnection>();

  /**
   * Add an authenticated connection
   */
  addConnection(socket: WebSocket, userId: string): void {
    const connection: WSConnection = {
      socket,
      userId,
      authenticatedAt: new Date(),
    };

    this.socketMap.set(socket, connection);

    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(connection);

    console.log(`WS: User ${userId} connected. Total connections for user: ${this.connections.get(userId)!.size}`);
  }

  /**
   * Remove a connection
   */
  removeConnection(socket: WebSocket): void {
    const connection = this.socketMap.get(socket);
    if (!connection) return;

    const userConnections = this.connections.get(connection.userId);
    if (userConnections) {
      userConnections.delete(connection);
      if (userConnections.size === 0) {
        this.connections.delete(connection.userId);
      }
    }

    console.log(`WS: User ${connection.userId} disconnected.`);
  }

  /**
   * Get user ID for a socket
   */
  getUserId(socket: WebSocket): string | undefined {
    return this.socketMap.get(socket)?.userId;
  }

  /**
   * Broadcast a message to all connections for a user
   */
  broadcastToUser(userId: string, message: object): void {
    const userConnections = this.connections.get(userId);
    if (!userConnections || userConnections.size === 0) return;

    const payload = JSON.stringify(message);

    for (const connection of userConnections) {
      if (connection.socket.readyState === 1) { // WebSocket.OPEN
        connection.socket.send(payload);
      }
    }
  }

  /**
   * Send a message to a specific socket
   */
  send(socket: WebSocket, message: object): void {
    if (socket.readyState === 1) {
      socket.send(JSON.stringify(message));
    }
  }

  /**
   * Get count of active connections for a user
   */
  getConnectionCount(userId: string): number {
    return this.connections.get(userId)?.size ?? 0;
  }

  /**
   * Get total active connections
   */
  getTotalConnections(): number {
    let total = 0;
    for (const connections of this.connections.values()) {
      total += connections.size;
    }
    return total;
  }
}

// Singleton instance
export const wsConnectionManager = new WSConnectionManager();
