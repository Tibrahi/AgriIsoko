import { loadEnvFile } from "node:process";

export function loadProjectEnv() {
  for (const filename of [".env.local", ".env"]) {
    try {
      loadEnvFile(filename);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    }
  }
}
