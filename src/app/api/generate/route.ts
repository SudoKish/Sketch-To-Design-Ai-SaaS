/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { streamText } from 'ai'
import { prompts } from '@/prompts'

/**
 * Strip markdown code fences that Gemini sometimes wraps around HTML output.
 * e.g. ```html\n<div>...</div>\n``` → <div>...</div>
 */
function stripCodeFences(text: string): string {
  // Remove leading ```html or ``` and trailing ```
  let cleaned = text.trim()
  // Match opening fence: ```html, ```HTML, or just ```
  cleaned = cleaned.replace(/^```(?:html|HTML)?\s*\n?/, '')
  // Match closing fence
  cleaned = cleaned.replace(/\n?```\s*$/, '')
  return cleaned.trim()
}
import {
  InspirationImagesQuery,
  StyleGuideQuery,
} from '@/convex/query.config'
import { getEnv } from '@/lib/get-env'

export async function POST(request: NextRequest) {
  const google = createGoogleGenerativeAI({ apiKey: getEnv('GEMINI_API_KEY') })

  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const projectId = formData.get('projectId') as string
    // Text description of shapes (always present, makes generation work even from rough sketches)
    const shapeDescription = (formData.get('shapeDescription') as string) || ''

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      )
    }

    if (!imageFile.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images are allowed.' },
        { status: 400 }
      )
    }

    // Convert image to Uint8Array — Gemini AI SDK v2 requires this format
    const imageBuffer = await imageFile.arrayBuffer()
    const imageUint8 = new Uint8Array(imageBuffer)
    const mimeType = (imageFile.type || 'image/png') as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'

    // ── Fetch style guide & inspiration images – gracefully fall back on any error ──
    let colors: any[] = []
    let typography: any[] = []
    let imageUrls: string[] = []

    if (projectId && projectId !== 'null') {
      try {
        const styleGuide = await StyleGuideQuery(projectId)
        const guide = (styleGuide?.styleGuide?._valueJSON as any) || {}
        colors = guide.colorSections || []
        typography = guide.typographySections || []
      } catch (e) {
        console.warn('[generate] StyleGuideQuery failed, using defaults:', e)
      }

      try {
        const inspirationImages = await InspirationImagesQuery(projectId)
        const imgs = ((inspirationImages?.images?._valueJSON as unknown) as any[]) || []
        imageUrls = imgs.map((img: any) => img.url).filter(Boolean)
      } catch (e) {
        console.warn('[generate] InspirationImagesQuery failed, skipping images:', e)
      }
    }

    // ── Build prompts ──
    const colorStr = colors
      .flatMap((section: any) =>
        (section.swatches || []).map(
          (s: any) => `${s.name}: ${s.hexColor}${s.description ? ` (${s.description})` : ''}`
        )
      )
      .join(', ')

    const typographyStr = typography
      .flatMap((section: any) =>
        (section.styles || []).map(
          (s: any) =>
            `${s.name}: ${s.fontFamily} ${s.fontWeight} ${s.fontSize} / ${s.lineHeight}`
        )
      )
      .join(', ')

    const systemPrompt = prompts.generativeUi.system

    const userPrompt = `You are an expert UI/UX developer. Your job is to convert a wireframe into a beautiful, production-ready HTML UI.

WIREFRAME DESCRIPTION (use this as your primary layout guide):
${shapeDescription || 'A general wireframe layout with navigation, content areas, and UI elements.'}

STYLE GUIDE:
Colors: ${colorStr || 'Modern dark theme with white text and purple accents (#7c3aed, #8b5cf6)'}
Typography: ${typographyStr || 'Inter, sans-serif; headings bold 600-700, body regular 400'}

INSPIRATION: ${imageUrls.length > 0 ? imageUrls.join(', ') : 'Use placeholder images from https://picsum.photos'}

ABSOLUTE RULES — YOU MUST FOLLOW THESE:
1. You MUST generate complete HTML. No exceptions. Even if the wireframe is rough or unclear.
2. Use the wireframe description above as your layout guide. Interpret each element intelligently:
   - TEXT elements → navigation labels, headings, buttons, or body text
   - RECTANGLE elements → buttons, cards, panels, forms, or containers
   - ELLIPSE/CIRCLE elements → avatars, profile pictures, icons, or image placeholders
   - FREEHAND DRAWING → decorative shapes, charts, or image areas
   - ARROWS/LINES → dividers, connectors, or flow indicators
3. Use Tailwind CSS utility classes for layout and spacing
4. Apply colors via custom CSS variables in an inline <style> block
5. NEVER use vh/vw units or h-screen
6. Wrap ALL output in <div data-generated-ui>...</div>
7. Return ONLY raw HTML — zero markdown, zero code fences, zero explanation
8. Make it BEAUTIFUL — premium design, gradients, shadows, hover effects
9. Use https://picsum.photos/[width]/[height] for image placeholders

An image of the wireframe is also attached — use it for additional visual context, but prioritize the text description above for layout accuracy.

BEGIN HTML OUTPUT NOW (start with <div data-generated-ui>):`

    // ── Build content array for Gemini ──
    const contentParts: any[] = [
      {
        type: 'text',
        text: userPrompt,
      },
      {
        type: 'image',
        image: imageUint8,
        mimeType,
      },
    ]

    // Add inspiration image URLs
    for (const url of imageUrls.slice(0, 2)) {
      try {
        contentParts.push({
          type: 'image',
          image: new URL(url),
        })
      } catch {
        // Skip invalid URLs
      }
    }

    // ── Stream from Gemini ──
    console.log('[generate] Starting Gemini streamText with model: gemini-2.5-flash')
    console.log('[generate] API key present:', !!getEnv('GEMINI_API_KEY'))
    console.log('[generate] Shape description length:', shapeDescription.length)

    const result = streamText({
      model: google('gemini-2.5-flash'),
      messages: [
        {
          role: 'user',
          content: contentParts,
        },
      ],
      system: systemPrompt,
      temperature: 0.4,
      maxOutputTokens: 65536,
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 2048,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          ],
        },
      },
    })

    // ── Convert AI text stream → ReadableStream for the browser ──
    // We accumulate the full response first so we can strip code fences,
    // then send it as a single response to the browser.
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let fullText = ''
        try {
          for await (const chunk of result.textStream) {
            fullText += chunk
          }

          // Strip markdown code fences that Gemini might have wrapped
          const cleaned = stripCodeFences(fullText)
          console.log('[generate] Response received, length:', fullText.length, '→ cleaned:', cleaned.length)

          if (cleaned.length < 50) {
            console.error('[generate] AI returned too little content. Raw output:', fullText.slice(0, 500))
          }

          controller.enqueue(encoder.encode(cleaned))
          controller.close()
        } catch (streamError) {
          console.error('[generate] Stream error:', streamError)
          // Send an error message as HTML so the client can display it
          const errMsg = streamError instanceof Error ? streamError.message : 'Unknown streaming error'
          console.error('[generate] Full error details:', JSON.stringify(streamError, null, 2))
          controller.error(streamError)
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Generation-Model': 'gemini-2.5-flash',
      },
    })
  } catch (error) {
    console.error('[generate] Fatal error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate UI design',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
