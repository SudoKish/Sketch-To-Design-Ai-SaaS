/**
 * Reads a key from .env.local directly when process.env is stale (server not restarted after env change).
 * Used as a reliable fallback for API routes that need env vars loaded at startup time.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

function readEnvLocal(): Record<string, string> {
  try {
    const envPath = join(process.cwd(), '.env.local')
    const content = readFileSync(envPath, 'utf-8')
    const result: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      // Value ends before any inline comment (outside quotes)
      let value = trimmed.slice(eqIdx + 1).trim()
      // Strip inline comments like: VALUE=abc # comment
      const commentIdx = value.search(/ #/)
      if (commentIdx !== -1) value = value.slice(0, commentIdx).trim()
      result[key] = value
    }
    return result
  } catch {
    return {}
  }
}

// Lazy-loaded once per process
let _cache: Record<string, string> | null = null
function getEnvLocal(): Record<string, string> {
  if (!_cache) _cache = readEnvLocal()
  return _cache
}

/**
 * Get an env var reliably — falls back to reading .env.local directly
 * when process.env is stale (dev server not restarted after env file change).
 */
export function getEnv(key: string): string {
  const fromProcess = process.env[key]
  // If process.env has a real value (not empty/whitespace), use it
  if (fromProcess && fromProcess.trim().length > 10) return fromProcess.trim()
  // Fall back to reading .env.local directly
  const fromFile = getEnvLocal()[key]
  if (fromFile && fromFile.trim().length > 10) return fromFile.trim()
  return ''
}
