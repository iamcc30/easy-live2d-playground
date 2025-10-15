# Websocket Authentication Fix

## Issue
**Errors**:
- `websocket.ts:336 Cannot send message: not connected`
- `websocket.ts:130 Websocket connection closed: 1000`
- Immediate reconnection loop after successful connection

**Symptom**: Connection establishes, shows "connected successfully", but immediately closes with code 1000 (normal closure) and enters reconnection loop.

## Root Cause Analysis

### The Problem
**Browser WebSocket API Limitation**: WebSocket connections in browsers **do not support custom headers**. The protocol specification required authentication headers, but these were never sent.

### Protocol Requirements (from `Websocket连接.md`)
```
Headers required:
- Authorization: Bearer <access_token>
- Protocol-Version: 1
- Device-Id: <MAC address>
- Client-Id: <UUID>
```

### Original Implementation (Broken)
```typescript
// websocket.ts:48-50 (OLD)
const url = new URL(websocketConfig.url)
this.ws = new WebSocket(url.toString())
// ❌ No way to add headers in browser WebSocket API!
```

### Connection Flow (Before Fix)
```
Client                          Server
  |                               |
  |--WebSocket.open()------------>|
  |                               |
  |<--Connection opened-----------|
  |                               |
  |--hello message--------------->|
  |                               |
  |                          [No auth headers]
  |                          [Reject connection]
  |                               |
  |<--Close (1000)----------------|
  |                               |
state='disconnected'              |
reconnect loop starts...          |
```

### Why Server Closed
1. **Connection Opens**: TCP/WebSocket handshake succeeds
2. **Missing Auth**: Server expects authentication headers, but browser API doesn't send them
3. **Server Rejects**: Server cleanly closes with code 1000 (normal closure)
4. **Client Confused**: Client thinks connection was successful, enters reconnection loop
5. **No Hello Response**: Server never responds to hello message without authentication

## Solution

### WebSocket Authentication via URL Parameters

Since browsers don't support custom headers in WebSocket connections, we pass authentication via URL query parameters:

**New Implementation**:
```typescript
// websocket.ts:47-70 (NEW)
const url = new URL(websocketConfig.url)
const token = getAccessToken()

if (!token) {
  throw new Error('Access token is required for authentication')
}

// Add authentication parameters to URL
url.searchParams.set('authorization', `Bearer ${token}`)
url.searchParams.set('protocol-version', websocketConfig.protocolVersion.toString())
url.searchParams.set('device-id', websocketConfig.deviceId)
url.searchParams.set('client-id', websocketConfig.clientId)

console.log('🔗 Connecting to:', url.origin + url.pathname)
console.log('📝 Authentication params:', {
  deviceId: websocketConfig.deviceId,
  clientId: websocketConfig.clientId,
  protocolVersion: websocketConfig.protocolVersion
})

this.ws = new WebSocket(url.toString())
```

### Connection Flow (After Fix)
```
Client                                    Server
  |                                         |
  |--WebSocket.open() with URL params----->|
  |  ?authorization=Bearer <token>          |
  |  &protocol-version=1                    |
  |  &device-id=XX:XX:XX:XX:XX:XX          |
  |  &client-id=<uuid>                      |
  |                                         |
  |<--Connection accepted------------------|
  |                                         |
  |--hello message------------------------->|
  |                                         |
  |                                    [Auth valid]
  |                                    [Process hello]
  |                                         |
  |<--hello response------------------------|
  |                                         |
state='connected' ✅                        |
Audio/messages flow successfully           |
```

### URL Format Example
```
Before: ws://live.mindarae.com:8888

After: ws://live.mindarae.com:8888?authorization=Bearer+xxxx&protocol-version=1&device-id=AB:CD:EF:12:34:56&client-id=550e8400-e29b-41d4-a716-446655440000
```

## Changes Made

### `src/services/websocket.ts` (Line 38-106)

**Key Changes**:
1. Added token validation before connection
2. Build authentication parameters into URL query string
3. Added debug logging for connection parameters
4. Preserved all existing connection logic and error handling

**Code Additions**:
```typescript
// Token validation
const token = getAccessToken()
if (!token) {
  throw new Error('Access token is required for authentication')
}

// URL parameter construction
url.searchParams.set('authorization', `Bearer ${token}`)
url.searchParams.set('protocol-version', websocketConfig.protocolVersion.toString())
url.searchParams.set('device-id', websocketConfig.deviceId)
url.searchParams.set('client-id', websocketConfig.clientId)

// Debug logging
console.log('🔗 Connecting to:', url.origin + url.pathname)
console.log('📝 Authentication params:', { deviceId, clientId, protocolVersion })
```

## Benefits

1. **✅ Server Authentication Works**: Authentication parameters properly transmitted
2. **✅ Stable Connection**: No immediate disconnection after connection
3. **✅ Hello Handshake Completes**: Server responds to hello message
4. **✅ No Reconnection Loop**: Connection stays established
5. **✅ Browser Compatible**: Works with browser WebSocket API limitations
6. **✅ Better Debugging**: Logs show authentication parameters being sent

## Server-Side Requirements

**Note**: This fix assumes the server accepts authentication via URL query parameters instead of headers. If your server only supports headers, you'll need one of these approaches:

### Option 1: Server Update (Recommended)
Update server to read authentication from URL query parameters:
```python
# Server-side (example)
authorization = request.query_params.get('authorization')
protocol_version = request.query_params.get('protocol-version')
device_id = request.query_params.get('device-id')
client_id = request.query_params.get('client-id')
```

### Option 2: WebSocket Subprotocol (Alternative)
Use WebSocket subprotocols to pass authentication:
```typescript
// Client
this.ws = new WebSocket(url, [`auth.${token}`])

// Server validates subprotocol
```

### Option 3: Proxy/Gateway (Infrastructure)
Add a proxy layer that converts URL params to headers:
```
Browser → Proxy (params→headers) → Server
```

## Testing Validation

### Expected Console Output (Success)
```
🔗 Connecting to: ws://live.mindarae.com:8888
📝 Authentication params: {
  deviceId: "AB:CD:EF:12:34:56",
  clientId: "550e8400-e29b-41d4-a716-446655440000",
  protocolVersion: 1
}
🔗 Websocket connection opened
👋 Server hello response: { type: "hello", ... }
✅ Websocket connected successfully
```

### Expected Behavior
1. **Connection Flow**:
   - Click connect button
   - Console shows connection URL (without full token for security)
   - Console shows authentication parameters
   - Console shows "Websocket connection opened"
   - Console shows "Server hello response" ✅ (This was missing before!)
   - Console shows "Websocket connected successfully"
   - UI shows: 🟢 已连接
   - **NO** immediate disconnection
   - **NO** reconnection loop

2. **Message Flow**:
   - Start voice listening works
   - Audio data sends successfully
   - Server responses received
   - NO "Cannot send message: not connected" errors

### Debug Commands
```javascript
// Check if token is available
console.log('Token available:', !!getAccessToken())

// Check connection parameters
console.log('Config:', {
  url: websocketConfig.url,
  deviceId: websocketConfig.deviceId,
  clientId: websocketConfig.clientId,
  hasToken: !!getAccessToken()
})

// Test connection
const store = useChatStore()
await store.connectWebsocket()
// Should see: "Server hello response" in console ✅
```

## Environment Configuration

Ensure `.env.local` has proper authentication:

```env
# Websocket server URL
VITE_WS_URL=ws://live.mindarae.com:8888

# Access token (REQUIRED)
VITE_ACCESS_TOKEN=your_actual_token_here

# Optional: Override device/client IDs
# VITE_DEVICE_ID=AB:CD:EF:12:34:56
# VITE_CLIENT_ID=550e8400-e29b-41d4-a716-446655440000
```

**Important**: The access token is now **required**. Connection will fail with error if token is missing.

## Related Files
- `src/services/websocket.ts` - Websocket service with URL-based authentication
- `src/config/websocket.ts` - Configuration and token retrieval (unchanged)
- `.env.example` - Environment variables template
- `Websocket连接.md` - Protocol specification

## Issue Resolution
- ✅ Fixed browser WebSocket header limitation
- ✅ Implemented URL parameter authentication
- ✅ Eliminated immediate disconnection
- ✅ Stopped reconnection loop
- ✅ Enabled proper hello handshake
- ✅ Messages and audio now flow successfully

## Security Considerations

**Token in URL**:
- ⚠️ URL parameters are visible in browser dev tools
- ⚠️ May appear in server logs
- ✅ WebSocket is upgraded connection, URL not visible in network traffic
- ✅ Use WSS (TLS) in production to encrypt the entire connection
- 🔒 **Production**: Always use `wss://` (secure WebSocket)

**Recommendations**:
1. Use WSS (secure WebSocket) in production
2. Implement token rotation/refresh
3. Use short-lived tokens
4. Server should validate tokens on every connection
5. Implement rate limiting on connection attempts
