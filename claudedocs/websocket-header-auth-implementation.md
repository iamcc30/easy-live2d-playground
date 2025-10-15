# WebSocket Header Authentication - Implementation Guide

## Problem Statement

The server requires authentication via **HTTP headers** during WebSocket handshake:
```
Authorization: Bearer <access_token>
Protocol-Version: 1
Device-Id: <设备MAC地址>
Client-Id: <设备UUID>
```

However, **browser WebSocket API does not support custom headers**.

## Solution: WebSocket Subprotocols

### How It Works

WebSocket subprotocols are sent in the `Sec-WebSocket-Protocol` header during the handshake, which the server can read and parse to extract authentication information.

### Client Implementation (Current)

```typescript
// src/services/websocket.ts:57-82

// Encode auth data as subprotocols
const authProtocol = `auth.${btoa(token).replace(/=/g, '')}`
const versionProtocol = `protocol-version.${websocketConfig.protocolVersion}`
const deviceProtocol = `device-id.${websocketConfig.deviceId.replace(/:/g, '-')}`
const clientProtocol = `client-id.${websocketConfig.clientId}`

const protocols = [
  authProtocol,
  versionProtocol,
  deviceProtocol,
  clientProtocol
]

// Create WebSocket with subprotocols
this.ws = new WebSocket(url.toString(), protocols)
```

### What Gets Sent

**HTTP Request Headers**:
```http
GET /ws HTTP/1.1
Host: live.mindarae.com:8888
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Sec-WebSocket-Protocol: auth.eXhobHl6eXhobHl6, protocol-version.1, device-id.AB-CD-EF-12-34-56, client-id.550e8400-e29b-41d4-a716-446655440000
```

The server receives all authentication data in the `Sec-WebSocket-Protocol` header.

## Server-Side Implementation

### Option 1: Parse Subprotocol Header (Recommended)

**Python (FastAPI/Starlette)**:
```python
from fastapi import WebSocket, WebSocketException
import base64

async def websocket_endpoint(websocket: WebSocket):
    # Get subprotocols from header
    protocols = websocket.headers.get('sec-websocket-protocol', '').split(', ')

    # Parse authentication data
    auth_data = {}
    for protocol in protocols:
        if protocol.startswith('auth.'):
            token_b64 = protocol.split('.', 1)[1]
            # Add padding back if needed
            token_b64 += '=' * (4 - len(token_b64) % 4)
            token = base64.b64decode(token_b64).decode('utf-8')
            auth_data['authorization'] = f'Bearer {token}'
        elif protocol.startswith('protocol-version.'):
            auth_data['protocol_version'] = protocol.split('.', 1)[1]
        elif protocol.startswith('device-id.'):
            device_id = protocol.split('.', 1)[1].replace('-', ':')
            auth_data['device_id'] = device_id
        elif protocol.startswith('client-id.'):
            auth_data['client_id'] = protocol.split('.', 1)[1]

    # Validate authentication
    if not validate_token(auth_data.get('authorization', '')):
        raise WebSocketException(code=1000, reason="Invalid authentication")

    # Accept connection with selected protocol
    await websocket.accept(subprotocol=protocols[0])  # Accept first protocol

    # Continue with normal WebSocket handling
    # ...
```

**Node.js (ws library)**:
```javascript
const WebSocket = require('ws');

const wss = new WebSocket.Server({
  port: 8888,
  handleProtocols: (protocols, request) => {
    // Parse authentication from subprotocols
    const authData = {};

    protocols.forEach(protocol => {
      if (protocol.startsWith('auth.')) {
        const tokenB64 = protocol.split('.')[1];
        // Add padding back
        const padding = '='.repeat((4 - tokenB64.length % 4) % 4);
        const token = Buffer.from(tokenB64 + padding, 'base64').toString('utf-8');
        authData.authorization = `Bearer ${token}`;
      } else if (protocol.startsWith('protocol-version.')) {
        authData.protocolVersion = protocol.split('.')[1];
      } else if (protocol.startsWith('device-id.')) {
        authData.deviceId = protocol.split('.')[1].replace(/-/g, ':');
      } else if (protocol.startsWith('client-id.')) {
        authData.clientId = protocol.split('.')[1];
      }
    });

    // Validate token
    if (!validateToken(authData.authorization)) {
      return false;  // Reject connection
    }

    // Accept first protocol
    return protocols[0];
  }
});

wss.on('connection', (ws, request) => {
  console.log('Client connected with auth:', request.headers['sec-websocket-protocol']);
  // Continue with normal WebSocket handling
});
```

### Option 2: Convert to Custom Headers (Server Middleware)

**Python (Middleware approach)**:
```python
from starlette.middleware.base import BaseHTTPMiddleware

class WebSocketAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.url.path == '/ws' and request.headers.get('upgrade') == 'websocket':
            # Parse subprotocols
            protocols = request.headers.get('sec-websocket-protocol', '').split(', ')

            # Extract and set as custom headers
            for protocol in protocols:
                if protocol.startswith('auth.'):
                    token_b64 = protocol.split('.', 1)[1]
                    token_b64 += '=' * (4 - len(token_b64) % 4)
                    token = base64.b64decode(token_b64).decode('utf-8')
                    request.headers.__dict__['_list'].append(
                        (b'authorization', f'Bearer {token}'.encode())
                    )
                elif protocol.startswith('protocol-version.'):
                    version = protocol.split('.', 1)[1]
                    request.headers.__dict__['_list'].append(
                        (b'protocol-version', version.encode())
                    )
                elif protocol.startswith('device-id.'):
                    device = protocol.split('.', 1)[1].replace('-', ':')
                    request.headers.__dict__['_list'].append(
                        (b'device-id', device.encode())
                    )
                elif protocol.startswith('client-id.'):
                    client = protocol.split('.', 1)[1]
                    request.headers.__dict__['_list'].append(
                        (b'client-id', client.encode())
                    )

        response = await call_next(request)
        return response

# Add middleware to app
app.add_middleware(WebSocketAuthMiddleware)
```

Now your existing server code can read from standard headers:
```python
authorization = request.headers.get('authorization')
protocol_version = request.headers.get('protocol-version')
device_id = request.headers.get('device-id')
client_id = request.headers.get('client-id')
```

## Alternative Approaches

### Approach 1: Initial HTTP Request (Most Secure)

Use a two-step connection:

**Client**:
```typescript
// Step 1: HTTP request to get WebSocket ticket
const response = await fetch('https://server/api/ws-ticket', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Protocol-Version': '1',
    'Device-Id': deviceId,
    'Client-Id': clientId
  }
});
const { ticket } = await response.json();

// Step 2: Connect with ticket in URL
const ws = new WebSocket(`ws://server:8888?ticket=${ticket}`);
```

**Server**:
```python
# Ticket endpoint
@app.post('/api/ws-ticket')
async def create_ticket(
    authorization: str = Header(...),
    protocol_version: int = Header(...),
    device_id: str = Header(...),
    client_id: str = Header(...)
):
    # Validate headers
    if not validate_token(authorization):
        raise HTTPException(401, "Invalid token")

    # Create short-lived ticket
    ticket = create_ticket({
        'token': authorization,
        'device_id': device_id,
        'client_id': client_id
    }, expires=30)  # 30 seconds

    return {'ticket': ticket}

# WebSocket endpoint
async def websocket_endpoint(websocket: WebSocket, ticket: str):
    # Validate and decode ticket
    auth_data = validate_ticket(ticket)
    if not auth_data:
        raise WebSocketException(code=1000, reason="Invalid ticket")

    await websocket.accept()
    # Continue with auth_data
```

### Approach 2: Proxy/Gateway

Add Nginx or similar proxy to convert URL params to headers:

**Nginx Config**:
```nginx
location /ws {
    proxy_pass http://backend:8888;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";

    # Convert URL params to headers
    proxy_set_header Authorization "Bearer $arg_token";
    proxy_set_header Protocol-Version $arg_protocol_version;
    proxy_set_header Device-Id $arg_device_id;
    proxy_set_header Client-Id $arg_client_id;
}
```

**Client** (use URL params):
```typescript
const url = `ws://server/ws?token=${token}&protocol_version=1&device_id=${deviceId}&client_id=${clientId}`;
const ws = new WebSocket(url);
```

## Current Implementation Status

### Client Side ✅
- WebSocket subprotocols implemented
- Authentication data encoded in Sec-WebSocket-Protocol header
- Token base64 encoded for safe transmission
- Device ID colons converted to hyphens (protocol format safe)

### Server Side Requirements 📋
Choose one of the server implementation options above based on your infrastructure:

1. **Subprotocol Parsing** (easiest) - Parse `Sec-WebSocket-Protocol` header
2. **Middleware Conversion** - Convert subprotocols to custom headers
3. **Two-Step Auth** (most secure) - HTTP ticket → WebSocket connection
4. **Proxy Gateway** - Infrastructure-level conversion

## Testing

### Client Console Output
```
🔗 Connecting to: ws://live.mindarae.com:8888
📝 Authentication via subprotocols: {
  deviceId: "AB:CD:EF:12:34:56",
  clientId: "550e8400-e29b-41d4-a716-446655440000",
  protocolVersion: 1,
  authTokenLength: 32
}
🔗 Websocket opened, accepted protocol: auth.eXhobHl6eXhobHl6
✅ Websocket connected successfully
```

### Server Validation
```python
# Debug server-side
print(f"Received protocols: {protocols}")
print(f"Parsed auth: {auth_data}")
# Should see:
# Received protocols: ['auth.eXhobHl6eXhobHl6', 'protocol-version.1', 'device-id.AB-CD-EF-12-34-56', 'client-id.550e8400-...']
# Parsed auth: {'authorization': 'Bearer xxhlyzxxhlyz', 'protocol_version': '1', ...}
```

## Security Considerations

1. **Always use WSS (TLS)** in production - encrypts entire connection including subprotocols
2. **Token in subprotocol** is visible in handshake but encrypted with TLS
3. **Base64 encoding** is NOT encryption - use TLS for security
4. **Short-lived tokens** recommended for additional security
5. **Server validation** must verify token, version, device/client IDs

## Recommendation

For **immediate implementation**, use **Option 1: Subprotocol Parsing** on the server side. It's the simplest change and works directly with the current client implementation.

For **production/security**, consider **Two-Step Authentication** approach for better security isolation and token management.
