'use client'

import React, { useRef } from 'react'
import { motion, useInView, useScroll, useTransform } from 'motion/react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Sparkles,
  PenTool,
  Layers,
  Wand2,
  ArrowRight,
  MousePointerClick,
  Code2,
  Zap,
  MessageSquare,
  Download,
  Palette,
  Infinity,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Animated grid background                                          */
/* ------------------------------------------------------------------ */
const GridBackground = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {/* Gradient overlay */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.15),transparent_50%)]" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.10),transparent_50%)]" />

    {/* Animated grid */}
    <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>

    {/* Floating orbs */}
    <motion.div
      className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-violet-500/10 blur-[128px]"
      animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
      transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute -right-32 top-2/3 h-80 w-80 rounded-full bg-cyan-500/10 blur-[128px]"
      animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
      transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-500/5 blur-[100px]"
      animate={{ scale: [1, 1.3, 1] }}
      transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
    />
  </div>
)

/* ------------------------------------------------------------------ */
/*  Reusable fade-in wrapper                                          */
/* ------------------------------------------------------------------ */
const FadeIn = ({
  children,
  delay = 0,
  className = '',
  direction = 'up',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  direction?: 'up' | 'down' | 'left' | 'right'
}) => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })

  const directionMap = {
    up: { y: 40, x: 0 },
    down: { y: -40, x: 0 },
    left: { x: 40, y: 0 },
    right: { x: -40, y: 0 },
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...directionMap[direction] }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Glowing feature card                                              */
/* ------------------------------------------------------------------ */
const FeatureCard = ({
  icon: Icon,
  title,
  description,
  gradient,
  delay,
}: {
  icon: React.ElementType
  title: string
  description: string
  gradient: string
  delay: number
}) => (
  <FadeIn delay={delay}>
    <div className="group relative h-full overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-sm transition-all duration-500 hover:border-white/[0.12] hover:bg-white/[0.04]">
      {/* Hover glow */}
      <div
        className={`absolute -inset-px rounded-2xl opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100 ${gradient}`}
        style={{ zIndex: -1 }}
      />

      <div
        className={`mb-4 inline-flex rounded-xl p-3 ${gradient} bg-opacity-10`}
      >
        <Icon className="h-6 w-6 text-white" strokeWidth={1.5} />
      </div>

      <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-white/50">{description}</p>
    </div>
  </FadeIn>
)

/* ------------------------------------------------------------------ */
/*  Workflow step                                                     */
/* ------------------------------------------------------------------ */
const WorkflowStep = ({
  step,
  title,
  description,
  icon: Icon,
  delay,
}: {
  step: string
  title: string
  description: string
  icon: React.ElementType
  delay: number
}) => (
  <FadeIn delay={delay} className="relative flex gap-6">
    {/* Connector line */}
    <div className="flex flex-col items-center">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10 text-sm font-bold text-violet-400">
        {step}
      </div>
      <div className="mt-2 w-px flex-1 bg-gradient-to-b from-violet-500/20 to-transparent" />
    </div>

    <div className="pb-12">
      <div className="mb-2 flex items-center gap-3">
        <Icon className="h-5 w-5 text-violet-400" strokeWidth={1.5} />
        <h3 className="text-xl font-semibold text-white">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-white/50">{description}</p>
    </div>
  </FadeIn>
)

/* ------------------------------------------------------------------ */
/*  Floating canvas preview (hero visual)                             */
/* ------------------------------------------------------------------ */
const CanvasPreview = () => {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const rotateX = useTransform(scrollYProgress, [0, 1], [8, -4])
  const y = useTransform(scrollYProgress, [0, 1], [0, -40])

  return (
    <motion.div
      ref={ref}
      style={{ rotateX, y, perspective: 1200 }}
      className="relative mx-auto mt-16 w-full max-w-5xl"
    >
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/40 shadow-2xl shadow-violet-500/5 backdrop-blur-md">
        {/* Mock title bar */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <div className="h-3 w-3 rounded-full bg-red-500/70" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
          <div className="h-3 w-3 rounded-full bg-green-500/70" />
          <span className="ml-4 text-xs text-white/30">S2C — Infinite Canvas</span>
        </div>

        {/* Canvas mock */}
        <div className="relative h-[340px] sm:h-[420px] lg:h-[480px] w-full bg-[#0a0a0f]">
          {/* Grid dots */}
          <svg className="absolute inset-0 h-full w-full opacity-20" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.8" fill="rgba(255,255,255,0.3)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>

          {/* Animated sketch shapes */}
          <motion.div
            className="absolute left-[8%] top-[12%] h-36 w-52 rounded-xl border-2 border-dashed border-violet-400/40 bg-violet-500/5"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <div className="p-3">
              <div className="mb-2 h-3 w-20 rounded bg-violet-400/20" />
              <div className="mb-1 h-2 w-full rounded bg-white/10" />
              <div className="mb-1 h-2 w-3/4 rounded bg-white/10" />
              <div className="h-2 w-1/2 rounded bg-white/10" />
            </div>
          </motion.div>

          <motion.div
            className="absolute right-[10%] top-[20%] h-40 w-56 rounded-xl border border-cyan-400/30 bg-cyan-500/5 p-3"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.1, duration: 0.6 }}
          >
            <div className="mb-3 flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-cyan-400/20" />
              <div className="h-2 w-16 rounded bg-cyan-400/20" />
            </div>
            <div className="mb-2 h-16 w-full rounded-lg bg-gradient-to-br from-cyan-500/10 to-violet-500/10" />
            <div className="flex gap-2">
              <div className="h-6 flex-1 rounded-md bg-cyan-400/20" />
              <div className="h-6 flex-1 rounded-md bg-white/5" />
            </div>
          </motion.div>

          <motion.div
            className="absolute bottom-[15%] left-[25%] h-28 w-72 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/5 p-3"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.4, duration: 0.6 }}
          >
            <div className="flex gap-3">
              <div className="h-20 w-20 rounded-lg bg-fuchsia-400/10" />
              <div className="flex-1 space-y-2">
                <div className="h-2 w-full rounded bg-white/10" />
                <div className="h-2 w-3/4 rounded bg-white/10" />
                <div className="h-2 w-1/2 rounded bg-white/10" />
                <div className="mt-3 h-6 w-24 rounded-md bg-fuchsia-400/20" />
              </div>
            </div>
          </motion.div>

          {/* Arrow connecting shapes */}
          <motion.svg
            className="absolute inset-0 h-full w-full"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.3 }}
            transition={{ delay: 1.8, duration: 1 }}
          >
            <path
              d="M 250 140 Q 380 100 420 200"
              fill="none"
              stroke="rgba(167,139,250,0.4)"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
          </motion.svg>

          {/* Sparkle / AI generation indicator */}
          <motion.div
            className="absolute right-[15%] bottom-[18%] flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-2 backdrop-blur-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.2, duration: 0.5 }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles className="h-4 w-4 text-violet-400" />
            </motion.div>
            <span className="text-xs font-medium text-violet-300">AI Generating...</span>
          </motion.div>

          {/* Toolbar mock */}
          <motion.div
            className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/[0.08] bg-black/60 px-3 py-2 backdrop-blur-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            {[MousePointerClick, PenTool, Layers, Code2, Wand2].map(
              (ToolIcon, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-2 transition-colors ${i === 4 ? 'bg-violet-500/20 text-violet-400' : 'text-white/40 hover:text-white/60'}`}
                >
                  <ToolIcon className="h-4 w-4" strokeWidth={1.5} />
                </div>
              )
            )}
          </motion.div>
        </div>
      </div>

      {/* Reflection glow */}
      <div className="absolute -bottom-20 left-1/2 h-40 w-3/4 -translate-x-1/2 rounded-full bg-violet-500/8 blur-[80px]" />
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  MAIN PAGE                                                         */
/* ------------------------------------------------------------------ */
const Page = () => {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#07070a] text-white">
      <GridBackground />

      {/* ========== NAV ========== */}
      <nav className="relative z-30 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500">
            <Code2 className="h-5 w-5 text-white" strokeWidth={2} />
          </div>
          <span className="text-xl font-bold tracking-tight">
            S2C
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/auth/sign-in">
            <Button
              variant="ghost"
              className="text-sm text-white/60 hover:text-white hover:bg-white/5"
            >
              Sign In
            </Button>
          </Link>
          <Link href="/auth/sign-up">
            <Button className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-6 text-sm font-medium text-white hover:from-violet-500 hover:to-cyan-500 border-0">
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* ========== HERO ========== */}
      <section className="relative z-20 mx-auto max-w-7xl px-6 pt-16 sm:pt-24 lg:pt-32">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <FadeIn>
            <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/5 px-4 py-1.5 text-sm text-violet-300 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI-Powered Design → Code</span>
            </div>
          </FadeIn>

          {/* Headline */}
          <FadeIn delay={0.1}>
            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
              Sketch Your Ideas.{' '}
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
                Let AI Write the Code.
              </span>
            </h1>
          </FadeIn>

          {/* Subheadline */}
          <FadeIn delay={0.2}>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/50 sm:text-xl">
              S2C is an infinite canvas where you sketch wireframes, draw shapes, and
              let AI transform them into production-ready UI code — in seconds.
            </p>
          </FadeIn>

          {/* CTA buttons */}
          <FadeIn delay={0.3}>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/auth/sign-up">
                <Button
                  size="lg"
                  className="group rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-8 py-6 text-base font-semibold text-white hover:from-violet-500 hover:to-cyan-500 shadow-lg shadow-violet-500/20 border-0"
                >
                  Start Designing Now
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="#features">
                <Button
                  size="lg"
                  variant="ghost"
                  className="rounded-full border border-white/10 px-8 py-6 text-base text-white/60 hover:bg-white/5 hover:text-white"
                >
                  See How It Works
                </Button>
              </Link>
            </div>
          </FadeIn>
        </div>

        {/* Hero visual */}
        <FadeIn delay={0.4}>
          <CanvasPreview />
        </FadeIn>
      </section>

      {/* ========== FEATURES ========== */}
      <section id="features" className="relative z-20 mx-auto max-w-7xl px-6 py-32">
        <FadeIn>
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-violet-400">
              Features
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Everything You Need to{' '}
              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                Design Faster
              </span>
            </h2>
            <p className="mt-4 text-white/40">
              A complete toolkit that bridges the gap between your vision and
              production code.
            </p>
          </div>
        </FadeIn>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={Infinity}
            title="Infinite Canvas"
            description="Pan, zoom, and sketch without limits. Your workspace grows with your ideas — never constrained by page boundaries."
            gradient="bg-gradient-to-br from-violet-500/20 to-violet-600/5"
            delay={0}
          />
          <FeatureCard
            icon={PenTool}
            title="Free-Draw & Shapes"
            description="Sketch with free-draw, drop rectangles, ellipses, frames, arrows, and lines — all with precise control."
            gradient="bg-gradient-to-br from-cyan-500/20 to-cyan-600/5"
            delay={0.1}
          />
          <FeatureCard
            icon={Wand2}
            title="AI Code Generation"
            description="Select your wireframe and let AI generate clean, responsive HTML/CSS code — powered by state-of-the-art models."
            gradient="bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-600/5"
            delay={0.2}
          />
          <FeatureCard
            icon={MessageSquare}
            title="Chat-Based Iteration"
            description="Refine your generated UI through natural conversation. Tell the AI what to change and watch it update in real-time."
            gradient="bg-gradient-to-br from-amber-500/20 to-amber-600/5"
            delay={0.1}
          />
          <FeatureCard
            icon={Download}
            title="Export Anywhere"
            description="Download your generated designs as production-ready code or high-resolution images, ready to ship."
            gradient="bg-gradient-to-br from-emerald-500/20 to-emerald-600/5"
            delay={0.2}
          />
          <FeatureCard
            icon={Palette}
            title="Smart Styling"
            description="Customize fonts, colors, borders, and more with an intuitive style sidebar. Full creative control at your fingertips."
            gradient="bg-gradient-to-br from-rose-500/20 to-rose-600/5"
            delay={0.3}
          />
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section className="relative z-20 mx-auto max-w-7xl px-6 py-24">
        <FadeIn>
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-cyan-400">
              Workflow
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
              From Sketch to Code in{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                3 Simple Steps
              </span>
            </h2>
          </div>
        </FadeIn>

        <div className="mx-auto max-w-2xl">
          <WorkflowStep
            step="01"
            icon={PenTool}
            title="Sketch Your Wireframe"
            description="Use the infinite canvas to draw shapes, frames, and layouts. Rough sketches work perfectly — the AI understands your intent."
            delay={0}
          />
          <WorkflowStep
            step="02"
            icon={Wand2}
            title="Generate with AI"
            description="Hit the generate button and watch AI analyze your sketches, understand the layout structure, and produce clean, responsive code."
            delay={0.15}
          />
          <WorkflowStep
            step="03"
            icon={Zap}
            title="Iterate & Export"
            description="Use the chat to refine your design, adjust styling, and when you're happy — export production-ready code or save your design."
            delay={0.3}
          />
        </div>
      </section>

      {/* ========== CTA ========== */}
      <section className="relative z-20 mx-auto max-w-7xl px-6 pb-32 pt-16">
        <FadeIn>
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-violet-500/10 via-transparent to-cyan-500/10 p-12 text-center backdrop-blur-sm sm:p-20">
            {/* Decorative orbs */}
            <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-violet-500/10 blur-[80px]" />
            <div className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-cyan-500/10 blur-[80px]" />

            <h2 className="relative text-3xl font-bold tracking-tight sm:text-5xl">
              Ready to Turn Your{' '}
              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                Sketches into Reality?
              </span>
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-white/50">
              Join designers and developers who are building UIs faster than ever.
              No design degree required — just draw and let AI do the rest.
            </p>
            <div className="relative mt-10">
              <Link href="/auth/sign-up">
                <Button
                  size="lg"
                  className="group rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-10 py-6 text-base font-semibold text-white hover:from-violet-500 hover:to-cyan-500 shadow-lg shadow-violet-500/25 border-0"
                >
                  Get Started — It&apos;s Free
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="relative z-20 border-t border-white/[0.06] py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-cyan-500">
              <Code2 className="h-4 w-4 text-white" strokeWidth={2} />
            </div>
            <span className="text-sm font-semibold">S2C</span>
          </div>
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} S2C — Sketch to Code. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Page
