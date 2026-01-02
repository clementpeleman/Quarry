import { useEffect, useState, useCallback, useRef } from 'react';

type PositionCallback = (nodeId: string, position: { x: number; y: number }) => void;
type EdgeCallback = (edge: any) => void;
type PreviewCallback = (nodeId: string, preview: any) => void;
type NodeCallback = (node: any) => void;
type TextCallback = (nodeId: string, text: string) => void;

export function useYjs(roomId: string | null) {
  const [isSynced, setIsSynced] = useState(false);
  const [users, setUsers] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const positionCallbackRef = useRef<PositionCallback | null>(null);
  const edgeCallbackRef = useRef<EdgeCallback | null>(null);
  const previewCallbackRef = useRef<PreviewCallback | null>(null);
  const nodeCallbackRef = useRef<NodeCallback | null>(null);
  const textCallbackRef = useRef<TextCallback | null>(null);

  useEffect(() => {
    if (!roomId) {
      setIsSynced(false);
      setUsers(0);
      return;
    }

    const ws = new WebSocket(`ws://localhost:1234/${roomId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsSynced(true);
      setUsers(1);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'position' && positionCallbackRef.current) {
          positionCallbackRef.current(msg.nodeId, msg.position);
        } else if (msg.type === 'edge' && edgeCallbackRef.current) {
          edgeCallbackRef.current(msg.edge);
        } else if (msg.type === 'preview' && previewCallbackRef.current) {
          previewCallbackRef.current(msg.nodeId, msg.preview);
        } else if (msg.type === 'node' && nodeCallbackRef.current) {
          nodeCallbackRef.current(msg.node);
        } else if (msg.type === 'text' && textCallbackRef.current) {
          textCallbackRef.current(msg.nodeId, msg.text);
        } else if (msg.type === 'users') {
          setUsers(msg.count);
        }
      } catch (e) {
        console.error('Error processing message:', e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsSynced(false);
      setUsers(0);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [roomId]);

  const syncPosition = useCallback((nodeId: string, position: { x: number; y: number }) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'position', nodeId, position }));
    }
  }, []);

  const syncEdge = useCallback((edge: any) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'edge', edge }));
    }
  }, []);

  const syncPreview = useCallback((nodeId: string, preview: any) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        const safeStringify = (obj: any) => JSON.stringify(obj, (_, value) =>
          typeof value === 'bigint' ? value.toString() : value
        );
        ws.send(safeStringify({ type: 'preview', nodeId, preview }));
      } catch (e) {
        console.warn('Failed to sync preview:', e);
      }
    }
  }, []);

  const syncNode = useCallback((node: any) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'node', node }));
    }
  }, []);

  const syncText = useCallback((nodeId: string, text: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'text', nodeId, text }));
    }
  }, []);

  const onRemotePositionChange = useCallback((callback: PositionCallback) => {
    positionCallbackRef.current = callback;
    return () => { positionCallbackRef.current = null; };
  }, []);

  const onRemoteEdgeChange = useCallback((callback: EdgeCallback) => {
    edgeCallbackRef.current = callback;
    return () => { edgeCallbackRef.current = null; };
  }, []);

  const onRemotePreviewChange = useCallback((callback: PreviewCallback) => {
    previewCallbackRef.current = callback;
    return () => { previewCallbackRef.current = null; };
  }, []);

  const onRemoteNodeChange = useCallback((callback: NodeCallback) => {
    nodeCallbackRef.current = callback;
    return () => { nodeCallbackRef.current = null; };
  }, []);

  const onRemoteTextChange = useCallback((callback: TextCallback) => {
    textCallbackRef.current = callback;
    return () => { textCallbackRef.current = null; };
  }, []);

  return { 
    isSynced,
    users,
    syncPosition,
    syncEdge,
    syncPreview,
    syncNode,
    syncText,
    onRemotePositionChange,
    onRemoteEdgeChange,
    onRemotePreviewChange,
    onRemoteNodeChange,
    onRemoteTextChange
  };
}

