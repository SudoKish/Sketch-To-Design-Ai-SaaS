/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { prompts } from "@/prompts";
import {
  ConsumeCreditsQuery,
  CreditsBalanceQuery,
  StyleGuideQuery,
  InspirationImagesQuery,
} from "@/convex/query.config";

export async function POST(request: NextRequest) {
  const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY! });
  try {
    const body = await request.json();
    const {
      userMessage,
      generatedUIId,
      currentHTML,
      wireframeSnapshot,
      projectId,
    } = body;

    if (!userMessage || !generatedUIId || !projectId) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: userMessage, generatedUIId, projectId",
        },
        { status: 400 }
      );
    }

    // Check credits
    const { ok: balanceOk, balance: balanceBalance } =
      await CreditsBalanceQuery();
    if (!balanceOk || balanceBalance === 0) {
      return NextResponse.json(
        { error: "No credits available" },
        { status: 400 }
      );
    }

    // Consume credits
    const { ok } = await ConsumeCreditsQuery({ amount: 1 });
    if (!ok) {
      return NextResponse.json(
        { error: "Failed to consume credits" },
        { status: 500 }
      );
    }

    // Get style guide
    const styleGuide = await StyleGuideQuery(projectId);
    const styleGuideData = styleGuide.styleGuide._valueJSON as unknown as {
      colorSections: unknown[];
      typographySections: unknown[];
    };

    // Get inspiration images
    const inspirationResult = await InspirationImagesQuery(projectId);
    const images = inspirationResult.images._valueJSON as unknown as {
      url: string;
    }[];
    const imageUrls = images.map((img) => img.url).filter(Boolean);

    const colors = styleGuideData?.colorSections || [];
    const typography = styleGuideData?.typographySections || [];

    let userPrompt = `You are an expert UI/UX developer. Please redesign this UI based on my request: "${userMessage}"`;

    if (currentHTML) {
      userPrompt += `\n\nCurrent HTML for reference:\n${currentHTML.substring(0, 1500)}...`;
    }

    if (wireframeSnapshot) {
      userPrompt += `\n\nI'm also providing the original wireframe image as visual context for the layout and structure.`;
    }

    if (colors.length > 0) {
      userPrompt += `\n\nStyle Guide Colors:\n${(
        colors as Array<{
          swatches: Array<{
            name: string;
            hexColor: string;
            description: string;
          }>;
        }>
      )
        .map((color) =>
          color.swatches
            .map(
              (swatch) =>
                `${swatch.name}: ${swatch.hexColor}, ${swatch.description}`
            )
            .join(", ")
        )
        .join(", ")}`;
    }

    if (typography.length > 0) {
      userPrompt += `\n\nTypography:\n${(
        typography as Array<{
          styles: Array<{
            name: string;
            description: string;
            fontFamily: string;
            fontWeight: string;
            fontSize: string;
            lineHeight: string;
          }>;
        }>
      )
        .map((typo) =>
          typo.styles
            .map(
              (style) =>
                `${style.name}: ${style.description}, ${style.fontFamily}, ${style.fontWeight}, ${style.fontSize}, ${style.lineHeight}`
            )
            .join(", ")
        )
        .join(", ")}`;
    }

    userPrompt += `\n\nReturn ONLY the complete HTML – no markdown fences, no explanations, no code blocks. Begin now:`;

    // Build content parts – handle wireframe snapshot (base64 string → Uint8Array)
    const contentParts: any[] = [{ type: "text", text: userPrompt }];

    if (wireframeSnapshot) {
      try {
        // wireframeSnapshot may be "data:image/png;base64,..." or raw base64
        const base64Data = wireframeSnapshot.includes(",")
          ? wireframeSnapshot.split(",")[1]
          : wireframeSnapshot;
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        contentParts.push({ type: "image", image: bytes, mimeType: "image/png" });
      } catch {
        console.warn("[redesign] Failed to parse wireframe snapshot, skipping image");
      }
    }

    // Add inspiration images
    for (const url of imageUrls.slice(0, 2)) {
      try {
        contentParts.push({ type: "image", image: new URL(url) });
      } catch {
        // Skip invalid URLs
      }
    }

    const result = streamText({
      model: google("gemini-2.5-flash"),
      messages: [{ role: "user", content: contentParts }],
      system: prompts.generativeUi.system,
      temperature: 0.7,
      maxOutputTokens: 8192,
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Redesign API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process redesign request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
