/**
 * DISCLAIMER:
 *  Archivo reducido de CSInterface.js con las APIs necesarias para este panel.
 */
(function () {
  if (window.__CSInterfaceLoaded) {
    return;
  }
  window.__CSInterfaceLoaded = true;

  function CSInterface() {
    this.hostEnvironment = this.getHostEnvironment();
  }

  var VulcanInterface = window.__adobe_cep__;

  function getSystemPath(pathType) {
    return VulcanInterface.getSystemPath(pathType);
  }

  CSInterface.prototype.getSystemPath = getSystemPath;

  CSInterface.prototype.getApplicationID = function () {
    var hostEnv = this.getHostEnvironment();
    return hostEnv.appId;
  };

  CSInterface.prototype.openURLInDefaultBrowser = function (url) {
    if (!url) {
      return;
    }
    VulcanInterface.openURLInDefaultBrowser(url);
  };

  CSInterface.prototype.getHostEnvironment = function () {
    return JSON.parse(VulcanInterface.getHostEnvironment());
  };

  CSInterface.prototype.evalScript = function (script, callback) {
    if (!script) {
      return;
    }
    VulcanInterface.evalScript(script, callback);
  };

  window.cep = window.cep || {};
  window.cep.fs = window.cep.fs || {};

  window.cep.fs.selectFolder = function (allowMultiple, message) {
    return new Promise(function (resolve) {
      VulcanInterface.showOpenDialogEx(
        allowMultiple,
        true,
        false,
        message || "Seleccionar carpeta",
        "",
        "",
        function (result) {
          resolve(result);
        }
      );
    });
  };

  window.SystemPath = {
    APPLICATION: "application",
    COMMON_FILES: "commonFiles",
    EXTENSION: "extension",
    HOST_APPLICATION: "hostApplication",
    MY_DOCUMENTS: "myDocuments",
    USER_DATA: "userData"
  };

  window.CSInterface = CSInterface;
})();
