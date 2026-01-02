import { WebSocketServer } from 'ws';

const port = process.env.PORT || 1234;
const wss = new WebSocketServer({ port: Number(port) });

// Store clients by room
const rooms = new Map();

console.log(`🦆 Quarry WebSocket server running on port ${port}`);

wss.on('connection', (ws, req) => {
  const roomName = req.url?.slice(1).split('?')[0] || 'default';
  console.log(`New connection to room: ${roomName}`);
  
  // Add to room
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  rooms.get(roomName).add(ws);
  
  // Broadcast user count
  const broadcastUserCount = () => {
    const count = rooms.get(roomName)?.size || 0;
    rooms.get(roomName)?.forEach((client) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: 'users', count }));
      }
    });
  };
  
  broadcastUserCount();

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message.toString());
      
      if (msg.type === 'position' || msg.type === 'edge' || msg.type === 'preview' || msg.type === 'node' || msg.type === 'text') {
        // Broadcast to all other clients in the room
        rooms.get(roomName)?.forEach((client) => {
          if (client !== ws && client.readyState === 1) {
            client.send(JSON.stringify(msg));
          }
        });
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });

  ws.on('close', () => {
    rooms.get(roomName)?.delete(ws);
    console.log(`Client disconnected from room: ${roomName}. ${rooms.get(roomName)?.size || 0} clients remaining.`);
    broadcastUserCount();
  });
});
