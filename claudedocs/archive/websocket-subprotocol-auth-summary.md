# WebSocket Header Authentication - Quick Reference

## Overview

Implemented **WebSocket subprotocol-based authentication** to satisfy server's requirement for authentication headers, working around browser WebSocket API's limitation of not supporting custom headers.

## How It Works

### Client Side (Browser)

Authentication data is encoded as WebSocket subprotocols:

```typescript
// src/services/websocket.ts:57-82

const protocols = [
  `auth.${btoa(token).replace(/=/g, '')}`,                    // Token (base64)
  `protocol-version.${websocketConfig.protocolVersion}`,      // Version
  `device-id.${websocketConfig.deviceId.replace(/:/g, '-')}`, // Device ID
  `client-id.${websocketConfig.clientId}`                     // Client ID
]

this.ws = new WebSocket(url, protocols)
```

### What Gets Sent

```http
GET /ws HTTP/1.1
Sec-WebSocket-Protocol: auth.eXhobHl6eXhobHl6, protocol-version.1, device-id.AB-CD-EF-12-34-56, client-id.550e8400-...
```

Server receives all authentication in the `Sec-WebSocket-Protocol` header!

## Server Implementation (Required)

### Python (FastAPI/Starlette)

```python
async def websocket_endpoint(websocket: WebSocket):
    # Parse subprotocols from header
    protocols = websocket.headers.get('sec-websocket-protocol', '').split(', ')

    auth_data = {}
    for protocol in protocols:
        if protocol.startswith('auth.'):
            # Decode base64 token
            token_b64 = protocol.split('.', 1)[1] + '=' * (4 - len(protocol.split('.', 1)[1]) % 4)
            token = base64.b64decode(token_b64).decode('utf-8')
            auth_data['authorization'] = f'Bearer {token}'
        elif protocol.startswith('protocol-version.'):
            auth_data['protocol_version'] = protocol.split('.', 1)[1]
        elif protocol.startswith('device-id.'):
            auth_data['device_id'] = protocol.split('.', 1)[1].replace('-', ':')
        elif protocol.startswith('client-id.'):
            auth_data['client_id'] = protocol.split('.', 1)[1]

    # Validate authentication
    if not validate_token(auth_data['authorization']):
        raise WebSocketException(code=1000, reason="Invalid authentication")

    # Accept connection
    await websocket.accept(subprotocol=protocols[0])
```

### Node.js (ws library)

```javascript
const wss = new WebSocket.Server({
  port: 8888,
  handleProtocols: (protocols, request) => {
    const authData = {};

    protocols.forEach(protocol => {
      if (protocol.startsWith('auth.')) {
        const tokenB64 = protocol.split('.')[1];
        const padding = '='.repeat((4 - tokenB64.length % 4) % 4);
        const token = Buffer.from(tokenB64 + padding, 'base64').toString('utf-8');
        authData.authorization = `Bearer ${token}`;
      } else if (protocol.startsWith('device-id.')) {
        authData.deviceId = protocol.split('.')[1].replace(/-/g, ':');
      }
      // ... parse other protocols
    });

    // Validate and accept
    return validateToken(authData.authorization) ? protocols[0] : false;
  }
});
```

## Expected Console Output

### Client (Success)
```
🔗 Connecting to: ws://live.mindarae.com:8888
📝 Authentication via subprotocols: {
  deviceId: "AB:CD:EF:12:34:56",
  clientId: "550e8400-e29b-41d4-a716-446655440000",
  protocolVersion: 1,
  authTokenLength: 32
}
🔗 Websocket opened, accepted protocol: auth.eXhobHl6eXhobHl6
👋 Server hello response: { type: "hello", ... }
✅ Websocket connected successfully
```

### Server (Debug)
```python
print(request.headers.get('sec-websocket-protocol'))
# Output: auth.eXhobHl6eXhobHl6, protocol-version.1, device-id.AB-CD-EF-12-34-56, client-id.550e8400-...

print(auth_data)
# Output: {
#   'authorization': 'Bearer xxhlyzxxhlyz',
#   'protocol_version': '1',
#   'device_id': 'AB:CD:EF:12:34:56',
#   'client_id': '550e8400-e29b-41d4-a716-446655440000'
# }
```

## Key Points

✅ **Client sends**: Authentication as WebSocket subprotocols
✅ **Server receives**: All data in `Sec-WebSocket-Protocol` header
✅ **Server parses**: Extract and validate authentication
✅ **Server accepts**: Connection with validated subprotocol

⚠️ **Server MUST implement subprotocol parsing** - the client is ready, server needs updates
⚠️ **Use WSS (TLS) in production** - encrypts entire handshake including subprotocols
⚠️ **Token is base64 encoded** - NOT encrypted, TLS required for security

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection closes immediately | Server not parsing subprotocols |
| "Invalid protocol" error | Server must accept at least one offered subprotocol |
| Token not recognized | Check base64 decoding and padding restoration |
| Device ID mismatch | Convert hyphens back to colons (AB-CD-EF → AB:CD:EF) |

## Documentation

- **Full Implementation Guide**: `claudedocs/websocket-header-auth-implementation.md`
- **Protocol Specification**: `Websocket连接.md`
- **Main Documentation**: `WEBSOCKET_IMPLEMENTATION.md`

## Status

✅ Client implementation complete
📋 Server implementation required (see examples above)
✅ TypeScript compilation passes
✅ Documentation updated

## Next Steps

1. Implement subprotocol parsing on your server
2. Test connection with authentication
3. Verify "Server hello response" appears in console
4. Confirm no immediate disconnection
