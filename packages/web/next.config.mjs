import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Carrega o .env da raiz do monorepo como fonte única de verdade para o dev.
// Só define a var se ela ainda não existir (env do container tem precedência).
const envPath = resolve(process.cwd(), "../../.env");
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pacotes do workspace são TypeScript "fonte" — o Next precisa transpilá-los.
  transpilePackages: ["@ponto/shared", "@ponto/database"],
  // Produz output standalone p/ Docker (copia só o necessário).
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
