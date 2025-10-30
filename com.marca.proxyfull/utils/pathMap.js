/**
 * Archivo de configuración adicional para mapear rutas personalizadas.
 * Actualizá los valores según tus necesidades locales.
 * Este archivo es interpretado por ExtendScript, por lo que debe ser JavaScript ES3.
 */
if (typeof ProxyFullPathMap === "undefined") {
  var ProxyFullPathMap = {};
}

// Carpetas adicionales donde buscar equivalencias manuales.
// Cada entrada debe incluir las propiedades `proxy` y `hires` con rutas absolutas.
// Ejemplo:
// ProxyFullPathMap.extraRoots = [
//   { proxy: "/Volumes/proyectos/proxy", hires: "/Volumes/proyectos/hires" }
// ];
if (!ProxyFullPathMap.extraRoots) {
  ProxyFullPathMap.extraRoots = [];
}

// Aliases para carpetas con nombres distintos entre proxy y hires.
// La clave es un segmento o ruta parcial presente en los proxies y el valor su par hires.
// Ejemplo: ProxyFullPathMap.aliases = { "/baja/": "/alta/" };
if (!ProxyFullPathMap.aliases) {
  ProxyFullPathMap.aliases = {};
}
