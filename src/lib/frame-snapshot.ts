import { Shape, FrameShape } from "@/redux/slice/shapes";

export const isShapeInsideFrame = (
  shape: Shape,
  frame: FrameShape
): boolean => {
  const frameLeft = frame.x;
  const frameTop = frame.y;
  const frameRight = frame.x + frame.w;
  const frameBottom = frame.y + frame.h;

  switch (shape.type) {
    case "rect":
    case "ellipse":
    case "frame":
      // Check if shape center point is within frame
      const centerX = shape.x + shape.w / 2;
      const centerY = shape.y + shape.h / 2;
      return (
        centerX >= frameLeft &&
        centerX <= frameRight &&
        centerY >= frameTop &&
        centerY <= frameBottom
      );

    case "text":
      // Check if text position is within frame
      return (
        shape.x >= frameLeft &&
        shape.x <= frameRight &&
        shape.y >= frameTop &&
        shape.y <= frameBottom
      );

    case "freedraw":
      // Check if any drawing points are within frame
      return shape.points.some(
        (point) =>
          point.x >= frameLeft &&
          point.x <= frameRight &&
          point.y >= frameTop &&
          point.y <= frameBottom
      );

    case "line":
    case "arrow":
      // Check if either start or end point is within frame
      const startInside =
        shape.startX >= frameLeft &&
        shape.startX <= frameRight &&
        shape.startY >= frameTop &&
        shape.startY <= frameBottom;
      const endInside =
        shape.endX >= frameLeft &&
        shape.endX <= frameRight &&
        shape.endY >= frameTop &&
        shape.endY <= frameBottom;
      return startInside || endInside;

    default:
      return false;
  }
};

export const getShapesInsideFrame = (
  shapes: Shape[],
  frame: FrameShape
): Shape[] => {
  // Simple coordinate-based detection: find shapes within frame bounds
  const shapesInFrame = shapes.filter(
    (shape) => shape.id !== frame.id && isShapeInsideFrame(shape, frame)
  );

  console.log(`Frame ${frame.frameNumber} capture:`, {
    totalShapes: shapes.length,
    captured: shapesInFrame.length,
    capturedTypes: shapesInFrame.map((s) => s.type),
  });

  return shapesInFrame;
};

/**
 * Build a textual description of all shapes inside a frame.
 * This is sent alongside the image so the AI can understand the layout
 * even if the sketch is rough or faint.
 */
export const buildShapeDescription = (
  shapes: Shape[],
  frame: FrameShape
): string => {
  const inside = getShapesInsideFrame(shapes, frame);
  if (inside.length === 0) {
    return `An empty wireframe canvas (${Math.round(frame.w)}×${Math.round(frame.h)}px).`;
  }

  const lines: string[] = [
    `Wireframe dimensions: ${Math.round(frame.w)}×${Math.round(frame.h)}px`,
    `Contains ${inside.length} elements:`,
  ];

  inside.forEach((shape, i) => {
    const idx = i + 1;
    // Relative position within frame
    const relX = (s: number) => Math.round(s - frame.x);
    const relY = (s: number) => Math.round(s - frame.y);

    switch (shape.type) {
      case "text":
        lines.push(
          `  ${idx}. TEXT "${shape.text}" at position (${relX(shape.x)}, ${relY(shape.y)}), fontSize: ${shape.fontSize}px`
        );
        break;
      case "rect":
        lines.push(
          `  ${idx}. RECTANGLE at (${relX(shape.x)}, ${relY(shape.y)}), size: ${Math.round(shape.w)}×${Math.round(shape.h)}px`
        );
        break;
      case "ellipse":
        lines.push(
          `  ${idx}. ELLIPSE/CIRCLE at (${relX(shape.x)}, ${relY(shape.y)}), size: ${Math.round(shape.w)}×${Math.round(shape.h)}px`
        );
        break;
      case "freedraw":
        lines.push(
          `  ${idx}. FREEHAND DRAWING (${shape.points.length} points) — likely a sketch annotation or shape`
        );
        break;
      case "arrow":
        lines.push(
          `  ${idx}. ARROW from (${relX(shape.startX)}, ${relY(shape.startY)}) to (${relX(shape.endX)}, ${relY(shape.endY)})`
        );
        break;
      case "line":
        lines.push(
          `  ${idx}. LINE from (${relX(shape.startX)}, ${relY(shape.startY)}) to (${relX(shape.endX)}, ${relY(shape.endY)})`
        );
        break;
    }
  });

  // Infer layout hints
  const texts = inside.filter((s) => s.type === "text") as Array<{ text: string; y: number; x: number }>;
  const rects = inside.filter((s) => s.type === "rect");
  const ellipses = inside.filter((s) => s.type === "ellipse");

  lines.push("\nLayout hints:");
  if (texts.length > 0) {
    lines.push(`  - Text labels found: ${texts.map((t) => `"${t.text}"`).join(", ")}`);
  }
  if (rects.length > 0) {
    lines.push(`  - ${rects.length} rectangle(s) — likely buttons, cards, or content areas`);
  }
  if (ellipses.length > 0) {
    lines.push(`  - ${ellipses.length} circle/ellipse(s) — likely avatars, icons, or decorative elements`);
  }

  return lines.join("\n");
};

const renderShapeOnCanvas = (
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  frameX: number,
  frameY: number
) => {
  ctx.save();

  switch (shape.type) {
    case "rect":
    case "ellipse":
    case "frame":
      // These shapes have x, y, w, h properties
      const relativeX = shape.x - frameX;
      const relativeY = shape.y - frameY;

      if (shape.type === "rect" || shape.type === "frame") {
        // Render rounded rectangles and frames — dark on white background
        const rawStroke = shape.stroke;
        ctx.strokeStyle =
          !rawStroke || rawStroke === "transparent" || rawStroke === "#ffff" || rawStroke === "#ffffff"
            ? "#1a1a1a"
            : rawStroke;
        ctx.lineWidth = shape.strokeWidth || 2;

        // Draw rounded rectangle for rect shapes, regular for frames
        const borderRadius = shape.type === "rect" ? 8 : 0;
        ctx.beginPath();
        ctx.roundRect(relativeX, relativeY, shape.w, shape.h, borderRadius);
        ctx.stroke();
      } else if (shape.type === "ellipse") {
        // Render only border/stroke for ellipses — dark on white background
        const rawStroke = shape.stroke;
        ctx.strokeStyle =
          !rawStroke || rawStroke === "transparent" || rawStroke === "#ffff" || rawStroke === "#ffffff"
            ? "#1a1a1a"
            : rawStroke;
        ctx.lineWidth = shape.strokeWidth || 2;
        ctx.beginPath();
        ctx.ellipse(
          relativeX + shape.w / 2,
          relativeY + shape.h / 2,
          shape.w / 2,
          shape.h / 2,
          0,
          0,
          2 * Math.PI
        );
        ctx.stroke();
      }
      break;

    case "text":
      // Text shape has x, y properties — dark text on white background
      const textRelativeX = shape.x - frameX;
      const textRelativeY = shape.y - frameY;
      const rawFill = shape.fill;
      ctx.fillStyle =
        !rawFill || rawFill === "#ffffff" || rawFill === "#ffff"
          ? "#1a1a1a"
          : rawFill;
      ctx.font = `bold ${shape.fontSize}px ${shape.fontFamily || "Inter, sans-serif"}`;
      ctx.textBaseline = "top";
      ctx.fillText(shape.text, textRelativeX, textRelativeY);
      break;

    case "freedraw":
      if (shape.points.length > 1) {
        const rawFdStroke = shape.stroke;
        ctx.strokeStyle =
          !rawFdStroke || rawFdStroke === "#ffff" || rawFdStroke === "#ffffff"
            ? "#1a1a1a"
            : rawFdStroke;
        ctx.lineWidth = shape.strokeWidth || 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        const firstPoint = shape.points[0];
        ctx.moveTo(firstPoint.x - frameX, firstPoint.y - frameY);

        for (let i = 1; i < shape.points.length; i++) {
          const point = shape.points[i];
          ctx.lineTo(point.x - frameX, point.y - frameY);
        }
        ctx.stroke();
      }
      break;

    case "line": {
      const rawLineStroke = shape.stroke;
      ctx.strokeStyle =
        !rawLineStroke || rawLineStroke === "#ffff" || rawLineStroke === "#ffffff"
          ? "#1a1a1a"
          : rawLineStroke;
      ctx.lineWidth = shape.strokeWidth || 2;
      ctx.beginPath();
      ctx.moveTo(shape.startX - frameX, shape.startY - frameY);
      ctx.lineTo(shape.endX - frameX, shape.endY - frameY);
      ctx.stroke();
      break;
    }

    case "arrow": {
      // Draw line — dark on white
      const rawArrowStroke = shape.stroke;
      const arrowColor =
        !rawArrowStroke || rawArrowStroke === "#ffff" || rawArrowStroke === "#ffffff"
          ? "#1a1a1a"
          : rawArrowStroke;
      ctx.strokeStyle = arrowColor;
      ctx.lineWidth = shape.strokeWidth || 2;
      ctx.beginPath();
      ctx.moveTo(shape.startX - frameX, shape.startY - frameY);
      ctx.lineTo(shape.endX - frameX, shape.endY - frameY);
      ctx.stroke();

      // Draw arrowhead
      const headLength = 10;
      const angle = Math.atan2(
        shape.endY - shape.startY,
        shape.endX - shape.startX
      );
      ctx.fillStyle = arrowColor;
      ctx.beginPath();
      ctx.moveTo(shape.endX - frameX, shape.endY - frameY);
      ctx.lineTo(
        shape.endX - frameX - headLength * Math.cos(angle - Math.PI / 6),
        shape.endY - frameY - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        shape.endX - frameX - headLength * Math.cos(angle + Math.PI / 6),
        shape.endY - frameY - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
      break;
    }
  }

  ctx.restore();
};

export const generateFrameSnapshot = async (
  frame: FrameShape,
  allShapes: Shape[]
): Promise<Blob> => {
  // Get shapes inside the frame
  const shapesInFrame = getShapesInsideFrame(allShapes, frame);

  // Create canvas with frame dimensions
  console.log("🎨 Creating canvas");
  const canvas = document.createElement("canvas");
  canvas.width = frame.w;
  canvas.height = frame.h;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }
  // Set WHITE background so shapes are visible to AI vision models
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Set clipping region to frame bounds for clean rendering
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.clip();

  // Render each shape inside the frame
  shapesInFrame.forEach((shape) => {
    renderShapeOnCanvas(ctx, shape, frame.x, frame.y);
  });

  ctx.restore();
  console.log("✅ All shapes rendered");

  // Convert canvas to blob
  console.log("💾 Converting canvas to blob...");
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          console.log("✅ Blob created successfully:", {
            size: blob.size,
            type: blob.type,
          });
          resolve(blob);
        } else {
          console.error("❌ Failed to create image blob");
          reject(new Error("Failed to create image blob"));
        }
      },
      "image/png",
      1.0
    );
  });
};

export const sendFrameToAPI = async (
  frameSnapshot: Blob,
  frameNumber: number
): Promise<Response> => {
  const formData = new FormData();
  formData.append("image", frameSnapshot, `frame-${frameNumber}.png`);
  formData.append("frameNumber", frameNumber.toString());

  const response = await fetch("/api/generate", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response;
};

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const captureVisualContent = async (
  ctx: CanvasRenderingContext2D,
  contentDiv: HTMLElement,
  width: number,
  height: number
) => {
  console.log("🎨 Capturing visual content from original element");

  // Use html-to-image directly on the original element
  const { toPng } = await import("html-to-image");

  const dataUrl = await toPng(contentDiv, {
    width: width,
    height: height,
    backgroundColor: "#ffffff",
    pixelRatio: 1,
    cacheBust: true,
    includeQueryParams: false,
    skipAutoScale: true,
    skipFonts: true,
    filter: (node) => {
      // Only include text and element nodes, exclude interactive elements
      if (node.nodeType === Node.TEXT_NODE) return true;
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        return ![
          "SCRIPT",
          "STYLE",
          "BUTTON",
          "INPUT",
          "SELECT",
          "TEXTAREA",
        ].includes(element.tagName);
      }
      return true;
    },
  });

  // Create an image from the data URL and draw it to canvas
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      console.log("✅ Visual content captured successfully");
      resolve(void 0);
    };
    img.onerror = () => {
      reject(new Error("Failed to load captured image"));
    };
    img.src = dataUrl;
  });
};

export const exportGeneratedUIAsPNG = async (
  element: HTMLElement,
  filename: string
): Promise<void> => {
  console.log("📸 Taking manual snapshot of GeneratedUI element");
  console.log("🎯 Element:", element);

  try {
    // Get the actual dimensions of the element
    const rect = element.getBoundingClientRect();
    console.log("📏 Element dimensions:", {
      width: rect.width,
      height: rect.height,
      x: rect.x,
      y: rect.y,
    });

    // Create canvas with element dimensions
    const canvas = document.createElement("canvas");
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    // Set white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Find the content area (the div with the actual UI content)
    const contentDiv = element.querySelector(
      'div[style*="pointer-events: auto"]'
    ) as HTMLElement;

    if (contentDiv) {
      console.log("🎨 Found content div, capturing visual content");
      // Capture the visual content exactly as it appears
      await captureVisualContent(ctx, contentDiv, rect.width, rect.height);
    } else {
      throw new Error("No content div found for export");
    }

    // Convert canvas to blob and download
    canvas.toBlob(
      (blob) => {
        if (blob) {
          console.log("✅ GeneratedUI snapshot created successfully:", {
            size: blob.size,
            type: blob.type,
            filename,
          });
          downloadBlob(blob, filename);
        } else {
          console.error("❌ Failed to create GeneratedUI snapshot blob");
        }
      },
      "image/png",
      1.0
    );
  } catch (error) {
    console.error("❌ Failed to capture GeneratedUI snapshot:", error);
    // Import toast dynamically to avoid circular dependencies
    const { toast } = await import("sonner");
    toast.error("Failed to export design. Please try again.");
    throw error;
  }
};
