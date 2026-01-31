import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface WebSocketContextType {
  status: ConnectionStatus;
  send: (message: object) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { accessToken, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const reconnectTimeoutRef = useRef<number>();

  const connect = useCallback(() => {
    if (!accessToken || !isAuthenticated) return;

    const wsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.host}/ws`;
    
    setStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send auth message
      ws.send(JSON.stringify({
        type: 'auth',
        token: accessToken,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // Handle auth response
        if (message.type === 'auth.ok') {
          setStatus('connected');
          console.log('WebSocket authenticated');
          return;
        }

        if (message.type === 'auth.error') {
          console.error('WebSocket auth error:', message.message);
          setStatus('error');
          ws.close();
          return;
        }

        // Handle broadcast events - invalidate relevant queries
        if (message.type?.startsWith('event.')) {
          console.log('WS event:', message.type);
          
          switch (message.type) {
            case 'event.todo.created':
            case 'event.todo.updated':
            case 'event.todo.completed':
              queryClient.invalidateQueries({ queryKey: ['todos'] });
              queryClient.invalidateQueries({ queryKey: ['stats'] });
              queryClient.invalidateQueries({ queryKey: ['activity'] });
              break;
            case 'event.diary.created':
              queryClient.invalidateQueries({ queryKey: ['diary'] });
              queryClient.invalidateQueries({ queryKey: ['stats'] });
              queryClient.invalidateQueries({ queryKey: ['activity'] });
              break;
            case 'event.mood.logged':
              queryClient.invalidateQueries({ queryKey: ['moods'] });
              queryClient.invalidateQueries({ queryKey: ['stats'] });
              queryClient.invalidateQueries({ queryKey: ['activity'] });
              break;
          }
        }
      } catch (err) {
        console.error('WebSocket message parse error:', err);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;

      // Reconnect after delay if still authenticated
      if (isAuthenticated) {
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('error');
    };
  }, [accessToken, isAuthenticated, queryClient]);

  // Connect when authenticated
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isAuthenticated, accessToken, connect]);

  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ status, send }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
}
