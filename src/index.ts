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

process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || "";
// Override decommissioned llama-3.2-90b-vision-preview
process.env.GROQ_LARGE_MODEL = "llama-3.3-70b-versatile";
process.env.LARGE_GROQ_MODEL = "llama-3.3-70b-versatile";
process.env.GROQ_MODEL = "llama-3.3-70b-versatile";

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

  // CORS must be added BEFORE registerAgent so it runs before all routes
  directClient.app.use((_req: any, res: any, next: any) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (_req.method === "OPTIONS") { res.sendStatus(200); return; }
    next();
  });

  directClient.registerAgent(runtime);

  // Custom /agent endpoint — avoids the crash in the built-in /agents route
  directClient.app.get("/agent", (_req: any, res: any) => {
    res.json({ id: runtime.agentId, name: runtime.character.name });
  });

  // Serve web UI on the same port
  const publicDir = path.join(process.cwd(), "public");
  if (fs.existsSync(publicDir)) {
    directClient.app.get("/", (_req: any, res: any) => {
      res.sendFile(path.join(publicDir, "index.html"));
    });
  }

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
