#!/usr/bin/env node
import { cpSync, rmSync, mkdirSync, existsSync, watch } from "fs";
import { resolve, join, dirname } from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..", "..");
const extensionDir = resolve(projectRoot, "com.marca.proxyfull");

function getDefaultTarget() {
  const platform = os.platform();
  if (platform === "darwin") {
    return resolve(os.homedir(), "Library", "Application Support", "Adobe", "CEP", "extensions");
  }
  if (platform === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      return resolve(appData, "Adobe", "CEP", "extensions");
    }
  }
  return null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { watch: false, target: null };
  args.forEach((arg, index) => {
    if (arg === "--watch") {
      options.watch = true;
    } else if (arg === "--target" && args[index + 1]) {
      options.target = resolve(args[index + 1]);
    }
  });
  if (!options.target) {
    options.target = process.env.CEP_EXTENSION_PATH || getDefaultTarget();
  }
  return options;
}

function ensureTarget(base) {
  if (!base) {
    throw new Error("Definí una ruta de instalación con --target o variable CEP_EXTENSION_PATH.");
  }
  if (!existsSync(base)) {
    mkdirSync(base, { recursive: true });
  }
  return base;
}

function copyExtension(destBase) {
  const destination = resolve(destBase, "com.marca.proxyfull");
  if (existsSync(destination)) {
    rmSync(destination, { recursive: true, force: true });
  }
  cpSync(extensionDir, destination, { recursive: true });
  console.log(`Extensión copiada a ${destination}`);
}

function main() {
  const options = parseArgs();
  let destBase;
  try {
    destBase = ensureTarget(options.target);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  copyExtension(destBase);

  if (options.watch) {
    console.log("Watching for changes…");
    let queued = false;
    watch(extensionDir, { recursive: true }, () => {
      if (queued) {
        return;
      }
      queued = true;
      setTimeout(() => {
        queued = false;
        try {
          copyExtension(destBase);
        } catch (err) {
          console.error("Error al copiar:", err.message);
        }
      }, 200);
    });
  }
}

main();
