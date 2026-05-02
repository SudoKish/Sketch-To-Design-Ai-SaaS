import { FrameShape } from "@/redux/slice/shapes";
import { LiquidGlassButton } from "@/components/buttons/liquid-glass";
import { Brush, Palette, Download, Loader2 } from "lucide-react";
import { useFrame } from "@/hooks/use-canvas";

export const Frame = ({
  shape,
  toggleInspiration,
}: {
  shape: FrameShape;
  toggleInspiration: () => void;
}) => {
  const { isGenerating, handleGenerateDesign, handleDownloadDesign } = useFrame(shape);

  return (
    <>
      <div
        className="absolute pointer-events-none backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] saturate-150"
        style={{
          left: shape.x,
          top: shape.y,
          width: shape.w,
          height: shape.h,
          borderRadius: "12px",
        }}
      />
      <div
        className="absolute pointer-events-none whitespace-nowrap text-xs font-medium text-white/80 select-none"
        style={{
          left: shape.x,
          top: shape.y - 24,
          fontSize: "11px",
          lineHeight: "1.2",
        }}
      >
        Frame {shape.frameNumber}
      </div>
      <div
        className="absolute pointer-events-auto flex gap-4"
        style={{
          left: shape.x + shape.w - 350,
          top: shape.y - 36,
          zIndex: 1000,
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <LiquidGlassButton
          size="sm"
          variant="subtle"
          onClick={handleDownloadDesign}
          disabled={isGenerating}
          style={{ pointerEvents: "auto" }}
        >
          <Download size={12} />
          Save to Desktop
        </LiquidGlassButton>
        <LiquidGlassButton
          size="sm"
          variant="subtle"
          onClick={toggleInspiration}
          style={{ pointerEvents: "auto" }}
        >
          <Palette size={12} />
          Inspiration
        </LiquidGlassButton>
        <LiquidGlassButton
          size="sm"
          variant="subtle"
          onClick={handleGenerateDesign}
          disabled={isGenerating}
          style={{
            pointerEvents: "auto",
            opacity: isGenerating ? 0.65 : 1,
            cursor: isGenerating ? "not-allowed" : "pointer",
          }}
        >
          {isGenerating ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Brush size={12} />
          )}
          {isGenerating ? "Generating…" : "Generate Design"}
        </LiquidGlassButton>
      </div>
    </>
  );
};
