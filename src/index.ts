import { AgentRuntime, elizaLogger, CacheManager, MemoryCacheAdapter, generateText, ModelClass } from "@elizaos/core";
import { SqliteDatabaseAdapter } from "@elizaos/adapter-sqlite";
import { DirectClient } from "@elizaos/client-direct";
import Database from "better-sqlite3";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

import { mindtuneCharacter } from "./character.js";
import { analyzeEEGAction } from "./actions/analyzeEEG.js";
import { recommendMusicAction, logFeedbackAction } from "./actions/recommendMusic.js";

dotenv.config();

// Use Nosana hosted inference (OpenAI-compatible endpoint)
process.env.OPENAI_API_URL = process.env.NOSANA_INFERENCE_URL || "https://inference.nosana.io/v1";
process.env.OPENAI_API_KEY = process.env.NOSANA_API_KEY || "";
process.env.SMALL_OPENAI_MODEL = "Qwen/Qwen2.5-72B-Instruct";
process.env.LARGE_OPENAI_MODEL = "Qwen/Qwen2.5-72B-Instruct";

async function main() {
  elizaLogger.info("Starting MindTune ElizaOS Agent...");

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const db = new Database(path.join(dataDir, "mindtune.db"));
  const databaseAdapter = new SqliteDatabaseAdapter(db);
  await databaseAdapter.init();

  const cacheManager = new CacheManager(new MemoryCacheAdapter());

  const runtime = new AgentRuntime({
    databaseAdapter,
    token: process.env.GROQ_API_KEY || "",
    modelProvider: mindtuneCharacter.modelProvider,
    character: mindtuneCharacter,
    actions: [analyzeEEGAction, recommendMusicAction, logFeedbackAction],
    evaluators: [],
    providers: [],
    cacheManager,
  });

  await runtime.initialize();

  elizaLogger.info(`MindTune agent initialized: ${runtime.agentId}`);

  const directClient = new DirectClient();

  directClient.registerAgent(runtime);

  // ElizaOS registers GET / inside its own apiRouter (mounted in the
  // DirectClient constructor). The only reliable way to override it is to
  // walk the router stack, find the route layer for "/", and replace its
  // handler function directly.
  const publicDir = path.join(process.cwd(), "public");
  if (fs.existsSync(publicDir)) {
    const htmlPath = path.join(publicDir, "index.html");
    const serveUI = (_req: any, res: any) => {
      res.setHeader("Content-Type", "text/html");
      res.end(fs.readFileSync(htmlPath, "utf8"));
    };

    let replaced = false;
    const appStack = (directClient.app as any)._router?.stack ?? [];
    for (const layer of appStack) {
      // apiRouter is mounted as a middleware layer whose .handle has its own .stack
      const subStack = layer?.handle?.stack;
      if (!Array.isArray(subStack)) continue;
      for (const sub of subStack) {
        if (sub?.route?.path === "/" && sub.route.methods?.get) {
          // Replace every GET handler on this route
          for (const routeLayer of sub.route.stack) {
            if (routeLayer.method === "get") {
              routeLayer.handle = serveUI;
              replaced = true;
            }
          }
        }
      }
    }
    if (!replaced) {
      elizaLogger.warn("Could not find ElizaOS GET / route to replace — falling back to app.get");
      directClient.app.get("/", serveUI);
    }
  }

  // CORS for API routes
  directClient.app.use((_req: any, res: any, next: any) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (_req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }
    next();
  });

  // Custom /agent endpoint — avoids the crash in the built-in /agents route
  directClient.app.get("/agent", (_req: any, res: any) => {
    res.json({ id: runtime.agentId, name: runtime.character.name });
  });

  // Direct /chat endpoint — our action logic extracts structured data,
  // then Qwen (via Nosana inference) generates the final natural response.
  directClient.app.post("/chat", async (req: any, res: any) => {
    const text: string = req.body?.text || "";

    const fakeMessage = { content: { text } } as any;
    const captured: string[] = [];
    const callback = async (response: { text: string }): Promise<any> => { captured.push(response.text); };

    let structuredContext = "";

    try {
      if (await analyzeEEGAction.validate(runtime, fakeMessage, undefined as any)) {
        await analyzeEEGAction.handler(runtime, fakeMessage, undefined as any, {}, callback);
        if (await recommendMusicAction.validate(runtime, fakeMessage, undefined as any)) {
          await recommendMusicAction.handler(runtime, fakeMessage, undefined as any, {}, callback);
        }
        structuredContext = captured.join("\n\n");
      } else if (await logFeedbackAction.validate(runtime, fakeMessage, undefined as any)) {
        await logFeedbackAction.handler(runtime, fakeMessage, undefined as any, {}, callback);
        structuredContext = captured.join("\n\n");
      } else if (await recommendMusicAction.validate(runtime, fakeMessage, undefined as any)) {
        await recommendMusicAction.handler(runtime, fakeMessage, undefined as any, {}, callback);
        structuredContext = captured.join("\n\n");
      }
    } catch (err: any) {
      elizaLogger.error("Action handler error:", err);
    }

    // Use Qwen on Nosana to generate a natural, conversational response
    const prompt = structuredContext
      ? `You are MindTune, an EEG-adaptive music therapy AI. A user sent: "${text}"\n\nYour analysis system produced this data:\n${structuredContext}\n\nBased on this, write a concise, empathetic response to the user. Keep it under 150 words. Do not repeat the raw data verbatim — synthesize it naturally.`
      : `You are MindTune, an EEG-adaptive music therapy AI. Respond helpfully to: "${text}"\n\nYou help users by analyzing EEG brainwave data (delta, theta, alpha, beta, gamma bands) and recommending music to improve their mental state. Keep your response under 100 words.`;

    try {
      const llmResponse = await generateText({
        runtime,
        context: prompt,
        modelClass: ModelClass.LARGE,
      });
      res.json([{ text: llmResponse }]);
    } catch (err: any) {
      elizaLogger.error("Qwen generateText error:", err);
      // Fall back to structured response if LLM fails
      const fallback = structuredContext || "Hi! I'm MindTune. Enter your EEG values and click Analyze to get a music recommendation.";
      res.json([{ text: fallback }]);
    }
  });

  const port = parseInt(process.env.PORT || "3000");
  directClient.start(port);
  elizaLogger.info(`Web UI: http://localhost:${port}`);

  elizaLogger.info(`Agent API: http://localhost:${port}/${runtime.agentId}/message`);

  process.on("SIGINT", () => {
    elizaLogger.info("Shutting down...");
    process.exit(0);
  });
}

main().catch((error) => {
  elizaLogger.error("Fatal error:", error);
  process.exit(1);
});
