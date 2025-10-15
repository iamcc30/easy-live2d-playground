import type { WebsocketConfig, AudioRecordingConfig } from '@/types/websocket'

/**
 * Websocket Configuration
 * Update these values based on your server configuration
 */
export const websocketConfig: WebsocketConfig = {
  // Websocket server URL (replace with your actual server URL)
  url: import.meta.env.VITE_WS_URL || 'wss://your-server.com/ws',

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
  reconnectMaxAttempts: 10
}

/**
 * Audio Recording Configuration
 * Based on protocol specification
 */
export const audioRecordingConfig: AudioRecordingConfig = {
  sampleRate: 16000, // 16kHz
  channels: 1, // Mono
  frameDuration: 60, // 60ms
  format: 'opus'
}

/**
 * Audio Playback Configuration
 * Server TTS audio parameters
 */
export const audioPlaybackConfig = {
  sampleRate: 24000, // 24kHz (server response)
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
