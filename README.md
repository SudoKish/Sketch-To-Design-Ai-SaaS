# S2C — Sketch to Code 🎨⚡️

S2C is a cutting-edge, AI-powered infinite canvas that bridges the gap between rough ideas and production-ready code. Simply sketch your wireframes, draw shapes, or drop text on an infinite workspace, and let advanced AI models transform your vision into clean, responsive HTML and CSS in seconds.



## ✨ Key Features

- **🚀 Infinite Canvas**: A limitless workspace where you can pan, zoom, and build complex layouts without boundaries.
- **✏️ Sketch & Draw**: Full support for freehand drawing, rectangles, ellipses, frames, arrows, and lines.
- **🤖 Multi-Model AI Generation**: Leverages state-of-the-art models (Anthropic, Gemini, OpenAI, Groq) to interpret sketches and generate high-quality code.
- **💬 Chat-Based Iteration**: Don't like a specific part? Chat with the AI to refine your generated UI, adjust styles, or add new components in real-time.
- **🎨 Smart Styling**: A dedicated sidebar to customize fonts, colors, borders, and effects with instant feedback.
- **📦 Export Options**: Download your creations as production-ready code or high-resolution PNG images.
- **⚡️ Real-time Workflows**: Powered by Inngest for robust, event-driven background processing.

---

## 🛠 Tech Stack

S2C is built with a modern, high-performance stack:

- **Frontend**: [Next.js 15](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/)
- **Backend**: [Convex](https://www.convex.dev/) (Type-safe backend-as-a-service)
- **AI**: [Vercel AI SDK](https://sdk.vercel.ai/), Anthropic Claude, Google Gemini, OpenAI GPT-4o, Groq
- **Workflows**: [Inngest](https://www.inngest.com/)
- **State Management**: [Redux Toolkit](https://redux-toolkit.js.org/) with undo/redo support
- **UI Components**: Radix UI, Lucide React, Framer Motion
- **Monetization**: [Polar.sh](https://polar.sh/)

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 20 or higher
- A Convex account
- API keys for AI providers (Anthropic, OpenAI, etc.)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/your-username/s2c-main.git
cd s2c-main
npm install
```

### 3. Environment Setup
Create a `.env.local` file in the root directory and add your keys (refer to `.env.example`):
```bash
# Convex Deployment
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

# AI Provider Keys
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Payments & Workflows
POLAR_ACCESS_TOKEN=
INNGEST_SIGNING_KEY=
INNGEST_EVENT_KEY=
```

### 4. Run Locally
Start the development server and the Convex backend:
```bash
# In one terminal, start Next.js
npm run dev

# In another terminal, start Convex
npx convex dev

# (Optional) Start Inngest dev server
npm run dev:inngest
```

---


Built with ❤️ by the ZGOD Team.
