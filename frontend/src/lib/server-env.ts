// Server-only settings. In dev, Vite doesn't put .env into process.env, so read the repo's
// .env files once (frontend/.env, then the root .env). Values already set in the shell win.
let loaded = false;

export function serverEnv(name: string): string | undefined {
  if (!loaded) {
    loaded = true;
    for (const path of [".env", "../.env"]) {
      try { process.loadEnvFile(path); } catch { /* not there */ }
    }
  }
  return process.env[name];
}
