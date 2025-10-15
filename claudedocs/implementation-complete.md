# WebSocket Header Authentication - Implementation Complete

## Summary

Successfully implemented **WebSocket subprotocol-based authentication** to meet server requirements for HTTP header authentication while working within browser WebSocket API limitations.

## Problem

Server requires authentication via HTTP headers:
```
Authorization: Bearer <access_token>
Protocol-Version: 1
Device-Id: <设备MAC地址>
Client-Id: <设备UUID>
```

But browser WebSocket API doesn't support custom headers.

## Solution

Encode authentication as **WebSocket subprotocols**, which are sent in the `Sec-WebSocket-Protocol` HTTP header:

```typescript
const protocols = [
  `auth.${btoa(token).replace(/=/g, '')}`,
  `protocol-version.1`,
  `device-id.AB-CD-EF-12-34-56`,
  `client-id.550e8400-e29b-41d4-a716-446655440000`
]

const ws = new WebSocket(url, protocols)
```

## Implementation Details

### Client Side (Complete ✅)

**File**: `src/services/websocket.ts`

**Changes**:
- Line 47-82: WebSocket subprotocol authentication implementation
- Token base64 encoded for safe transmission
- Device ID colons converted to hyphens (protocol-safe format)
- Debug logging for connection parameters
- Accepted protocol logged on connection

### Server Side (Required 📋)

Server must parse `Sec-WebSocket-Protocol` header and extract authentication:

**Python Example**:
```python
protocols = websocket.headers.get('sec-websocket-protocol', '').split(', ')

for protocol in protocols:
    if protocol.startswith('auth.'):
        token = base64.b64decode(protocol.split('.', 1)[1] + '=').decode()
        # Validate token
    elif protocol.startswith('device-id.'):
        device_id = protocol.split('.', 1)[1].replace('-', ':')
        # Store device_id

await websocket.accept(subprotocol=protocols[0])
```

**Node.js Example**:
```javascript
const wss = new WebSocket.Server({
  handleProtocols: (protocols, request) => {
    // Parse and validate authentication from protocols
    const token = extractToken(protocols);
    return validateToken(token) ? protocols[0] : false;
  }
});
```

## HTTP Handshake

### What Client Sends
```http
GET /ws HTTP/1.1
Host: live.mindarae.com:8888
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Sec-WebSocket-Protocol: auth.eXhobHl6eXhobHl6, protocol-version.1, device-id.AB-CD-EF-12-34-56, client-id.550e8400-e29b-41d4-a716-446655440000
```

### What Server Receives
```python
# In request.headers
'sec-websocket-protocol': 'auth.eXhobHl6eXhobHl6, protocol-version.1, device-id.AB-CD-EF-12-34-56, client-id.550e8400-...'
```

All authentication data is in this single header!

## Expected Behavior

### Console Output (Success)
```
🔗 Connecting to: ws://live.mindarae.com:8888
📝 Authentication via subprotocols: {
  deviceId: "AB:CD:EF:12:34:56",
  clientId: "550e8400-e29b-41d4-a716-446655440000",
  protocolVersion: 1,
  authTokenLength: 32
}
🔗 Websocket opened, accepted protocol: auth.eXhobHl6eXhobHl6
📨 Received message: hello
👋 Server hello response: { type: "hello", ... }
✅ Websocket connected successfully
```

### Connection Flow
```
1. Client creates WebSocket with subprotocols
2. Browser sends Sec-WebSocket-Protocol header
3. Server receives and parses authentication
4. Server validates token, device ID, client ID
5. Server accepts connection with chosen subprotocol
6. Connection established, messages flow
```

## Files Modified

### Client Implementation
- ✅ `src/services/websocket.ts` - Subprotocol authentication
- ✅ `src/stores/chat.ts` - Already updated (previous fix)
- ✅ `src/config/websocket.ts` - No changes needed

### Documentation
- ✅ `WEBSOCKET_IMPLEMENTATION.md` - Updated connection flow
- ✅ `claudedocs/websocket-header-auth-implementation.md` - Full implementation guide
- ✅ `claudedocs/websocket-subprotocol-auth-summary.md` - Quick reference
- ✅ `claudedocs/websocket-diagnostic-report.md` - Historical context

## Testing Checklist

### Client Side ✅
- [x] Token validation before connection
- [x] Subprotocol encoding implemented
- [x] Base64 encoding for token
- [x] Device ID format conversion (: → -)
- [x] Debug logging for troubleshooting
- [x] TypeScript compilation passes

### Server Side (To Implement) 📋
- [ ] Parse `Sec-WebSocket-Protocol` header
- [ ] Extract and decode authentication token
- [ ] Validate token and credentials
- [ ] Accept connection with selected subprotocol
- [ ] Handle protocol parsing errors gracefully

## Security Notes

⚠️ **Always use WSS (wss://) in production**
- Encrypts entire WebSocket handshake
- Protects subprotocols and authentication data
- TLS is required for security

⚠️ **Base64 is NOT encryption**
- Used for safe protocol transmission
- Actual security comes from TLS/WSS
- Token should be short-lived

✅ **Advantages of this approach**
- Works within browser limitations
- Standard WebSocket protocol feature
- Server receives data in HTTP headers
- Compatible with all WebSocket libraries

## Alternative Approaches Considered

### 1. URL Query Parameters
- ❌ Rejected: Server specifically requires headers
- ✅ Easier to implement but doesn't meet requirements

### 2. Two-Step Authentication
- ✅ Most secure approach
- ❌ Requires additional HTTP endpoint
- 💡 Recommended for production enhancement

### 3. Proxy/Gateway
- ✅ Infrastructure-level solution
- ❌ Requires additional infrastructure
- 💡 Good for multi-service environments

### 4. WebSocket Subprotocols (Chosen)
- ✅ Meets header requirement via Sec-WebSocket-Protocol
- ✅ Browser-compatible
- ✅ Standard WebSocket feature
- ⚠️ Requires server parsing implementation

## Troubleshooting Guide

| Problem | Cause | Solution |
|---------|-------|----------|
| Connection closes immediately | Server not parsing subprotocols | Implement subprotocol parsing |
| "Protocol not accepted" | Server didn't accept any protocol | Server must accept at least one |
| Token invalid | Base64 decoding issue | Add padding: `token + '=' * (4 - len(token) % 4)` |
| Device ID mismatch | Format conversion | Convert `-` back to `:` |
| No hello response | Authentication failed | Check server logs, validate token |

## Next Steps

1. **Server Implementation**
   - Choose your server framework (Python/Node.js)
   - Implement subprotocol parsing (examples provided)
   - Test authentication flow

2. **Testing**
   - Verify "Server hello response" in console
   - Check no immediate disconnection
   - Validate audio/message flow works

3. **Production Deployment**
   - Switch to WSS (wss://) protocol
   - Implement token refresh mechanism
   - Add connection monitoring
   - Enable TLS/SSL on server

## Resources

📖 **Documentation**:
- Full Implementation: `claudedocs/websocket-header-auth-implementation.md`
- Quick Reference: `claudedocs/websocket-subprotocol-auth-summary.md`
- Protocol Spec: `Websocket连接.md`
- Main Guide: `WEBSOCKET_IMPLEMENTATION.md`

💻 **Code Examples**:
- Client: `src/services/websocket.ts:38-119`
- Server Python: See full implementation doc
- Server Node.js: See full implementation doc

🔧 **Testing**:
- Browser Console: Check subprotocol logs
- Server Logs: Verify subprotocol parsing
- Network Tab: Inspect Sec-WebSocket-Protocol header

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Client Implementation | ✅ Complete | Ready for testing |
| TypeScript Compilation | ✅ Passes | No errors |
| Documentation | ✅ Complete | Multiple guides provided |
| Server Implementation | 📋 Required | Examples provided |
| Testing | ⏳ Pending | Awaiting server update |

## Conclusion

The client-side implementation is **complete and ready**. The WebSocket connection now sends authentication data via subprotocols in the `Sec-WebSocket-Protocol` header, which satisfies the server's requirement for header-based authentication while working within browser WebSocket API limitations.

**The server needs to be updated** to parse these subprotocols and extract the authentication information. Detailed implementation examples for both Python and Node.js are provided in the documentation.

Once the server is updated, the connection should establish successfully with proper authentication! 🎉
