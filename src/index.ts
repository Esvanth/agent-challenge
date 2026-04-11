import { AgentRuntime, elizaLogger, CacheManager, MemoryCacheAdapter } from "@elizaos/core";
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

  // Direct /chat endpoint — routes to action handlers by keyword matching,
  // no LLM needed for routing so it always responds reliably.
  directClient.app.post("/chat", async (req: any, res: any) => {
    const text: string = req.body?.text || "";
    const lower = text.toLowerCase();

    let responseText = "";

    const fakeMessage = { content: { text } } as any;
    const captured: string[] = [];
    const callback = async (response: { text: string }): Promise<any> => { captured.push(response.text); };

    try {
      if (await analyzeEEGAction.validate(runtime, fakeMessage, undefined as any)) {
        await analyzeEEGAction.handler(runtime, fakeMessage, undefined as any, {}, callback);
        // Also check for music recommendation in same message
        if (await recommendMusicAction.validate(runtime, fakeMessage, undefined as any)) {
          await recommendMusicAction.handler(runtime, fakeMessage, undefined as any, {}, callback);
        }
      } else if (await logFeedbackAction.validate(runtime, fakeMessage, undefined as any)) {
        await logFeedbackAction.handler(runtime, fakeMessage, undefined as any, {}, callback);
      } else if (await recommendMusicAction.validate(runtime, fakeMessage, undefined as any)) {
        await recommendMusicAction.handler(runtime, fakeMessage, undefined as any, {}, callback);
      } else {
        // Generic fallback response
        responseText = `Hi! I'm MindTune, your EEG-adaptive music agent.\n\nTry:\n- **Analyze EEG**: Enter your EEG values and stress score\n- **Get music**: Say "I'm stressed" or "help me focus"\n- **Feedback**: Reply "win" or "fail" after listening`;
      }
    } catch (err: any) {
      elizaLogger.error("Chat handler error:", err);
      responseText = "Sorry, I encountered an error. Please try again.";
    }

    if (captured.length > 0) responseText = captured.join("\n\n");
    res.json([{ text: responseText }]);
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
