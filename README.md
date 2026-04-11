# MindTune — EEG-Adaptive AI Music Agent

> **Nosana × ElizaOS Hackathon Submission**

MindTune is a personal AI agent that reads your EEG brainwave data, detects your mental state in real time, and recommends music scientifically tuned to shift you toward focus, calm, or flow — all running on decentralized GPU compute.

| | |
|---|---|
| **Live Demo** | https://2q6de9ejmvwevtyx5s8ssntshvunaa8b7z8ivwdfmzns.node.k8s.prd.nos.ci |
| **GitHub** | https://github.com/Esvanth/agent-challenge |
| **Docker** | `docker.io/esvanth7/mindtune-eliza:latest` |

---

## What It Does

You enter your EEG band values (or pick a preset scenario), and the agent:

1. Computes your **Theta/Beta** and **Alpha/Beta** ratios — the gold-standard clinical markers for focus and stress
2. Classifies your current mental state (Stressed / Unfocused / Relaxed)
3. Generates a precise **Spotify search query** with BPM, genre, and acoustic properties matched to your neurology
4. Uses **Qwen2.5-72B on Nosana** to produce a natural, empathetic response
5. Learns from your feedback — reply `win` or `fail` after listening, and MindTune remembers what works for you

| EEG Pattern | State Detected | Music Strategy |
|---|---|---|
| High Beta + Suppressed Alpha | Stressed | 60–80 BPM ambient/piano — parasympathetic entrainment |
| High Theta/Beta ratio (> 2.5) | Unfocused | 120–140 BPM instrumental — rhythmic scaffolding |
| Balanced Alpha/Beta | Relaxed | Light ambient — maintain state |

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| Agent Framework | **ElizaOS v2** | Character, actions, memory, plugin ecosystem |
| LLM | **Qwen2.5-72B-Instruct** | Natural language response generation |
| Inference | **Nosana Hosted Endpoint** | Decentralized GPU inference on Solana |
| Deployment | **Nosana** | Containerized compute, live URL |
| Memory | **SQLite** | Persistent win/fail feedback across sessions |
| Server | **Express + TypeScript** | REST API + web UI serving |
| Container | **Docker → Docker Hub** | `esvanth7/mindtune-eliza:latest` |

---

## Judging Criteria Coverage

| Criteria | Implementation |
|---|---|
| **Technical Implementation 💻** | ElizaOS v2 with custom actions (`ANALYZE_EEG`, `RECOMMEND_MUSIC`, `LOG_FEEDBACK`), TypeScript, error handling with LLM fallback |
| **Nosana Integration ⚡** | Deployed on Nosana GPU network, uses Nosana hosted inference (`inference.nosana.io/v1`) for Qwen2.5-72B, proper Docker containerization |
| **Usefulness & UX 🎯** | Real EEG analysis, live ratio computation, 3 quick scenarios, chat interface, win/fail feedback loop |
| **Creativity & Originality 🎨** | EEG-to-music pipeline using clinical BCI markers (Theta/Beta ratio, Alpha/Beta), personalised music therapy agent |
| **Documentation 📝** | Full README, setup instructions, REST API docs, science references, project structure |

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/Esvanth/agent-challenge
cd agent-challenge
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
NOSANA_API_KEY=your_nosana_api_key
NOSANA_INFERENCE_URL=https://inference.nosana.io/v1
PORT=3000
```

Get your Nosana API key at [deploy.nosana.com](https://deploy.nosana.com)

### 3. Run locally

```bash
npm run build
npm start
```

Open **http://localhost:3000** — the web UI loads automatically.

---

## Web UI

The dashboard lets you:

- Enter EEG band values (δ, θ, α, β, γ) manually
- Select stress score (0–5)
- See **live ratio computation** (Theta/Beta, Alpha/Beta)
- Load preset scenarios — Stressed, Unfocused, or Relaxed
- Chat directly with the MindTune agent (powered by Qwen on Nosana)
- Log win/fail feedback with one click

---

## Agent Actions

| Action | Trigger | What it does |
|---|---|---|
| `ANALYZE_EEG` | Message with EEG values | Classifies mental state, computes ratios |
| `RECOMMEND_MUSIC` | "music", "stressed", "focus", "calm" | Generates Spotify search query, logs to memory |
| `LOG_FEEDBACK` | "win" or "fail" | Updates memory, learns your preferences |

---

## How It Works

```
User Input (EEG values)
        ↓
  Action Handler (deterministic)
  - Parse EEG bands
  - Compute Theta/Beta, Alpha/Beta ratios
  - Classify mental state
  - Select music query from science-backed library
        ↓
  Qwen2.5-72B on Nosana Inference
  - Takes structured analysis as context
  - Generates natural, empathetic response
        ↓
  UI Chat + Spotify Query
```

---

## REST API

```bash
# Get agent info
GET /agent
→ { "id": "<agentId>", "name": "MindTune" }

# Chat with MindTune
POST /chat
Content-Type: application/json
{ "text": "EEG stress score 4, alpha 0.3, beta 0.9, theta 0.6" }
```

---

## Deploy on Nosana

### 1. Build and push Docker image

```bash
docker build -t esvanth7/mindtune-eliza:latest .
docker push esvanth7/mindtune-eliza:latest
```

### 2. Deploy via Nosana Dashboard

Go to [deploy.nosana.com](https://deploy.nosana.com) and use this job definition:

```json
{
  "ops": [{
    "id": "run-mindtune-agent",
    "type": "container/run",
    "args": {
      "image": "docker.io/esvanth7/mindtune-eliza:latest",
      "cmd": ["node", "dist/index.js"],
      "expose": 3000,
      "gpu": false,
      "env": {
        "NOSANA_API_KEY": "<your_nosana_api_key>",
        "NOSANA_INFERENCE_URL": "https://inference.nosana.io/v1",
        "PORT": "3000"
      }
    }
  }],
  "meta": { "trigger": "dashboard" },
  "type": "container",
  "version": "0.1"
}
```

---

## Project Structure

```
agent-challenge/
├── src/
│   ├── index.ts              — agent entry point, web UI server, /chat endpoint
│   ├── character.ts          — MindTune personality + neuroscience knowledge
│   └── actions/
│       ├── analyzeEEG.ts     — EEG classification (stress, focus, calm)
│       └── recommendMusic.ts — music query generation + win/fail memory
├── public/
│   └── index.html            — web UI dashboard
├── Dockerfile
├── nos_job_def/
│   └── nosana_eliza_job_definition.json
└── .env.example
```

---

## The Science

| Finding | Source |
|---|---|
| Suppressed Alpha + elevated Beta = stress | Monastra et al., 2005 (clinical BCI) |
| Theta/Beta ratio > 2.5 = mind-wandering / ADHD marker | Frontal EEG research |
| 60–80 BPM music shifts ANS to parasympathetic state | Song et al., 2024 |
| Instrumental music avoids working memory interference | Cognitive load theory |

---

## License

MIT
