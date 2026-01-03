<div align="center">
<img width="1200" height="475" alt="Stilq Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Stilq

**Intelligent AI Assistant with Multi-Model Orchestration**

[![Live Demo](https://img.shields.io/badge/demo-getstilq.web.app-blue)](https://getstilq.web.app)
[![Firebase](https://img.shields.io/badge/Firebase-Functions%20%7C%20Hosting-orange)](https://firebase.google.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

</div>

---

## What is Stilq?

Stilq is not just another ChatGPT wrapper. It's an **intelligent orchestration layer** that automatically routes requests to the optimal AI model based on user intent, manages multi-modal interactions, and provides a seamless experience across text, code, images, and real-time data.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Request                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      INTENT ROUTER                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Analyzes: message content, conversation history,       │   │
│  │  attached files, and semantic intent                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
           ┌────────────────────┼────────────────────┐
           ▼                    ▼                    ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
    │   FLASH     │     │    PRO      │     │   PRO IMAGE     │
    │  Fast mode  │     │ Deep think  │     │  Generation     │
    │             │     │             │     │                 │
    │ • Search    │     │ • Research  │     │ • Create        │
    │ • Code exec │     │ • Planning  │     │ • Edit          │
    │ • Analysis  │     │ • Debug     │     │ • Blend         │
    └─────────────┘     └─────────────┘     └─────────────────┘
           │                    │                    │
           └────────────────────┼────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STREAMING RESPONSE                           │
│  • Real-time text streaming                                     │
│  • Inline graphs (matplotlib)                                   │
│  • Generated images                                             │
│  • Grounded sources                                             │
│  • Auto-suggestions                                             │
└─────────────────────────────────────────────────────────────────┘
```

## How the Router Works

The router is the brain of Stilq. Instead of forcing users to manually select models, it analyzes each request and automatically chooses the best model:

| Intent | Routed To | Why |
|--------|-----------|-----|
| "What's the weather?" | Flash | Simple query, needs search |
| "Plot Bitcoin price history" | Flash | Code execution for graphs |
| "Analyze this image" | Flash | Vision analysis |
| "Build me a full authentication system" | Pro | Complex, multi-step task |
| "Debug this recursive function" | Pro | Deep reasoning needed |
| "Generate a logo for my startup" | Pro Image | Pixel generation |
| "Edit this photo, remove background" | Pro Image | Image manipulation |

### Router Decision Matrix

```
1. DEFAULT → Flash
   - Chat, Q&A, search, code execution, vision analysis

2. COMPLEXITY CHECK → Pro
   - Multi-step projects, system design, deep research, debugging

3. PIXEL INTENT → Pro Image
   - Generate, create, draw, edit, blend images
```

## Key Features

### Multi-Model Intelligence
- **Automatic routing** - No manual model selection needed
- **Context-aware** - Uses conversation history for better decisions
- **Fallback system** - Empty Flash response → automatic Pro retry

### Real-Time Capabilities
- **Google Search** - Grounded responses with citations
- **Code Execution** - Python sandbox for calculations and graphs
- **URL Analysis** - Extract and summarize web content

### Image Generation & Editing
- **Native generation** - Create images from text prompts
- **Context-aware editing** - Edit images using conversation history
- **Identity blending** - Combine elements from multiple uploaded images
- **Multi-turn refinement** - Iterative improvements with natural language

### Productivity
- **PDF Export** - Client-side generation preserving charts, code blocks, and images
- **Print-ready** - Optimized formatting for professional documents
- **Chat history** - Persistent conversations with Firestore

## Security & Privacy

Stilq is built with a **Privacy First** mindset:

- **Zero Trust Architecture** - Every request is validated via Firebase Admin SDK
- **Data Isolation** - User data is strictly isolated per account
- **Automatic Cleanup** - Deleted chats are permanently removed from all storage
- **No Training** - Data processed via Google Cloud API is NOT used to train public models
- **Secure Uploads** - Files are stored in isolated user buckets with strict access rules

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Backend | Firebase Functions (Node.js) |
| Database | Firestore |
| Auth | Firebase Authentication |
| Storage | Firebase Storage |
| AI | Google Gemini API |
| Hosting | Firebase Hosting |

## Getting Started

### Prerequisites

- Node.js 18+
- Firebase CLI
- Google Gemini API Key

### Installation

```bash
git clone https://github.com/Crscristi28/Stilq.git
cd Stilq

# Install dependencies
npm install
cd functions && npm install && cd ..

# Configure environment
cp .env.example .env.local
# Add your GEMINI_API_KEY
```

### Development

```bash
# Frontend
npm run dev

# Functions (separate terminal)
cd functions && npm run serve
```

### Deployment

```bash
# Full deploy
firebase deploy

# Functions only
firebase deploy --only functions

# Hosting only
npm run build && firebase deploy --only hosting
```

## Models

| Model | ID | Use Case |
|-------|-----|----------|
| Flash | `gemini-3-flash-preview` | Fast responses, search, code, vision |
| Pro | `gemini-3-pro-preview` | Complex tasks, deep reasoning |
| Pro Image | `gemini-3-pro-image-preview` | Image generation and editing |

## Roadmap

- [ ] Advanced error handling (429, 500, offline)
- [ ] Voice input/output
- [ ] Plugin system for custom tools
- [ ] Team collaboration features

## License

MIT

---

<div align="center">

**[getstilq.web.app](https://getstilq.web.app)**

</div>
