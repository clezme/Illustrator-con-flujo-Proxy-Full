import { debounce } from "./lib/utils.js";

const csInterface = new CSInterface();
let hostReadyPromise = null;

const selectors = {
  mode: () => document.querySelector('input[name="mode"]:checked'),
  rootPath: () => document.getElementById("rootPath"),
  includeSubfolders: () => document.getElementById("includeSubfolders"),
  proxySuffix: () => document.getElementById("proxySuffix"),
  hiresSuffix: () => document.getElementById("hiresSuffix"),
  analyzeBtn: () => document.getElementById("analyze"),
  relinkBtn: () => document.getElementById("relink"),
  resultsBody: () => document.getElementById("resultsBody"),
  spinner: () => document.getElementById("spinner"),
  toast: () => document.getElementById("toast"),
  counters: {
    total: () => document.getElementById("count-total"),
    relinked: () => document.getElementById("count-relocated"),
    failed: () => document.getElementById("count-failed"),
    skipped: () => document.getElementById("count-skipped")
  },
  openLog: () => document.getElementById("openLog"),
  selectRoot: () => document.getElementById("selectRoot")
};

let cachedPlan = [];
let lastLogPaths = null;

function serializeArgs(args) {
  return args.map((arg) => JSON.stringify(arg)).join(",");
}

function evalHost(functionName, ...args) {
  return new Promise((resolve, reject) => {
    const script = `${functionName}(${serializeArgs(args)})`;
    csInterface.evalScript(script, (result) => {
      if (!result) {
        reject(new Error("Respuesta vacía del host"));
        return;
      }
      try {
        const parsed = JSON.parse(result);
        if (parsed.ok) {
          resolve(parsed);
        } else {
          reject(new Error(parsed.message || "Error desconocido en host"));
        }
      } catch (err) {
        reject(new Error(`No se pudo interpretar la respuesta: ${err.message}`));
      }
    });
  });
}

function loadHostScript() {
  if (!hostReadyPromise) {
    hostReadyPromise = new Promise((resolve, reject) => {
      const extensionRoot = csInterface.getSystemPath(SystemPath.EXTENSION).replace(/\\/g, "/");
      const hostPath = `${extensionRoot}/host.jsx`;
      const command = `$.evalFile(${JSON.stringify(hostPath)})`;
      csInterface.evalScript(command, (response) => {
        if (response && response.indexOf("EvalScript error") === 0) {
          reject(new Error("No se pudo cargar host.jsx"));
        } else {
          resolve();
        }
      });
    });
  }
  return hostReadyPromise;
}

function toggleSpinner(show) {
  selectors.spinner().hidden = !show;
}

function showToast(message, type = "success") {
  const toast = selectors.toast();
  toast.textContent = message;
  toast.className = "";
  toast.classList.add(type === "error" ? "toast-error" : "toast-success");
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}

function resetTable() {
  const tbody = selectors.resultsBody();
  tbody.innerHTML = `<tr class="placeholder"><td colspan="5">Ejecutá un análisis para ver resultados…</td></tr>`;
}

function renderPlan(plan) {
  const tbody = selectors.resultsBody();
  if (!plan.length) {
    resetTable();
    return;
  }
  const rows = plan.map((entry) => {
    const statusClass = entry.currentStatus ? `status-chip ${entry.currentStatus}` : "status-chip unknown";
    let actionVisual = entry.action || "sin acción";
    if (entry.result && entry.action === "relink") {
      actionVisual = entry.result === "ok" ? "relink ✔" : "relink ⚠";
    }
    const actionClass = entry.action
      ? `action-chip ${entry.action === "relink" ? "relink" : entry.action === "fail" ? "fail" : "keep"}`
      : "action-chip keep";
    return `<tr>
      <td>${entry.name}</td>
      <td><span class="${statusClass}">${entry.currentStatus || "desconocido"}</span></td>
      <td>${entry.target || "-"}</td>
      <td><span class="${actionClass}">${actionVisual}</span></td>
      <td>${entry.message || ""}</td>
    </tr>`;
  });
  tbody.innerHTML = rows.join("");
}

function updateCounters(summary) {
  selectors.counters.total().textContent = `Vínculos: ${summary.total || 0}`;
  selectors.counters.relinked().textContent = `Relinkeados: ${summary.relink || 0}`;
  selectors.counters.failed().textContent = `Fallidos: ${summary.failed || 0}`;
  selectors.counters.skipped().textContent = `Omitidos: ${summary.skipped || 0}`;
}

function getOptions() {
  return {
    rootPath: selectors.rootPath().dataset.value || "",
    includeSubfolders: selectors.includeSubfolders().checked,
    proxySuffix: selectors.proxySuffix().value.trim(),
    hiresSuffix: selectors.hiresSuffix().value.trim()
  };
}

function disableActions(disabled) {
  selectors.analyzeBtn().disabled = disabled;
  selectors.relinkBtn().disabled = disabled || !cachedPlan.length;
}

async function requestAnalyze() {
  try {
    await loadHostScript();
    disableActions(true);
    toggleSpinner(true);
    const mode = selectors.mode().value;
    const options = getOptions();
    const response = await evalHost("dryRunResolve", mode, JSON.stringify(options));
    cachedPlan = response.plan || [];
    renderPlan(cachedPlan);
    updateCounters(response.summary || {});
    if (response.rootPath && !options.rootPath) {
      selectors.rootPath().value = response.rootPath;
      selectors.rootPath().dataset.value = response.rootPath;
    }
    if (response.log && response.log.csvPath) {
      lastLogPaths = response.log;
    }
    if (!cachedPlan.length) {
      showToast("No se encontraron vínculos.");
    } else {
      showToast("DRY RUN completado.");
    }
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    toggleSpinner(false);
    disableActions(false);
  }
}

async function requestRelink() {
  if (!cachedPlan.length) {
    showToast("Ejecutá un análisis primero.", "error");
    return;
  }
  try {
    await loadHostScript();
    disableActions(true);
    toggleSpinner(true);
    const response = await evalHost("applyRelink", JSON.stringify(cachedPlan));
    cachedPlan = response.plan || [];
    renderPlan(cachedPlan);
    updateCounters(response.summary || {});
    if (response.log && response.log.csvPath) {
      lastLogPaths = response.log;
    }
    showToast("Relink aplicado.");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    toggleSpinner(false);
    disableActions(false);
  }
}

function requestFolderSelection() {
  window.cep.fs.selectFolder(false, "Seleccioná la carpeta raíz").then((result) => {
    if (result.err === 0 && result.data && result.data.length) {
      selectors.rootPath().value = result.data[0];
      selectors.rootPath().dataset.value = result.data[0];
    }
  });
}

function openLatestLog(event) {
  event.preventDefault();
  if (!lastLogPaths || !lastLogPaths.csvPath) {
    showToast("Aún no hay logs disponibles.", "error");
    return;
  }
  const encoded = encodeURI(`file://${lastLogPaths.csvPath}`);
  csInterface.openURLInDefaultBrowser(encoded);
}

function bootstrap() {
  loadHostScript().catch((err) => showToast(err.message, "error"));
  selectors.analyzeBtn().addEventListener("click", requestAnalyze);
  selectors.relinkBtn().addEventListener("click", requestRelink);
  selectors.openLog().addEventListener("click", openLatestLog);
  selectors.selectRoot().addEventListener("click", requestFolderSelection);
  const suffixInputs = [selectors.proxySuffix(), selectors.hiresSuffix()];
  suffixInputs.forEach((input) => {
    input.addEventListener(
      "input",
      debounce(() => {
        if (cachedPlan.length) {
          requestAnalyze();
        }
      }, 600)
    );
  });
  resetTable();
  disableActions(false);
}

document.addEventListener("DOMContentLoaded", bootstrap);
