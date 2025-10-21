import type { WebsocketConfig, AudioRecordingConfig } from '@/types/websocket'

/**
 * WebSocket Configuration
 * Update these values based on your server configuration
 *
 * Authentication is passed via URL query parameters:
 * - token: Access token for authentication
 * - deviceId: Unique device identifier
 * - clientId: Unique client identifier
 * - protocolVersion: Protocol version number
 */
export const websocketConfig: WebsocketConfig = {
  // WebSocket server URL
  // Example: 'http://server.com:8888' will connect to 'ws://server.com:8888'
  url: import.meta.env.VITE_WS_URL || 'https://your-server.com',

  // Access token (should be obtained from authentication service)
  accessToken: import.meta.env.VITE_ACCESS_TOKEN || '',

  // Device identification
  deviceId: localStorage.getItem('device_id') || generateDeviceId(),
  clientId: localStorage.getItem('client_id') || generateClientId(),

  // Protocol version
  protocolVersion: 1,

  // Reconnection settings
  reconnect: true,
  reconnectInterval: 3000, // 3 seconds
  reconnectMaxAttempts: 10,

  // Legacy options (kept for backwards compatibility, not used in native WebSocket)
  path: '/',
  transports: ['websocket', 'polling'],
}

/**
 * Audio Recording Configuration
 * Based on protocol specification
 *
 * IMPORTANT: Currently using PCM format instead of OPUS
 * - WebCodecs API produces raw OPUS frames (no container)
 * - Server expects OPUS in OGG container
 * - PCM avoids format mismatch issues
 */
export const audioRecordingConfig: AudioRecordingConfig = {
  sampleRate: 16000, // 16kHz
  channels: 1, // Mono
  frameDuration: 60, // 60ms
  format: 'opus'  // Note: Actually sending PCM due to server compatibility
}

/**
 * Audio Playback Configuration
 * Server TTS audio parameters
 */
export const audioPlaybackConfig = {
  sampleRate: 16000, // 24kHz (server response)
  channels: 1, // Mono
  frameDuration: 60 // 60ms
}

/**
 * Generate a unique device ID based on browser fingerprint
 */
function generateDeviceId(): string {
  const stored = localStorage.getItem('device_id')
  if (stored) return stored

  // Generate a unique device ID (MAC address format simulation)
  const id = 'XX:XX:XX:XX:XX:XX'.replace(/X/g, () =>
    '0123456789ABCDEF'.charAt(Math.floor(Math.random() * 16))
  )

  localStorage.setItem('device_id', id)
  return id
}

/**
 * Generate a unique client ID (UUID format)
 */
function generateClientId(): string {
  const stored = localStorage.getItem('client_id')
  if (stored) return stored

  // Generate UUID v4
  const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })

  localStorage.setItem('client_id', id)
  return id
}

/**
 * Update access token
 */
export function updateAccessToken(token: string) {
  websocketConfig.accessToken = token
  localStorage.setItem('access_token', token)
}

/**
 * Get access token from localStorage or environment
 */
export function getAccessToken(): string {
  return (
    localStorage.getItem('access_token')
    || websocketConfig.accessToken
    || import.meta.env.VITE_ACCESS_TOKEN
    || ''
  )
}
