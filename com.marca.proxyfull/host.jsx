/*
 * Proxy → Full - host.jsx
 * Funciones ExtendScript para interactuar con Adobe Illustrator.
 */

#target illustrator

(function () {
  var scriptFolder = new File($.fileName).parent;
  var jsonPolyfill = new File(scriptFolder.fsName + "/lib/json2.js");
  if (typeof JSON === "undefined" && jsonPolyfill.exists) {
    $.evalFile(jsonPolyfill);
  } else if (typeof JSON === "undefined") {
    throw new Error("No se encontró json2.js en la carpeta lib.");
  }

  var utilsFolder = new Folder(scriptFolder.fsName + "/utils");
  if (utilsFolder.exists) {
    var mapFile = new File(utilsFolder.fsName + "/pathMap.js");
    if (mapFile.exists) {
      try {
        $.evalFile(mapFile);
      } catch (mapErr) {
        $.writeln("ProxyFull: no se pudo evaluar pathMap.js - " + mapErr);
      }
    }
  }
  if (typeof ProxyFullPathMap === "undefined") {
    var ProxyFullPathMap = { aliases: {}, extraRoots: [] };
  }

  function respond(ok, payload, message) {
    var response = { ok: ok ? true : false };
    if (message) {
      response.message = message;
    }
    if (payload) {
      for (var key in payload) {
        if (payload.hasOwnProperty(key)) {
          response[key] = payload[key];
        }
      }
    }
    return JSON.stringify(response);
  }

  function normalizeSeparators(path) {
    if (!path || path === "") {
      return "";
    }
    var result = path.replace(/\\/g, "/");
    var result = path.replace(/\\+/g, "/");
    result = result.replace(/%20/g, " ");
    return result;
  }

  function toUnixPath(fileObj) {
    if (!fileObj) {
      return "";
    }
    var path = decodeURI(fileObj.fsName || fileObj);
    return normalizeSeparators(path);
  }

  function ensureDocument() {
    if (!app.documents.length) {
      throw new Error("Abrí un documento para continuar.");
    }
    return app.activeDocument;
  }

  function safeName(item) {
    try {
      if (item.name && item.name !== "") {
        return item.name;
      }
      if (item.file) {
        return item.file.displayName;
      }
    } catch (err) {}
    return "Vínculo sin nombre";
  }

  function buildLinkDescriptor(item, index) {
    var descriptor = {
      id: item.id,
      index: index,
      name: safeName(item),
      embedded: item.embedded ? true : false,
      path: "",
      status: "unknown"
    };
    try {
      if (!descriptor.embedded && item.file) {
        descriptor.path = toUnixPath(item.file);
      }
    } catch (err) {
      descriptor.path = "";
    }
    return descriptor;
  }

  function getRootPath(options, doc) {
    if (options && options.rootPath) {
      return normalizeSeparators(options.rootPath);
    }
    if (doc && !doc.saved) {
      throw new Error("El documento no está guardado. Seleccioná una carpeta raíz en la UI.");
    }
    if (doc && doc.saved) {
      return toUnixPath(doc.path);
    }
    return "";
  }

  function getLinkedItemsInternal() {
    var doc = ensureDocument();
    var placed = doc.placedItems;
    var links = [];
    for (var i = 0; i < placed.length; i++) {
      links.push(buildLinkDescriptor(placed[i], i));
    }
    return { document: doc, links: links };
  }

  function inferStatusBySuffix(name, options) {
    if (!name) {
      return "unknown";
    }
    var lower = name.toLowerCase();
    if (options.proxySuffix && options.proxySuffix !== "") {
      var proxySuffixLower = options.proxySuffix.toLowerCase();
      if (lower.indexOf(proxySuffixLower, lower.length - proxySuffixLower.length) !== -1) {
        return "proxy";
      }
    }
    if (options.hiresSuffix && options.hiresSuffix !== "") {
      var hiresSuffixLower = options.hiresSuffix.toLowerCase();
      if (lower.indexOf(hiresSuffixLower, lower.length - hiresSuffixLower.length) !== -1) {
        return "hires";
      }
    }
    return "unknown";
  }

  function inferStatusByFolder(path) {
    if (!path) {
      return "unknown";
    }
    var lower = path.toLowerCase();
    if (lower.indexOf("/proxy/") !== -1) {
      return "proxy";
    }
    if (lower.indexOf("/hires/") !== -1) {
      return "hires";
    }
    return "unknown";
  }

  function detectStatus(link, options) {
    if (!link.path) {
      return "unknown";
    }
    var folderStatus = inferStatusByFolder(link.path);
    if (folderStatus !== "unknown") {
      return folderStatus;
    }
    return inferStatusBySuffix(link.name || link.path, options);
  }

  function joinPath() {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) {
      var value = arguments[i];
      if (value !== null && value !== undefined && value !== "") {
        parts.push(value.replace(/(^\/+|\/+?$)/g, ""));
      }
    }
    return parts.join("/");
  }

  function applyAliases(path) {
    if (!path || !ProxyFullPathMap.aliases) {
      return path;
    }
    for (var key in ProxyFullPathMap.aliases) {
      if (ProxyFullPathMap.aliases.hasOwnProperty(key) && key !== "") {
        if (path.indexOf(key) !== -1) {
          return path.replace(key, ProxyFullPathMap.aliases[key]);
        }
      }
    }
    return path;
  }

  function findInExtraRoots(relativePath) {
    if (!relativePath || !ProxyFullPathMap.extraRoots || !ProxyFullPathMap.extraRoots.length) {
      return null;
    }
    for (var i = 0; i < ProxyFullPathMap.extraRoots.length; i++) {
      var root = ProxyFullPathMap.extraRoots[i];
      if (root && root.hires) {
        var candidate = normalizeSeparators(root.hires + "/" + relativePath);
        var file = new File(candidate);
        if (file.exists) {
          return candidate;
        }
      }
    }
    return null;
  }

  function computeRelative(path, base) {
    if (!path || !base) {
      return "";
    }
    var normPath = normalizeSeparators(path);
    var normBase = normalizeSeparators(base);
    if (normPath.indexOf(normBase) === 0) {
      return normPath.substring(normBase.length).replace(/^\//, "");
    }
    return "";
  }

  function buildFolderCandidate(link, options) {
    if (!link.path) {
      return null;
    }
    var root = options.rootResolved;
    if (!root) {
      return null;
    }
    var proxiesRoot = joinPath(root, "proxy");
    var relative = computeRelative(link.path, proxiesRoot);
    if (!relative) {
      return null;
    }
    if (!options.includeSubfolders && relative.indexOf("/") !== -1) {
      return null;
    }
    var target = joinPath(root, "hires", relative);
    target = applyAliases(target);
    var file = new File(target);
    if (file.exists) {
      return normalizeSeparators(target);
    }
    var fallback = findInExtraRoots(relative);
    return fallback;
  }

  function replaceSuffix(name, from, to) {
    if (!name || !from || !to) {
      return null;
    }
    if (name.length < from.length) {
      return null;
    }
    var tail = name.substring(name.length - from.length);
    if (tail.toLowerCase() !== from.toLowerCase()) {
      return null;
    }
    return name.substring(0, name.length - from.length) + to;
  }

  function buildSuffixCandidate(link, options) {
    if (!link.path) {
      return null;
    }
    var file = new File(link.path);
    if (!file.exists) {
      return null;
    }
    var name = file.name;
    var swapped = replaceSuffix(name, options.proxySuffix, options.hiresSuffix);
    if (!swapped) {
      return null;
    }
    var folderPath = normalizeSeparators(file.parent.fsName);
    var candidate = joinPath(folderPath, swapped);
    candidate = applyAliases(candidate);
    var hiresFile = new File(candidate);
    if (hiresFile.exists) {
      return normalizeSeparators(candidate);
    }
    var relative = computeRelative(candidate, options.rootResolved);
    if (relative) {
      var alt = findInExtraRoots(relative);
      if (alt) {
        return alt;
      }
    }
    return null;
  }

  function determineAction(link, options) {
    if (link.embedded) {
      return {
        action: "skip",
        target: "",
        message: "Vínculo incrustado. Omitido.",
        currentStatus: "embedded"
      };
    }
    if (!link.path) {
      return {
        action: "fail",
        target: "",
        message: "No se pudo obtener la ruta del vínculo.",
        currentStatus: "unknown"
      };
    }
    var candidate = null;
    if (options.mode === "folder") {
      candidate = buildFolderCandidate(link, options);
    } else if (options.mode === "suffix") {
      candidate = buildSuffixCandidate(link, options);
    } else if (options.mode === "mixed") {
      candidate = buildFolderCandidate(link, options);
      if (!candidate) {
        candidate = buildSuffixCandidate(link, options);
      }
    }
    var status = detectStatus(link, options);
    if (!candidate) {
      if (status === "hires") {
        return {
          action: "keep",
          target: link.path,
          message: "El vínculo ya apunta a hires.",
          currentStatus: "hires"
        };
      }
      return {
        action: "fail",
        target: "",
        message: "No se encontró versión hires.",
        currentStatus: status
      };
    }
    if (candidate === link.path) {
      return {
        action: "keep",
        target: candidate,
        message: "El vínculo ya apunta a hires.",
        currentStatus: status || "hires"
      };
    }
    return {
      action: "relink",
      target: candidate,
      message: "Listo para relinkear a hires.",
      currentStatus: status || "proxy"
    };
  }

  function summarizePlan(plan) {
    var summary = { total: plan.length, relink: 0, failed: 0, skipped: 0 };
    for (var i = 0; i < plan.length; i++) {
      var entry = plan[i];
      if (entry.action === "relink") {
        summary.relink++;
      } else if (entry.action === "fail") {
        summary.failed++;
      } else {
        summary.skipped++;
      }
    }
    return summary;
  }

  function buildLogEntries(plan, documentName, runType) {
    var entries = [];
    var timestamp = new Date();
    var docName = documentName || "Documento sin nombre";
    for (var i = 0; i < plan.length; i++) {
      var row = plan[i];
      entries.push({
        fecha: timestamp.toISOString(),
        doc: docName,
        vinculo: row.name,
        estado: row.currentStatus,
        destino: row.target || "",
        accion: runType === "apply" ? row.action : "preview:" + row.action,
        resultado: row.result || (runType === "apply" ? (row.action === "relink" ? "pendiente" : "sin cambios") : "analizado"),
        mensaje: row.message
      });
    }
    return entries;
  }

  function writeLog(entries, summary) {
    try {
      var desktop = Folder.desktop;
      var stamp = new Date();
      var pad = function (value) {
        return value < 10 ? "0" + value : value;
      };
      var name = "proxyfull_" + stamp.getFullYear() + pad(stamp.getMonth() + 1) + pad(stamp.getDate()) + "_" + pad(stamp.getHours()) + pad(stamp.getMinutes()) + pad(stamp.getSeconds());
      var csvFile = new File(desktop.fsName + "/" + name + ".csv");
      var jsonFile = new File(desktop.fsName + "/" + name + ".json");
      var header = "fecha,doc,vinculo,estado,destino,accion,resultado,mensaje";
      var csvLines = [header];
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var line = [e.fecha, e.doc, e.vinculo, e.estado, e.destino, e.accion, e.resultado, e.mensaje];
        for (var j = 0; j < line.length; j++) {
          var cell = line[j];
          if (typeof cell === "string") {
            cell = '"' + cell.replace(/"/g, '""') + '"';
          }
          line[j] = cell;
        }
        csvLines.push(line.join(","));
      }
      csvFile.encoding = "UTF-8";
      csvFile.open("w");
      csvFile.write(csvLines.join("\n"));
      csvFile.close();

      var jsonData = { entries: entries, resumen: summary };
      jsonFile.encoding = "UTF-8";
      jsonFile.open("w");
      jsonFile.write(JSON.stringify(jsonData, null, 2));
      jsonFile.close();

      return { csvPath: toUnixPath(csvFile), jsonPath: toUnixPath(jsonFile) };
    } catch (err) {
      return { error: err.message };
    }
  }

  function attachResultToPlan(plan, resultsMap) {
    for (var i = 0; i < plan.length; i++) {
      var item = plan[i];
      var result = resultsMap[item.id];
      if (result) {
        item.result = result.result;
        item.message = result.message;
        item.action = result.action;
        item.target = result.target;
        if (result.result === "ok") {
          item.currentStatus = "hires";
        }
      }
    }
    return plan;
  }

  function getLinkedItems() {
    try {
      var data = getLinkedItemsInternal();
      var docPath = "";
      if (data.document && data.document.saved) {
        docPath = toUnixPath(data.document.fullName);
      }
      return respond(true, { items: data.links, documentPath: docPath });
    } catch (err) {
      return respond(false, null, err.message);
    }
  }

  function dryRunResolve(mode, optionsJSON) {
    try {
      var parsed = optionsJSON ? JSON.parse(optionsJSON) : {};
      parsed.mode = mode;
      var data = getLinkedItemsInternal();
      var doc = data.document;
      parsed.rootResolved = getRootPath(parsed, doc);
      var plan = [];
      for (var i = 0; i < data.links.length; i++) {
        var link = data.links[i];
        var decision = determineAction(link, parsed);
        plan.push({
          id: link.id,
          index: link.index,
          name: link.name,
          embedded: link.embedded,
          currentStatus: decision.currentStatus,
          action: decision.action,
          target: decision.target,
          message: decision.message,
          path: link.path
        });
      }
      var summary = summarizePlan(plan);
      var docName = doc.fullName ? doc.fullName.name : doc.name;
      var logEntries = buildLogEntries(plan, docName, "dry");
      var logResult = writeLog(logEntries, summary);
      return respond(true, {
        plan: plan,
        summary: summary,
        log: logResult,
        rootPath: parsed.rootResolved
      });
    } catch (err) {
      return respond(false, null, err.message);
    }
  }

  function applyRelink(planJSON) {
    try {
      var doc = ensureDocument();
      if (!planJSON) {
        throw new Error("Plan inválido.");
      }
      var plan = JSON.parse(planJSON);
      var placed = doc.placedItems;
      var resultMap = {};
      for (var i = 0; i < plan.length; i++) {
        var entry = plan[i];
        resultMap[entry.id] = {
          result: entry.result || "sin cambios",
          message: entry.message,
          action: entry.action,
          target: entry.target
        };
      }
      for (var p = 0; p < plan.length; p++) {
        var job = plan[p];
        if (job.action !== "relink") {
          continue;
        }
        var targetFile = new File(job.target);
        if (!targetFile.exists) {
          resultMap[job.id] = {
            result: "error",
            message: "Archivo destino inexistente: " + job.target,
            action: "fail",
            target: job.target
          };
          continue;
        }
        var relinked = false;
        for (var j = 0; j < placed.length; j++) {
          if (placed[j].id === job.id) {
            try {
              placed[j].file = targetFile;
              placed[j].update();
              resultMap[job.id] = {
                result: "ok",
                message: "Relink aplicado.",
                action: "relink",
                target: job.target
              };
              relinked = true;
            } catch (inner) {
              resultMap[job.id] = {
                result: "error",
                message: inner.message,
                action: "fail",
                target: job.target
              };
            }
            break;
          }
        }
        if (!relinked && !resultMap[job.id]) {
          resultMap[job.id] = {
            result: "error",
            message: "No se encontró el vínculo en el documento.",
            action: "fail",
            target: job.target
          };
        }
      }
      var updatedPlan = attachResultToPlan(plan, resultMap);
      var summary = summarizePlan(updatedPlan);
      var docName = doc.fullName ? doc.fullName.name : doc.name;
      var logEntries = buildLogEntries(updatedPlan, docName, "apply");
      var logResult = writeLog(logEntries, summary);
      return respond(true, { plan: updatedPlan, summary: summary, log: logResult });
    } catch (err) {
      return respond(false, null, err.message);
    }
  }

  function toDesktopLog(entriesJSON) {
    try {
      if (!entriesJSON) {
        throw new Error("Sin datos para registrar.");
      }
      var entries = JSON.parse(entriesJSON);
      var summary = summarizePlan(entries);
      var logResult = writeLog(entries, summary);
      return respond(true, { log: logResult });
    } catch (err) {
      return respond(false, null, err.message);
    }
  }

  $.global.getLinkedItems = getLinkedItems;
  $.global.dryRunResolve = dryRunResolve;
  $.global.applyRelink = applyRelink;
  $.global.toDesktopLog = toDesktopLog;
})();
