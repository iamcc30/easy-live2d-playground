/**
 * Browser Capabilities Detection Utility
 *
 * Provides runtime checks for browser feature support
 */

export interface BrowserCapabilities {
  getUserMedia: boolean
  audioContext: boolean
  webCodecs: boolean
  isSecureContext: boolean
  protocol: string
}

/**
 * Check if getUserMedia API is available
 */
export function isGetUserMediaSupported(): boolean {
  return !!(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  )
}

/**
 * Check if AudioContext is available
 */
export function isAudioContextSupported(): boolean {
  return !!(
    window.AudioContext ||
    (window as any).webkitAudioContext
  )
}

/**
 * Check if WebCodecs API is available
 */
export function isWebCodecsSupported(): boolean {
  return !!(
    typeof AudioEncoder !== 'undefined' &&
    typeof AudioDecoder !== 'undefined'
  )
}

/**
 * Check if running in secure context (HTTPS or localhost)
 */
export function isSecureContext(): boolean {
  return window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost'
}

/**
 * Get comprehensive browser capabilities
 */
export function getBrowserCapabilities(): BrowserCapabilities {
  return {
    getUserMedia: isGetUserMediaSupported(),
    audioContext: isAudioContextSupported(),
    webCodecs: isWebCodecsSupported(),
    isSecureContext: isSecureContext(),
    protocol: window.location.protocol
  }
}

/**
 * Get detailed error message for unsupported features
 */
export function getUnsupportedFeatureMessage(capabilities: BrowserCapabilities): string | null {
  const issues: string[] = []

  if (!capabilities.isSecureContext) {
    issues.push(`❌ Insecure context (${capabilities.protocol}). getUserMedia requires HTTPS or localhost.`)
  }

  if (!capabilities.getUserMedia) {
    issues.push('❌ getUserMedia API not supported. Update to a modern browser (Chrome 53+, Firefox 36+, Safari 11+).')
  }

  if (!capabilities.audioContext) {
    issues.push('❌ AudioContext not supported. Audio processing unavailable.')
  }

  if (issues.length > 0) {
    return issues.join('\n')
  }

  return null
}

/**
 * Log browser capabilities for debugging
 */
export function logBrowserCapabilities(): void {
  const capabilities = getBrowserCapabilities()

  console.group('🌐 Browser Capabilities')
  console.log('getUserMedia:', capabilities.getUserMedia ? '✅' : '❌')
  console.log('AudioContext:', capabilities.audioContext ? '✅' : '❌')
  console.log('WebCodecs:', capabilities.webCodecs ? '✅' : '❌')
  console.log('Secure Context:', capabilities.isSecureContext ? '✅' : '❌')
  console.log('Protocol:', capabilities.protocol)

  const errorMessage = getUnsupportedFeatureMessage(capabilities)
  if (errorMessage) {
    console.warn('⚠️ Issues detected:')
    console.warn(errorMessage)
  }

  console.groupEnd()
}
