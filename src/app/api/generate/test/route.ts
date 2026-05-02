import { NextRequest, NextResponse } from 'next/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { getEnv } from '@/lib/get-env'

/**
 * GET /api/generate/test
 * Quick smoke-test that Claude Vision is working.
 * Returns { ok: true, preview: "first 200 chars of HTML" } or { ok: false, error: "..." }
 */
export async function GET(request: NextRequest) {
  const anthropic = createAnthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') })
  try {
    // 1x1 white PNG in base64 – minimal valid image
    const tiny1x1png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=='

    const { text } = await generateText({
      model: anthropic('claude-3-5-sonnet-20241022'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Generate a minimal single-div HTML snippet that says "Claude Vision works!" in a styled box. Return ONLY the HTML, no explanation.',
            },
            {
              type: 'image',
              image: tiny1x1png,
            },
          ],
        },
      ],
      maxOutputTokens: 200,
    })

    return NextResponse.json({
      ok: true,
      model: 'claude-3-5-sonnet-20241022',
      preview: text.slice(0, 300),
      length: text.length,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
