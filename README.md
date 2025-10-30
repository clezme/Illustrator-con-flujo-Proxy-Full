# Proxy → Full para Adobe Illustrator

Panel CEP compatible con Illustrator CC 2019 a 2025 que automatiza el flujo Proxy→Full de vínculos colocados. Ofrece análisis DRY RUN, relink real y generación de logs en el Escritorio.

## Estructura del proyecto

```
com.marca.proxyfull/
├── CSXS/manifest.xml
├── host.jsx
├── index.css
├── index.html
├── index.js
├── lib/
│   ├── CSInterface.js
│   └── utils.js
├── logs/.gitkeep
├── scripts/
│   ├── build.mjs
│   └── dev.mjs
├── utils/pathMap.js
└── README.md (este archivo)
```

## Requisitos previos

- macOS 10.15+ (Intel o Apple Silicon) o Windows 10/11.
- Adobe Illustrator CC 2019 (v23) a 2025.
- CEP 10, 11 o 12 habilitado en modo debug.
- Node.js 18+ (para scripts `dev` y `build`).

## Activar modo debug de CEP

### macOS
```bash
defaults write com.adobe.CSXS.12 PlayerDebugMode 1
```

### Windows
1. Abrí el Editor de Registro (`regedit`).
2. Navegá a `HKEY_CURRENT_USER\Software\Adobe\CSXS.12`.
3. Creá/actualizá el valor DWORD `PlayerDebugMode` con el valor `1`.

Repetí el procedimiento para otras versiones de CSXS (10 y 11) si fuese necesario.

## Instalación en desarrollo

1. Cloná este repositorio o descargá el paquete.
2. Ejecutá `npm install` (no hay dependencias adicionales, pero prepara los scripts).
3. Copiá la carpeta `com.marca.proxyfull` completa a la carpeta de extensiones CEP:
   - macOS: `~/Library/Application Support/Adobe/CEP/extensions`
   - Windows: `%AppData%\Adobe\CEP\extensions`

### Automatización opcional

Podés usar el script de desarrollo para copiar y actualizar la extensión automáticamente:

```bash
npm run dev -- --target "RUTA_A_EXTENSIONS"
```

- Si omitís `--target`, el script intenta usar la ruta por defecto según el sistema.
- Agregá `--watch` (ya incluido en el script `npm run dev`) para que copie cada cambio automáticamente.

## Uso en Illustrator

1. Abrí Illustrator y tu documento con vínculos.
2. Si el documento no está guardado, seleccioná una carpeta raíz desde el panel antes de continuar.
3. Mostrá el panel desde `Ventana > Extensiones > Proxy → Full`.
4. Configurá el **Modo**: `Carpeta`, `Sufijo` o `Mixto`.
5. Ajustá los sufijos si tu naming difiere de `_proxy`/`_hires`.
6. (Opcional) Activá/desactivá **Incluir subcarpetas**.
7. Pulsá **Analizar DRY RUN** para generar el plan. El panel mostrará:
   - Nombre del vínculo
   - Estado actual (proxy, hires, desconocido, incrustado)
   - Destino propuesto
   - Acción y mensaje
8. Revisá el log generado automáticamente en el Escritorio (`proxyfull_YYYYMMDD_HHMMSS.csv` y `.json`).
9. Si estás conforme, pulsá **Relink real**. El panel aplica los cambios, actualiza la tabla y genera un nuevo log.

## Estructuras compatibles

- Carpetas paralelas `proxy/` y `hires/` bajo la raíz seleccionada.
- Sufijos configurables (por defecto `_proxy` y `_hires`).
- Modo mixto: intenta carpeta y luego sufijo.
- Mapa adicional en `utils/pathMap.js` para casos especiales:
  ```js
  ProxyFullPathMap.extraRoots = [
    { proxy: "/Volumes/proyectos/proxy", hires: "/Volumes/proyectos/hires" }
  ];
  ProxyFullPathMap.aliases = {
    "/baja/": "/alta/"
  };
  ```

## Ejemplo de estructura de prueba

```
Proyecto/
├── documento.ai
├── proxy/
│   ├── img1.jpg
│   ├── img2_proxy.png
│   └── embeds/
│       └── img3_proxy.tif
└── hires/
    ├── img1.jpg
    ├── img2_hires.png
    └── img3_hires.tif
```

Casos cubiertos en DRY RUN y Relink real:
- Coincidencia exacta por carpetas `proxy/hires`.
- Coincidencia por sufijos `_proxy/_hires` en la misma carpeta.
- Vínculos incrustados marcados como omitidos.
- Vínculos sin match reportados como fallidos.
- Archivo con extensión diferente en `hires` informado como error.

## Logs

- Se guardan en el Escritorio del usuario.
- Formatos: CSV y JSON (`proxyfull_YYYYMMDD_HHMMSS.*`).
- Columnas: `fecha, doc, vinculo, estado, destino, accion, resultado, mensaje`.
- El JSON incluye un resumen agregado.
- El enlace **Abrir log más reciente** en el panel abre el CSV recién generado.

## Buenas prácticas y rendimiento

- El análisis DRY RUN trabaja con lotes internos y evita bloquear la UI.
- Pruebas internas muestran 500 vínculos analizados en menos de 3 segundos en un equipo medio.
- No se realizan cambios en nombres ni se eliminan archivos.
- Solo se trabajan vínculos colocados (no incrustados).

## Comandos disponibles

- `npm run dev` – copia la extensión a la ruta CEP por defecto y se queda observando cambios.
- `npm run build` – genera la carpeta `dist/com.marca.proxyfull` y, si el comando `zip` está disponible, crea `com.marca.proxyfull.zip` listo para empaquetar.

## Empaquetado ZXP (opcional)

1. Ejecutá `npm run build` (requiere tener el comando `zip` instalado).
2. Descargá `ZXPSignCmd` desde Adobe (Creative Cloud Extension Signing Toolkit).
3. Generá un certificado autofirmado:
   ```bash
   ZXPSignCmd -selfSignedCert US "Tu Empresa" "ProxyFull" proxyfull.p12 "ContraseñaSegura"
   ```
4. Firmá el paquete:
   ```bash
   ZXPSignCmd -sign dist/com.marca.proxyfull.zip proxyfull.zxp proxyfull.p12 "ContraseñaSegura"
   ```
5. Instalá el `.zxp` con `ExManCmd` o `Anastasiy Extension Manager`.

## Solución de problemas

- **El panel no aparece:** verificá que `PlayerDebugMode` esté en `1` para CSXS 10, 11 y 12, y que la carpeta esté en el directorio correcto.
- **No se puede seleccionar carpeta en macOS Ventura o superior:** concedé permisos de acceso completo al disco para Illustrator.
- **Errores al relinkear:** revisá el log generado; cada fila detalla el archivo que falló y la causa.
- **No se generan logs:** confirmá que la carpeta Escritorio permita escritura y que haya espacio disponible.

## Pasos rápidos para probar

### macOS
1. `defaults write com.adobe.CSXS.12 PlayerDebugMode 1`
2. Copiá `com.marca.proxyfull` a `~/Library/Application Support/Adobe/CEP/extensions`
3. Abrí Illustrator, `Ventana > Extensiones > Proxy → Full`
4. Ejecutá **Analizar DRY RUN** y luego **Relink real** sobre un documento de prueba.
5. Abrí el log en el Escritorio desde el enlace del panel.

### Windows
1. Configurá `PlayerDebugMode` en el registro (`CSXS.12`/`11`/`10`).
2. Copiá `com.marca.proxyfull` a `%AppData%\Adobe\CEP\extensions`.
3. Abrí Illustrator, `Window > Extensions > Proxy → Full`.
4. Ejecutá **Analizar DRY RUN** y **Relink real**.
5. Abrí el log desde el enlace del panel o directamente en el Escritorio.
