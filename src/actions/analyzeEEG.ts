import { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";

interface EEGData {
  stressScore: number;   // 0-5
  delta: number;         // 0.5-4 Hz
  theta: number;         // 4-8 Hz
  alpha: number;         // 8-12 Hz
  beta: number;          // 13-30 Hz
  gamma: number;         // 30+ Hz
}

function classifyMentalState(data: EEGData): {
  state: string;
  reason: string;
  mode: "calm" | "focus" | "neutral";
} {
  const thetaBetaRatio = data.theta / (data.beta || 0.01);
  const alphaBetaRatio = data.alpha / (data.beta || 0.01);

  if (data.stressScore >= 3) {
    return {
      state: "STRESSED",
      reason: `Stress score ${data.stressScore}/5 — suppressed Alpha (${data.alpha.toFixed(2)}) with elevated Beta (${data.beta.toFixed(2)})`,
      mode: "calm",
    };
  }

  if (thetaBetaRatio > 2.5) {
    return {
      state: "UNFOCUSED",
      reason: `Theta/Beta ratio ${thetaBetaRatio.toFixed(2)} > 2.5 — frontal mind-wandering detected`,
      mode: "focus",
    };
  }

  if (alphaBetaRatio > 1.2) {
    return {
      state: "RELAXED",
      reason: `Alpha/Beta ratio ${alphaBetaRatio.toFixed(2)} — healthy parasympathetic activity`,
      mode: "neutral",
    };
  }

  return {
    state: "NEUTRAL",
    reason: `Balanced brainwave profile — no intervention required`,
    mode: "neutral",
  };
}

function parseEEGFromText(text: string): EEGData | null {
  const stressMatch = text.match(/stress\s*(?:score)?\s*[:\s]?\s*(\d+(?:\.\d+)?)/i);
  const deltaMatch = text.match(/delta\s*[:\s]?\s*(\d+(?:\.\d+)?)/i);
  const thetaMatch = text.match(/theta\s*[:\s]?\s*(\d+(?:\.\d+)?)/i);
  const alphaMatch = text.match(/alpha\s*[:\s]?\s*(\d+(?:\.\d+)?)/i);
  const betaMatch = text.match(/beta\s*[:\s]?\s*(\d+(?:\.\d+)?)/i);
  const gammaMatch = text.match(/gamma\s*[:\s]?\s*(\d+(?:\.\d+)?)/i);

  if (!stressMatch && !alphaMatch && !betaMatch && !thetaMatch) return null;

  return {
    stressScore: stressMatch ? parseFloat(stressMatch[1]) : 0,
    delta: deltaMatch ? parseFloat(deltaMatch[1]) : 0.5,
    theta: thetaMatch ? parseFloat(thetaMatch[1]) : 0.5,
    alpha: alphaMatch ? parseFloat(alphaMatch[1]) : 0.5,
    beta: betaMatch ? parseFloat(betaMatch[1]) : 0.5,
    gamma: gammaMatch ? parseFloat(gammaMatch[1]) : 0.5,
  };
}

export const analyzeEEGAction: Action = {
  name: "ANALYZE_EEG",
  similes: [
    "ANALYZE_BRAINWAVES",
    "CHECK_MENTAL_STATE",
    "READ_EEG",
    "ASSESS_BRAIN",
    "EVALUATE_EEG",
  ],
  description:
    "Analyzes EEG brainwave data to classify the user's mental state (stressed, unfocused, relaxed, neutral) and determine what intervention is needed.",

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || "";
    return (
      text.includes("eeg") ||
      text.includes("stress") ||
      text.includes("brainwave") ||
      text.includes("alpha") ||
      text.includes("beta") ||
      text.includes("theta") ||
      text.includes("focus") ||
      text.includes("mental state")
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
    const eegData = parseEEGFromText(text);

    if (!eegData) {
      await callback?.({
        text: "I need EEG data to analyze. Please provide values like: stress score, alpha, beta, theta, delta, gamma — or just tell me your stress score (0-5).",
      });
      return true;
    }

    const { state, reason, mode } = classifyMentalState(eegData);

    const thetaBetaRatio = (eegData.theta / (eegData.beta || 0.01)).toFixed(2);
    const alphaBetaRatio = (eegData.alpha / (eegData.beta || 0.01)).toFixed(2);

    const analysisReport = `**EEG Analysis Complete**

**Mental State:** ${state}
**Reason:** ${reason}

**Band Breakdown:**
- Delta: ${eegData.delta.toFixed(3)} | Theta: ${eegData.theta.toFixed(3)}
- Alpha: ${eegData.alpha.toFixed(3)} | Beta: ${eegData.beta.toFixed(3)} | Gamma: ${eegData.gamma.toFixed(3)}

**Key Ratios:**
- Theta/Beta: ${thetaBetaRatio} ${parseFloat(thetaBetaRatio) > 2.5 ? "⚠️ HIGH" : "✓ OK"}
- Alpha/Beta: ${alphaBetaRatio}

**Mode:** ${mode.toUpperCase()} intervention ${mode === "neutral" ? "not required" : "recommended"}`;

    await callback?.({ text: analysisReport });
    return true;
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "EEG: stress score 4, alpha 0.3, beta 0.8, theta 0.5" },
      },
      {
        user: "MindTune",
        content: {
          text: "**EEG Analysis Complete**\n\n**Mental State:** STRESSED\n**Reason:** Stress score 4/5 — suppressed Alpha (0.30) with elevated Beta (0.80)",
          action: "ANALYZE_EEG",
        },
      },
    ],
  ],
};
