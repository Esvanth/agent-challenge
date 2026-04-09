# MindTune — EEG-Adaptive AI Music Agent

> Built for the **Nosana x ElizaOS Challenge** · Powered by Qwen3.5-27B on Nosana decentralized GPU

MindTune is a personal AI agent that reads your brainwave (EEG) data in real time, classifies your mental state, and recommends precision music to shift your brain toward calm or focus — all running on decentralized compute.

---

## What It Does

| EEG Signal | Mental State Detected | Music Strategy |
|---|---|---|
| High Beta + Low Alpha | Stressed | 60-80 BPM ambient/piano — parasympathetic entrainment |
| High Theta/Beta ratio (>2.5) | Unfocused / mind-wandering | 120-140 BPM instrumental — rhythmic scaffolding |
| Balanced Alpha/Beta | Relaxed | Maintain state — light ambient |

The agent **learns from feedback**: reply `win` (helped) or `fail` (didn't help) after listening, and MindTune prioritises winning queries for your profile in future sessions.

---

## Tech Stack

- **ElizaOS v2** — agent framework (character, actions, memory)
- **Nosana** — decentralized GPU inference on Solana
- **Qwen3.5-27B-AWQ-4bit** — LLM via Nosana hosted endpoint (60k context)
- **SQLite** — persistent agent memory
- **Express** — serves the web UI + REST API

---

## Quick Start

### 1. Clone and install
```bash
git clone https://github.com/your-username/mindtune-eliza
cd mindtune-eliza
npm install
```

### 2. Configure
```bash
cp .env.example .env
```
Edit `.env`:
```
NOSANA_API_KEY=your_nosana_api_key
NOSANA_INFERENCE_URL=https://inference.nosana.io/v1
PORT=3000
```
Get your Nosana API key at [deploy.nosana.com](https://deploy.nosana.com)

### 3. Run
```bash
npm run build
npm start
```

Open **http://localhost:3000** — the web UI loads automatically.

---

## Web UI

The dashboard lets you:
- Input EEG band values (delta, theta, alpha, beta, gamma) manually
- Select stress score (0–5)
- See live Theta/Beta and Alpha/Beta ratios
- Load preset scenarios (Stressed / Unfocused / Relaxed)
- Chat directly with the MindTune agent
- Log win/fail feedback with one click

---

## Agent Actions

| Action | Trigger | What it does |
|---|---|---|
| `ANALYZE_EEG` | Any message with EEG values | Classifies mental state, computes ratios |
| `RECOMMEND_MUSIC` | "music", "stressed", "focus", "calm" | Generates Spotify search query, logs to memory |
| `LOG_FEEDBACK` | "win" or "fail" | Updates memory log, learns preferences |

---

## REST API

```bash
# List agents
GET /agents

# Send message
POST /{agentId}/message
Content-Type: application/json
{ "text": "EEG stress score 4, alpha 0.3, beta 0.9, theta 0.6", "userId": "user" }
```

---

## Nosana Deployment

### Build and push Docker image
```bash
docker build -t your-dockerhub-username/mindtune-eliza:latest .
docker push your-dockerhub-username/mindtune-eliza:latest
```

### Deploy on Nosana
Update `nosana.yml` with your Docker Hub username, then deploy via the Nosana dashboard or CLI:
```bash
nosana job submit --file nosana.yml
```

---

## Project Structure

```
mindtune-eliza/
├── src/
│   ├── index.ts              ← agent entry, web UI server
│   ├── character.ts          ← MindTune personality + neuroscience knowledge
│   └── actions/
│       ├── analyzeEEG.ts     ← EEG classification (stress, focus, calm)
│       └── recommendMusic.ts ← music query generation + win/fail memory
├── public/
│   └── index.html            ← web UI dashboard
├── Dockerfile
├── nosana.yml                ← Nosana job definition
└── .env.example
```

---

## Science Behind It

- **Stress detection:** suppressed Alpha (8–12 Hz) + elevated Beta (13–30 Hz) — clinical BCI marker (Monastra et al., 2005)
- **Focus detection:** Theta/Beta ratio > 2.5 — frontal mind-wandering, ADHD biomarker
- **Music entrainment:** 60–80 BPM matches resting heart rate, shifts autonomic nervous system to parasympathetic state (Song et al., 2024)
- **Instrumental for focus:** lyrics compete for working memory resources — instrumental avoids this interference

---

## License

MIT
