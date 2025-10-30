#!/usr/bin/env node
import { cpSync, rmSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..", "..");
const extensionDir = resolve(projectRoot, "com.marca.proxyfull");
const distDir = resolve(projectRoot, "dist");

if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}
mkdirSync(distDir, { recursive: true });

const distExtensionDir = resolve(distDir, "com.marca.proxyfull");
cpSync(extensionDir, distExtensionDir, { recursive: true });
console.log(`Extensión exportada a ${distExtensionDir}`);

if (process.argv.includes("--zip")) {
  const zipPath = resolve(distDir, "com.marca.proxyfull.zip");
  try {
    execSync(`cd ${distDir} && zip -r ${zipPath} com.marca.proxyfull`, { stdio: "inherit" });
    console.log(`Paquete ZIP generado en ${zipPath}`);
  } catch (err) {
    console.error("No se pudo crear el ZIP. Verificá que el comando zip esté disponible.");
  }
}
