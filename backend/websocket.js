// Simple WebSocket handler for notifications
const url = require('url');
const jwt = require('jsonwebtoken');
const notificationService = require('./services/notifications.js');

/**
 * WebSocket handler for real-time notifications
 */
function handleWebSocket(request, socket, head) {
  const pathname = url.parse(request.url).pathname;

  if (pathname === '/ws/notifications') {
    handleNotificationConnection(request, socket, head);
  } else {
    socket.destroy();
  }
}

/**
 * Handle notification WebSocket connections
 */
function handleNotificationConnection(request, socket, head) {
  try {
    // Parse query parameters for auth token
    const urlParts = url.parse(request.url, true);
    const token = urlParts.query.token || extractTokenFromCookies(request.headers.cookie);

    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Debug: Log received token
    console.log(`WebSocket received token: ${token ? token.substring(0, 20) + '...' : 'null'}`);

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // WebSocket handshake
    const acceptKey = generateAcceptKey(request.headers['sec-websocket-key']);

    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '\r\n'
    ].join('\r\n');

    socket.write(responseHeaders);

    // Convert to WebSocket
    const ws = createWebSocketFromSocket(socket);

    // Subscribe to notifications
    notificationService.subscribe(userId, ws);

    console.log(`WebSocket connected for user ${userId}`);

    // Send initial connection message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'WebSocket connected successfully'
    }));

  } catch (error) {
    console.error('WebSocket connection error:', error);
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }
}

/**
 * Extract auth token from cookies
 */
function extractTokenFromCookies(cookieHeader) {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {});

  // Check for the token name used by the auth system
  return cookies.token || cookies.auth_token;
}

/**
 * Generate WebSocket accept key
 */
function generateAcceptKey(key) {
  const crypto = require('crypto');
  const WEBSOCKET_MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
  return crypto
    .createHash('sha1')
    .update(key + WEBSOCKET_MAGIC_STRING)
    .digest('base64');
}

/**
 * Create a simple WebSocket wrapper around a socket
 */
function createWebSocketFromSocket(socket) {
  const EventEmitter = require('events');
  const ws = new EventEmitter();

  ws.readyState = 1; // OPEN
  ws.socket = socket;

  // Send method
  ws.send = function(data) {
    if (ws.readyState !== 1) return;

    try {
      const payload = Buffer.from(data, 'utf8');
      const frame = createFrame(payload);
      socket.write(frame);
    } catch (error) {
      console.error('WebSocket send error:', error);
      ws.close();
    }
  };

  // Close method
  ws.close = function() {
    if (ws.readyState === 1) {
      ws.readyState = 3; // CLOSED
      socket.end();
      ws.emit('close');
    }
  };

  // Handle socket events
  socket.on('data', (buffer) => {
    try {
      const frame = parseFrame(buffer);
      if (frame) {
        if (frame.opcode === 0x8) { // Close frame
          ws.close();
        } else if (frame.opcode === 0x9) { // Ping frame
          ws.pong(frame.payload);
        } else if (frame.opcode === 0x1 || frame.opcode === 0x2) { // Text or binary frame
          ws.emit('message', frame.payload.toString('utf8'));
        }
      }
    } catch (error) {
      console.error('WebSocket frame parsing error:', error);
      ws.close();
    }
  });

  socket.on('close', () => {
    ws.readyState = 3; // CLOSED
    ws.emit('close');
  });

  socket.on('error', (error) => {
    console.error('WebSocket socket error:', error);
    ws.emit('error', error);
    ws.close();
  });

  // Pong method
  ws.pong = function(data) {
    if (ws.readyState !== 1) return;
    const frame = createFrame(data || Buffer.alloc(0), 0xA); // Pong opcode
    socket.write(frame);
  };

  return ws;
}

/**
 * Create WebSocket frame
 */
function createFrame(payload, opcode = 0x1) {
  const payloadLength = payload.length;
  let frame;

  if (payloadLength < 126) {
    frame = Buffer.allocUnsafe(2 + payloadLength);
    frame[0] = 0x80 | opcode; // FIN = 1, opcode
    frame[1] = payloadLength;
    payload.copy(frame, 2);
  } else if (payloadLength < 65536) {
    frame = Buffer.allocUnsafe(4 + payloadLength);
    frame[0] = 0x80 | opcode;
    frame[1] = 126;
    frame.writeUInt16BE(payloadLength, 2);
    payload.copy(frame, 4);
  } else {
    frame = Buffer.allocUnsafe(10 + payloadLength);
    frame[0] = 0x80 | opcode;
    frame[1] = 127;
    frame.writeUInt32BE(0, 2); // High 32 bits of 64-bit length
    frame.writeUInt32BE(payloadLength, 6); // Low 32 bits
    payload.copy(frame, 10);
  }

  return frame;
}

/**
 * Parse WebSocket frame
 */
function parseFrame(buffer) {
  if (buffer.length < 2) return null;

  const firstByte = buffer[0];
  const secondByte = buffer[1];

  const fin = !!(firstByte & 0x80);
  const opcode = firstByte & 0x0F;
  const masked = !!(secondByte & 0x80);
  let payloadLength = secondByte & 0x7F;

  let offset = 2;

  if (payloadLength === 126) {
    if (buffer.length < offset + 2) return null;
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < offset + 8) return null;
    // For simplicity, only handle payloads up to 32-bit length
    payloadLength = buffer.readUInt32BE(offset + 4);
    offset += 8;
  }

  if (buffer.length < offset + (masked ? 4 : 0) + payloadLength) return null;

  let maskKey = null;
  if (masked) {
    maskKey = buffer.slice(offset, offset + 4);
    offset += 4;
  }

  let payload = buffer.slice(offset, offset + payloadLength);

  if (masked && maskKey) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskKey[i % 4];
    }
  }

  return {
    fin,
    opcode,
    masked,
    payload
  };
}

module.exports = {
  handleWebSocket
};