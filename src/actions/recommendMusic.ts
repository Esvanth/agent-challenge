import { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import * as fs from "fs";
import * as path from "path";

interface MusicMemoryEntry {
  timestamp: string;
  mentalState: string;
  query: string;
  track?: string;
  outcome: "win" | "fail" | "pending";
  stressBefore: number;
  stressAfter?: number;
}

const MEMORY_FILE = path.join(process.cwd(), "data", "music_memory.json");

function loadMemory(): MusicMemoryEntry[] {
  try {
    if (!fs.existsSync(path.dirname(MEMORY_FILE))) {
      fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });
    }
    if (!fs.existsSync(MEMORY_FILE)) return [];
    return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveMemory(entries: MusicMemoryEntry[]): void {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(entries, null, 2));
}

function getWinningQueries(mentalState: string): string[] {
  const memory = loadMemory();
  return memory
    .filter((e) => e.mentalState === mentalState && e.outcome === "win")
    .map((e) => e.query)
    .slice(-5);
}

function buildMusicQuery(mentalState: string, stressScore: number, thetaBetaRatio: number): {
  query: string;
  rationale: string;
} {
  const wins = getWinningQueries(mentalState);

  if (wins.length > 0) {
    return {
      query: wins[wins.length - 1],
      rationale: `Using previously successful query for ${mentalState} state (from memory log)`,
    };
  }

  if (mentalState === "STRESSED" || stressScore >= 3) {
    const queries = [
      "ambient piano 60 bpm calm stress relief",
      "nature sounds rain binaural alpha waves",
      "lofi chill study calm 70 bpm",
      "classical guitar relaxing slow tempo",
      "tibetan singing bowls meditation calm",
    ];
    const query = queries[Math.floor(stressScore) % queries.length];
    return {
      query,
      rationale: `60-80 BPM slow tempo for physiological entrainment — lowers cortisol, activates parasympathetic nervous system (Song et al., 2024)`,
    };
  }

  if (thetaBetaRatio > 2.5) {
    const queries = [
      "instrumental focus binaural beats 40hz gamma study",
      "deep focus music 120 bpm no lyrics concentration",
      "electronic ambient study music instrumental",
      "post rock instrumental focus flow state",
      "jazz instrumental cafe study 100 bpm",
    ];
    const idx = Math.floor(thetaBetaRatio) % queries.length;
    return {
      query: queries[idx],
      rationale: `120-140 BPM instrumental — prevents Theta-driven mind-wandering without inducing anxiety. No lyrics to avoid working memory interference`,
    };
  }

  return {
    query: "ambient chill relaxing background",
    rationale: "Neutral state — light ambient music to maintain current balance",
  };
}

export const recommendMusicAction: Action = {
  name: "RECOMMEND_MUSIC",
  similes: [
    "SUGGEST_MUSIC",
    "PLAY_MUSIC",
    "GET_MUSIC",
    "MUSIC_FOR_STRESS",
    "MUSIC_FOR_FOCUS",
    "FIND_TRACK",
  ],
  description:
    "Recommends a Spotify music query based on the detected mental state. Learns from past wins and failures to personalise recommendations over time.",

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || "";
    return (
      text.includes("music") ||
      text.includes("song") ||
      text.includes("play") ||
      text.includes("recommend") ||
      text.includes("spotify") ||
      text.includes("help me") ||
      text.includes("calm") ||
      text.includes("focus")
    );
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown> | undefined,
    callback: HandlerCallback | undefined
  ): Promise<boolean> => {
    const text = message.content.text || "";

    const stressMatch = text.match(/stress\s*(?:score)?\s*[:\s]?\s*(\d+(?:\.\d+)?)/i);
    const thetaMatch = text.match(/theta\s*[:\s]?\s*(\d+(?:\.\d+)?)/i);
    const betaMatch = text.match(/beta\s*[:\s]?\s*(\d+(?:\.\d+)?)/i);

    const stressScore = stressMatch ? parseFloat(stressMatch[1]) : 0;
    const theta = thetaMatch ? parseFloat(thetaMatch[1]) : 0.5;
    const beta = betaMatch ? parseFloat(betaMatch[1]) : 0.5;
    const thetaBetaRatio = theta / (beta || 0.01);

    let mentalState = "NEUTRAL";
    if (stressScore >= 3) mentalState = "STRESSED";
    else if (thetaBetaRatio > 2.5) mentalState = "UNFOCUSED";
    else if (text.toLowerCase().includes("stress")) mentalState = "STRESSED";
    else if (text.toLowerCase().includes("focus") || text.toLowerCase().includes("concentrat"))
      mentalState = "UNFOCUSED";

    const { query, rationale } = buildMusicQuery(mentalState, stressScore, thetaBetaRatio);

    // Log to memory as pending
    const memory = loadMemory();
    const entry: MusicMemoryEntry = {
      timestamp: new Date().toISOString(),
      mentalState,
      query,
      outcome: "pending",
      stressBefore: stressScore,
    };
    memory.push(entry);
    saveMemory(memory);

    const response = `**Music Recommendation for ${mentalState} state**

**Spotify Query:** \`${query}\`

**Why this works:**
${rationale}

**Expected outcome:** Mental state shift in 3-6 minutes
**Memory:** This recommendation has been logged. Reply with "win" or "fail" after listening so I can learn your preferences.

> Search this query directly in Spotify, or I can generate an API call if Spotify is connected.`;

    await callback?.({ text: response });
    return true;
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "I'm stressed, stress score 4. Recommend music." },
      },
      {
        user: "MindTune",
        content: {
          text: "**Music Recommendation for STRESSED state**\n\n**Spotify Query:** `ambient piano 60 bpm calm stress relief`",
          action: "RECOMMEND_MUSIC",
        },
      },
    ],
  ],
};

export const logFeedbackAction: Action = {
  name: "LOG_FEEDBACK",
  similes: ["WIN", "FAIL", "LOG_WIN", "LOG_FAIL", "FEEDBACK", "IT_WORKED", "DIDNT_WORK"],
  description: "Logs whether the last music recommendation worked (win) or didn't (fail). Used to personalise future recommendations.",

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || "";
    return (
      text === "win" ||
      text === "fail" ||
      text.includes("it worked") ||
      text.includes("didnt work") ||
      text.includes("didn't work") ||
      text.includes("helped") ||
      text.includes("not helping")
    );
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown> | undefined,
    callback: HandlerCallback | undefined
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || "";
    const isWin =
      text.includes("win") ||
      text.includes("worked") ||
      text.includes("helped") ||
      text === "win";

    const memory = loadMemory();
    const lastPending = memory.filter((e: MusicMemoryEntry) => e.outcome === "pending").pop();

    if (!lastPending) {
      await callback?.({ text: "No pending recommendation to log feedback for. Ask for a music recommendation first." });
      return true;
    }

    lastPending.outcome = isWin ? "win" : "fail";
    saveMemory(memory);

    const wins = memory.filter((e) => e.outcome === "win").length;
    const fails = memory.filter((e) => e.outcome === "fail").length;

    await callback?.({
      text: `**Feedback logged: ${isWin ? "WIN ✓" : "FAIL ✗"}**

Query: \`${lastPending.query}\`
Mental state: ${lastPending.mentalState}

**Session stats:** ${wins} wins / ${fails} fails
${isWin ? "I'll prioritise this query for similar states in the future." : "I'll try a different approach next time."}`,
    });
    return true;
  },

  examples: [
    [
      { user: "{{user1}}", content: { text: "win" } },
      {
        user: "MindTune",
        content: {
          text: "**Feedback logged: WIN ✓** — I'll prioritise this query for similar states in the future.",
          action: "LOG_FEEDBACK",
        },
      },
    ],
  ],
};
