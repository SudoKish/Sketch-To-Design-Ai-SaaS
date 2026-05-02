"use client";
import { GeneratedUIShape, GenerationStage } from "@/redux/slice/shapes";
import { useUpdateContainer } from "@/hooks/use-styles";
import { MessageCircle, Workflow, Download, Sparkles, Zap, Brain, Upload, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { LiquidGlassButton } from "@/components/buttons/liquid-glass";
import { useEffect, useRef, useState } from "react";

// ─── Progress stage metadata ────────────────────────────────────────────────
const STAGE_META: Record<
  GenerationStage,
  { label: string; sublabel: string; icon: React.ReactNode; color: string }
> = {
  idle: {
    label: "Waiting…",
    sublabel: "Ready to generate your design",
    icon: <Sparkles size={20} />,
    color: "#a78bfa",
  },
  capturing: {
    label: "Capturing sketch",
    sublabel: "Taking a snapshot of your wireframe canvas",
    icon: <Zap size={20} />,
    color: "#60a5fa",
  },
  uploading: {
    label: "Uploading to AI",
    sublabel: "Sending your sketch to the design engine",
    icon: <Upload size={20} />,
    color: "#34d399",
  },
  analyzing: {
    label: "AI analyzing layout",
    sublabel: "Understanding structure, hierarchy & intent",
    icon: <Brain size={20} />,
    color: "#f59e0b",
  },
  generating: {
    label: "AI generating design",
    sublabel: "Crafting production-ready HTML from your sketch",
    icon: <Sparkles size={20} />,
    color: "#a78bfa",
  },
  streaming: {
    label: "Streaming design…",
    sublabel: "Receiving and rendering your UI in real-time",
    icon: <Sparkles size={20} />,
    color: "#a78bfa",
  },
  done: {
    label: "Design complete!",
    sublabel: "Your UI is ready. Use the buttons above to chat or export.",
    icon: <CheckCircle2 size={20} />,
    color: "#34d399",
  },
  error: {
    label: "Generation failed",
    sublabel: "Something went wrong. Please try again.",
    icon: <XCircle size={20} />,
    color: "#f87171",
  },
};

// Fun messages shown while streaming to keep users engaged
const STREAMING_QUIPS = [
  "Turning wireframes into pixel-perfect UI… ✨",
  "AI is applying your style guide colors…",
  "Building your typography hierarchy…",
  "Composing layout sections…",
  "Adding spacing & visual breathing room…",
  "Almost there — polishing the details…",
  "Generating semantic HTML & accessibility attributes…",
  "Optimizing component structure…",
  "Matching inspiration images to layout slots…",
];

// ─── Animated dots component ─────────────────────────────────────────────────
const AnimatedDots = () => {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const id = setInterval(
      () => setDots((d) => (d.length >= 3 ? "" : d + ".")),
      500
    );
    return () => clearInterval(id);
  }, []);
  return <span className="inline-block w-6 text-left">{dots}</span>;
};

// ─── Skeleton shimmer rows ───────────────────────────────────────────────────
const SkeletonBlock = ({ w = "100%", h = 14, delay = 0 }: { w?: string; h?: number; delay?: number }) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: 6,
      background: "linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.13) 50%, rgba(255,255,255,0.06) 75%)",
      backgroundSize: "200% 100%",
      animation: `shimmer 1.6s infinite ${delay}ms`,
      marginBottom: 8,
    }}
  />
);

// ─── Main component ──────────────────────────────────────────────────────────
export const GeneratedUI = ({
  shape,
  toggleChat,
  generateWorkflow,
  exportDesign,
}: {
  shape: GeneratedUIShape;
  toggleChat: (generatedUIId: string) => void;
  generateWorkflow: (generatedUIId: string) => void;
  exportDesign: (generatedUIId: string, element: HTMLElement | null) => void;
}) => {
  const { sanitizeHtml, containerRef } = useUpdateContainer(shape);

  // Handle legacy shapes (generated before stage tracking was added)
  const rawStage = shape.generationStage;
  const hasContent = shape.uiSpecData && shape.uiSpecData.trim().length > 20;
  // If no stage is set but we have content, treat as done
  const stage: GenerationStage = rawStage ?? (hasContent ? "done" : "generating");
  const progress = shape.generationProgress ?? 0;
  const streamedKB = ((shape.streamedBytes ?? 0) / 1024).toFixed(1);
  const isLoading = stage !== "done" && stage !== "error";
  // If done but empty content, show error
  const isDoneButEmpty = stage === "done" && !hasContent;

  // Rotate quips while streaming
  const [quipIdx, setQuipIdx] = useState(0);
  const quipRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (stage === "streaming" || stage === "analyzing") {
      quipRef.current = setInterval(
        () => setQuipIdx((i) => (i + 1) % STREAMING_QUIPS.length),
        3500
      );
    }
    return () => {
      if (quipRef.current) clearInterval(quipRef.current);
    };
  }, [stage]);

  const meta = STAGE_META[stage] ?? STAGE_META["generating"];

  const handleToggleChat = () => toggleChat(shape.id);
  const handleGenerateWorkflow = () => generateWorkflow(shape.id);
  const handleExportDesign = () => {
    if (!shape.uiSpecData) return;
    exportDesign(shape.id, containerRef.current);
  };

  return (
    <>
      {/* Shimmer keyframes injected once */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(167,139,250,0.25); }
          50%        { box-shadow: 0 0 0 8px rgba(167,139,250,0); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        ref={containerRef}
        className="absolute pointer-events-none"
        style={{
          left: shape.x,
          top: shape.y,
          width: shape.w,
          height: "auto",
        }}
      >
        {/* ── Action buttons (always shown above the card) ── */}
        <div className="absolute -top-8 right-0 flex gap-2" style={{ pointerEvents: "auto" }}>
          <LiquidGlassButton
            size="sm"
            variant="subtle"
            onClick={handleExportDesign}
            disabled={!shape.uiSpecData}
            style={{ pointerEvents: "auto" }}
          >
            <Download size={12} />
            Export
          </LiquidGlassButton>
          <LiquidGlassButton
            size="sm"
            variant="subtle"
            onClick={handleGenerateWorkflow}
            style={{ pointerEvents: "auto" }}
          >
            <Workflow size={12} />
            Generate Workflow
          </LiquidGlassButton>
          <LiquidGlassButton
            size="sm"
            variant="subtle"
            onClick={handleToggleChat}
            style={{ pointerEvents: "auto" }}
          >
            <MessageCircle size={12} />
            Design Chat
          </LiquidGlassButton>
        </div>

        {/* ── Card ── */}
        <div
          className="w-full h-auto relative rounded-lg border border-white/20 bg-white/5 backdrop-blur-sm"
          style={{
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            padding: "16px",
            minHeight: 120,
            position: "relative",
            animation: isLoading ? "pulse-glow 2.4s ease-in-out infinite" : "none",
          }}
        >
          {/* ── LOADING STATE ── */}
          {isLoading && (
            <div style={{ pointerEvents: "auto" }}>
              {/* ── Header row ── */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 16,
                  animation: "fade-up 0.4s ease",
                }}
              >
                {/* Spinning icon */}
                <div
                  style={{
                    color: meta.color,
                    animation: (stage as GenerationStage) === "done" || (stage as GenerationStage) === "error" ? "none" : "spin-slow 2s linear infinite",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {meta.icon}
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.9)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {meta.label}
                    {isLoading && <AnimatedDots />}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                    {stage === "streaming" ? STREAMING_QUIPS[quipIdx] : meta.sublabel}
                  </div>
                </div>

                {/* KB counter while streaming */}
                {stage === "streaming" && (
                  <div
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.4)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {streamedKB} KB
                  </div>
                )}
              </div>

              {/* ── Progress bar ── */}
              <div
                style={{
                  height: 4,
                  borderRadius: 9999,
                  background: "rgba(255,255,255,0.08)",
                  overflow: "hidden",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 9999,
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${meta.color}99, ${meta.color})`,
                    transition: "width 0.4s ease, background 0.6s ease",
                    boxShadow: `0 0 8px ${meta.color}66`,
                  }}
                />
              </div>

              {/* ── Stage steps ── */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginBottom: 20,
                  flexWrap: "wrap",
                }}
              >
                {(
                  [
                    ["capturing", "Capture"],
                    ["uploading", "Upload"],
                    ["analyzing", "Analyze"],
                    ["streaming", "Generate"],
                  ] as [GenerationStage, string][]
                ).map(([s, label]) => {
                  const stageOrder: GenerationStage[] = [
                    "capturing",
                    "uploading",
                    "analyzing",
                    "streaming",
                    "done",
                  ];
                  const currentIdx = stageOrder.indexOf(stage);
                  const stepIdx = stageOrder.indexOf(s);
                  const isPast = currentIdx > stepIdx;
                  const isCurrent = currentIdx === stepIdx;

                  return (
                    <div
                      key={s}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "3px 8px",
                        borderRadius: 9999,
                        fontSize: 10,
                        fontWeight: 500,
                        background: isPast
                          ? "rgba(52,211,153,0.15)"
                          : isCurrent
                          ? `${meta.color}22`
                          : "rgba(255,255,255,0.04)",
                        color: isPast
                          ? "#34d399"
                          : isCurrent
                          ? meta.color
                          : "rgba(255,255,255,0.25)",
                        border: `1px solid ${
                          isPast
                            ? "rgba(52,211,153,0.3)"
                            : isCurrent
                            ? `${meta.color}44`
                            : "rgba(255,255,255,0.07)"
                        }`,
                        transition: "all 0.4s ease",
                      }}
                    >
                      {isPast ? (
                        <CheckCircle2 size={9} />
                      ) : isCurrent ? (
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: meta.color,
                            animation: "pulse-glow 1.2s ease-in-out infinite",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.15)",
                          }}
                        />
                      )}
                      {label}
                    </div>
                  );
                })}
              </div>

              {/* ── Skeleton preview (only while streaming/generating) ── */}
              {(stage === "streaming" || stage === "generating" || stage === "analyzing") && (
                <div style={{ opacity: 0.5 }}>
                  {/* Fake nav */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 16px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.04)",
                      marginBottom: 12,
                    }}
                  >
                    <SkeletonBlock w="60px" h={10} />
                    <div style={{ flex: 1 }} />
                    <SkeletonBlock w="40px" h={10} delay={100} />
                    <SkeletonBlock w="40px" h={10} delay={200} />
                    <SkeletonBlock w="40px" h={10} delay={300} />
                  </div>
                  {/* Fake hero */}
                  <SkeletonBlock w="100%" h={80} delay={150} />
                  {/* Fake 3-col cards */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <SkeletonBlock w="33%" h={40} delay={200} />
                    <SkeletonBlock w="33%" h={40} delay={300} />
                    <SkeletonBlock w="33%" h={40} delay={400} />
                  </div>
                  {/* Text lines */}
                  <SkeletonBlock w="80%" h={10} delay={250} />
                  <SkeletonBlock w="60%" h={10} delay={350} />
                  <SkeletonBlock w="70%" h={10} delay={450} />
                </div>
              )}

              {/* ── Tip at the bottom ── */}
              <div
                style={{
                  marginTop: 12,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "rgba(167,139,250,0.08)",
                  border: "1px solid rgba(167,139,250,0.15)",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  lineHeight: 1.5,
                }}
              >
                💡 <strong style={{ color: "rgba(255,255,255,0.55)" }}>Tip:</strong>{" "}
                {stage === "capturing" && "The higher-detail your sketch, the better the output."}
                {stage === "uploading" && "Your wireframe is being compressed & sent securely."}
                {stage === "analyzing" && "AI reads every label, shape & arrow in your sketch."}
                {(stage === "streaming" || stage === "generating") &&
                  "You can already scroll & inspect the partial design as it streams in."}
              </div>
            </div>
          )}

          {/* ── ERROR STATE ── */}
          {stage === "error" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                padding: "24px 16px",
                animation: "fade-up 0.4s ease",
                pointerEvents: "auto",
              }}
            >
              <XCircle size={32} color="#f87171" />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.85)", marginBottom: 4 }}>
                  Generation failed
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", maxWidth: 280, lineHeight: 1.5 }}>
                  {shape.errorMessage ?? "An unexpected error occurred. Please try again."}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: 9999,
                  background: "rgba(248,113,113,0.12)",
                  border: "1px solid rgba(248,113,113,0.25)",
                  fontSize: 12,
                  color: "#f87171",
                  cursor: "default",
                }}
              >
                <RefreshCw size={12} />
                Click "Generate Design" on the frame to retry
              </div>
            </div>
          )}

          {/* ── SUCCESS STATE — actual rendered HTML ── */}
          {stage === "done" && !isDoneButEmpty && hasContent && (
            <div
              className="h-auto w-full"
              style={{
                pointerEvents: "auto",
                maxWidth: "100%",
                boxSizing: "border-box",
                animation: "fade-up 0.5s ease",
              }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(shape.uiSpecData!) }}
            />
          )}

          {/* ── EMPTY RESPONSE STATE ── */}
          {isDoneButEmpty && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                padding: "24px 16px",
                animation: "fade-up 0.4s ease",
                pointerEvents: "auto",
              }}
            >
              <XCircle size={32} color="#f59e0b" />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.85)", marginBottom: 4 }}>
                  Design generated but output was empty
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", maxWidth: 300, lineHeight: 1.6 }}>
                  The AI returned no HTML content. This usually means the sketch was too faint or the AI model timed out. Try adding clearer labels to your wireframe and click Generate Design again.
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: 9999,
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  fontSize: 12,
                  color: "#f59e0b",
                  cursor: "default",
                }}
              >
                <RefreshCw size={12} />
                Click "Generate Design" on the frame to retry
              </div>
            </div>
          )}

          {/* ── Partial HTML preview while streaming (shown below skeleton) ── */}
          {stage === "streaming" && shape.uiSpecData && shape.uiSpecData.length > 200 && (
            <div
              style={{
                marginTop: 16,
                borderTop: "1px solid rgba(255,255,255,0.06)",
                paddingTop: 12,
                opacity: 0.7,
                pointerEvents: "none",
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                marginBottom: 4,
              }}
            >
              Live preview ↓
            </div>
          )}
          {stage === "streaming" && shape.uiSpecData && shape.uiSpecData.length > 200 && (
            <div
              className="h-auto w-full"
              style={{ pointerEvents: "none", maxWidth: "100%", opacity: 0.6, animation: "fade-up 0.3s ease" }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(shape.uiSpecData) }}
            />
          )}
        </div>

        {/* ── Label ── */}
        <div
          className="absolute -top-6 left-0 text-xs px-2 py-1 rounded whitespace-nowrap text-white/60 bg-black/40"
          style={{ fontSize: "10px" }}
        >
          {stage === "done" ? "Generated UI ✓" : stage === "error" ? "Generated UI ✗" : "Generated UI"}
        </div>
      </div>
    </>
  );
};
