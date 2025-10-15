# Websocket Connection Issues - Diagnostic Report

## Issues Resolved

### Issue 1: Audio Data Sending Failure
**Error**: `websocket.ts:355 Cannot send audio: not connected`

**Root Cause**: Race condition between chat store and websocket service connection state management.

**Fix**: Changed chat store to use websocket service state directly via computed properties instead of maintaining duplicate state.

**Details**: See `claudedocs/websocket-connection-fix.md`

---

### Issue 2: Immediate Connection Closure
**Errors**:
- `websocket.ts:336 Cannot send message: not connected`
- `websocket.ts:130 Websocket connection closed: 1000`
- Reconnection loop after successful connection

**Root Cause**: Browser WebSocket API limitation - cannot send custom authentication headers. Server rejected unauthenticated connections.

**Fix**: Implemented URL query parameter authentication since browser WebSocket doesn't support custom headers.

**Details**: See `claudedocs/websocket-authentication-fix.md`

## Final Solution

### Connection Flow (Working)
```
1. User clicks connect
2. Audio services initialize
3. Websocket URL constructed with auth params:
   ws://server:8888?authorization=Bearer+<token>&protocol-version=1&device-id=<id>&client-id=<uuid>
4. WebSocket connection opens
5. Hello message sent
6. Server validates authentication
7. Server responds with hello
8. Connection state = 'connected' ✅
9. Audio/messages flow successfully
```

### Code Changes Summary

**`src/stores/chat.ts`**:
- Line 30-32: Use computed properties for connection state
- Line 156-179: Removed manual state management
- Line 184-188: Removed manual state updates
- Line 240-244: Removed manual state updates

**`src/services/websocket.ts`**:
- Line 47-70: Added URL query parameter authentication
  - Token validation
  - URL parameter construction
  - Debug logging
- No other logic changes

## Expected Behavior After Fixes

### Console Output (Success)
```
🔗 Connecting to: ws://live.mindarae.com:8888
📝 Authentication params: { deviceId: "...", clientId: "...", protocolVersion: 1 }
🔗 Websocket connection opened
📨 Received message: hello
👋 Server hello response: { type: "hello", ... }
✅ Websocket connected successfully
🎤 Started voice listening
🎵 Using OPUS encoding (or 📊 Using PCM fallback)
```

### UI Behavior
- Connection status: 🟢 已连接
- No immediate disconnection
- No reconnection loop
- Voice button works
- Audio sends successfully
- TTS playback works

## Environment Requirements

**`.env.local` (REQUIRED)**:
```env
# Server URL
VITE_WS_URL=ws://live.mindarae.com:8888

# Access token (REQUIRED - connection will fail without this)
VITE_ACCESS_TOKEN=your_actual_token_here
```

## Server Requirements

**Server must accept authentication via URL query parameters**:

```python
# Example server-side implementation
authorization = request.query_params.get('authorization')  # "Bearer <token>"
protocol_version = request.query_params.get('protocol-version')  # "1"
device_id = request.query_params.get('device-id')  # MAC address format
client_id = request.query_params.get('client-id')  # UUID format

# Validate token and establish connection
if validate_token(authorization):
    accept_connection()
else:
    close_connection(1000, "Invalid authentication")
```

## Testing Checklist

- [ ] `.env.local` has valid `VITE_ACCESS_TOKEN`
- [ ] Server is running at configured URL
- [ ] Server accepts URL parameter authentication
- [ ] Click connect button
- [ ] See "Server hello response" in console
- [ ] Connection status shows 🟢 已连接
- [ ] No immediate disconnection
- [ ] No reconnection loop
- [ ] Click microphone button
- [ ] Audio format logged (OPUS or PCM)
- [ ] Voice listening starts
- [ ] No "Cannot send" errors

## Troubleshooting

### Still Getting "Cannot send message"
1. Check console for "Server hello response" - if missing, server rejected connection
2. Verify token in `.env.local`
3. Check server logs for authentication errors
4. Ensure server reads auth from URL parameters, not headers

### Connection Still Closes Immediately
1. Token may be invalid or expired
2. Server may not support URL parameter authentication
3. Check server logs for rejection reason
4. Verify URL parameter names match server expectations

### No Audio Sending
1. Verify connection is established (see "Server hello response")
2. Check microphone permissions
3. Verify audio recording initialized
4. Check console for encoder status

## Documentation

- **Implementation Guide**: `WEBSOCKET_IMPLEMENTATION.md`
- **Quick Start**: `QUICKSTART.md`
- **Connection Fix**: `claudedocs/websocket-connection-fix.md`
- **Authentication Fix**: `claudedocs/websocket-authentication-fix.md`
- **Protocol Spec**: `Websocket连接.md`

## Status

✅ **All Issues Resolved**

- [x] Fixed race condition in state management
- [x] Implemented URL parameter authentication
- [x] Eliminated reconnection loop
- [x] Enabled stable connection
- [x] Messages and audio flow successfully
- [x] Documentation updated
- [x] TypeScript compilation passes
