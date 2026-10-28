# RamTrace — Aplicación de Diagnóstico y Monitoreo de Memoria RAM

**MONITOREA · ANALIZA · PROTEGE**

**Versión 1.1.0**

Aplicación de escritorio nativa para Windows 10 y 11 desarrollada en el contexto de la asignatura *Organización y Arquitectura de Computadoras*. Permite consultar la capacidad física de hardware de la memoria RAM, monitorear la utilización en tiempo real con datos auténticos del sistema operativo, orientar al usuario en pruebas oficiales de hardware y generar reportes técnicos en formatos TXT y CSV.

---

## Novedades de la versión 1.1.0

- **Cinco temas con formas y fondos propios**: Oscuro, Claro, Lavanda suave, Azul neón y Carmesí editorial, cada uno con paleta, paneles, bordes, tipografía y fondo característicos.
- **Efectos reducidos**: opción de accesibilidad que elimina desenfoques y animaciones decorativas, y vuelve más opacos los paneles para mejorar el rendimiento y la legibilidad.
- **Videos de fondo optimizados**: video tecnológico en 1080p con menor peso, reproducción local y control independiente en los temas inmersivos para evitar distracciones.
- **Fondos temáticos optimizados**: patrones e imágenes suaves de Lavanda, Azul neón y Carmesí, con capas de contraste para mantener la legibilidad.
- **Tipografía local**: Montserrat incluida con la aplicación, sin dependencia de conexión a Internet.

---

## 1. Características Principales

- **Fidelidad Visual Absoluta**: Basada en el diseño de interfaz de referencia, conservando la paleta oscura tecnológica (*Deep Navy*, *Electric Blue*, *Cyber Violet*, *Cyan*), tarjetas redondeadas, resplandores discretos y el logo oficial de RamTrace.
- **Sistema de Cinco Temas**: Oscuro, Claro, Lavanda suave, Azul neón y Carmesí editorial. Cada tema redefine colores, formas, fondos, medidores y estados sin alterar la lógica de monitoreo.
- **Efectos Reducidos**: Modo de accesibilidad que desactiva desenfoques, sombras y animaciones decorativas, y aumenta la opacidad de los paneles.
- **Video de Fondo Integrado**: Reproducción fluida y en bucle del video de ambientación tecnológica optimizado a 1080p, con capa oscura de alto contraste, opción de desactivación para ahorro de energía y fallback a fondo oscuro si el video no estuviese presente.
- **Métricas Reales del Sistema Operativo Windows**:
  - Consulta directa mediante las APIs nativas de Windows (`GlobalMemoryStatusEx` a través de libuv/Node.js) con 0% de sobrecarga y latencia instantánea (< 1 ms).
  - Distinción rigurosa entre **RAM física instalada** (suma de módulos en placa base), **Memoria utilizable por Windows** (TotalVisibleMemorySize), **Memoria en uso**, **Memoria disponible** y **Memoria reservada para hardware** (BIOS / APU / GPU integrada).
  - Cálculo de **Memoria virtual comprometida** (Commit Limit / Pagefile).
- **Inspección de Módulos Físicos de Hardware**:
  - Consulta a nivel de hardware mediante CIM/WMI (`Win32_PhysicalMemory`).
  - Detección de ranuras (*DIMM / Controller Channel*), fabricante (*SK Hynix*, *Kingston*, *Crucial*, etc.), capacidad exacta, tipo de tecnología SMBIOS (*DDR4*, *DDR5*, *LPDDR5*, etc.), velocidad de reloj efectiva en **MT/s** y número de parte.
  - Gestión rigurosa: si una propiedad no es expuesta por el BIOS/fabricante, se muestra claramente como `«No disponible»` en lugar de inventar datos o asumir fallo.
- **Monitoreo en Tiempo Real**:
  - Gráfica continua en Canvas interactivo de alto rendimiento que mantiene las últimas 60 muestras de utilización.
  - Indicadores estadísticos: Valor actual, Mínimo registrado, Máximo registrado y Promedio de las muestras.
  - Semáforo de advertencia según la rúbrica de la práctica:
    - `< 70%`: Verde (*Normal* - Utilización dentro del rango definido para la práctica).
    - `70% a < 85%`: Amarillo (*Elevado* - Revisar aplicaciones abiertas).
    - `>= 85%`: Rojo (*Muy elevado* - Revisar la carga del equipo).
  - Controles de inicio, pausa y reinicio del historial.
- **Diagnóstico de Memoria**:
  - Aclaración fundamental: *Un uso elevado de memoria refleja demanda de software, no demuestra fallos físicos de hardware*.
  - Guía paso a paso para la herramienta oficial **Diagnóstico de memoria de Windows (`mdsched.exe`)**.
  - Lanzador seguro que invoca la herramienta oficial de Windows con solicitud de confirmación y elevación UAC, garantizando que RamTrace **nunca fuerce un reinicio automático**.
  - Registro de observaciones técnicas y estado de la prueba (*Pendiente*, *Realizada sin errores*, *Realizada con errores*, *No realizada*).
- **Generación y Exportación de Reportes**:
  - Exportación en archivos reales **TXT** y **CSV** con selector nativo de guardado de Windows (`SaveDialog`).
  - Incluye identificación del equipo, fecha/hora exacta, métricas de capacidad, desglose por módulo, resumen estadístico de la sesión de monitoreo, estado del diagnóstico, observaciones y nota técnica de limitaciones.
  - Formato CSV compatible con Excel gracias a la codificación UTF-8 con BOM.
- **Configuración Persistente**:
  - Frecuencia de muestreo configurable (1s, 2s, 3s, 5s).
  - Selección de unidades de visualización (**GB** o **MB**).
  - Selector de tema y color de acento para los temas Oscuro y Claro.
  - Modo de **Efectos reducidos** y conmutador de video de fondo.
  - Persistencia de opciones y observaciones en almacenamiento local.

---

## 2. Estructura de las 8 Secciones

1. **Panel principal**: Visión general del equipo, 4 tarjetas de capacidad, barra de utilización con semáforo, gráfica de las últimas 60 muestras, tabla previa de módulos, recomendaciones dinámicas y accesos directos.
2. **Memoria RAM**: Métricas detalladas que distinguen capacidad instalada vs. utilizable, memoria reservada para hardware, memoria virtual comprometida y sistema operativo.
3. **Módulos**: Tabla exhaustiva con todos los módulos físicos detectados mediante CIM/WMI (ranura, capacidad, fabricante, tipo DDR, MT/s, part number y estado).
4. **Monitoreo**: Gráfica de mayor tamaño para análisis continuo, estadísticas completas (mínimo, máximo, promedio y cantidad de muestras) y controles de inicio/pausa.
5. **Diagnóstico**: Explicación técnica de la diferencia entre presión de software y salud física de la RAM, guía para `mdsched.exe`, botón de inicio seguro de la herramienta de Windows, selector de estado y campo para observaciones.
6. **Reportes**: Vista previa del reporte actual y botones para exportar a archivos `.txt` y `.csv`.
7. **Configuración**: Intervalo de refresco, selector de unidad de memoria, cinco temas visuales, color de acento, efectos reducidos, conmutador del video de fondo, estado del servicio WMI y botón de recarga de hardware.
8. **Acerca de**: Identidad oficial, logo, descripción del proyecto, plataforma objetivo y relación con la asignatura *Organización y Arquitectura de Computadoras*.

---

## 3. Arquitectura del Proyecto

```
ramtrace/
├── package.json               # Configuración de dependencias y scripts de compilación
├── package-lock.json          # Resolución reproducible de dependencias
├── README.md                  # Documentación técnica completa
├── CHANGELOG.md               # Historial de versiones
├── src/
│   ├── assets/                # Recursos multimedia empaquetados
│   │   ├── logo.png           # Logo oficial de RamTrace (alta resolución)
│   │   ├── logo.ico           # Icono nativo para la ventana y el ejecutable
│   │   ├── bg-video.mp4       # Video de fondo tecnológico optimizado a 1080p
│   │   ├── fonts/             # Montserrat y Playfair Display locales
│   │   └── patterns/          # Fondos de Lavanda, Azul neón y Carmesí
│   ├── main/
│   │   ├── main.js            # Proceso principal de Electron (IPC, ventanas, mdsched, diálogos)
│   │   └── preload.js         # ContextBridge seguro (sin acceso irrestricto al SO)
│   ├── services/
│   │   ├── memoryService.js   # Proveedor de métricas reales de Windows (WMI + libuv)
│   │   └── reportService.js   # Generador de reportes en formatos TXT y CSV
│   └── renderer/
│       ├── index.html         # Estructura visual con las 8 secciones de RamTrace
│       ├── themes.css         # Tokens y paletas de los cinco temas
│       ├── styles.css         # Componentes visuales, fondos y efectos reducidos
│       └── app.js             # Lógica del cliente, gráficos Canvas, timers y navegación
└── dist/                      # Ejecutable generado para Windows
    ├── win-unpacked/          # Aplicación desempacada lista para ejecución
    └── RamTrace 1.1.0.exe     # Ejecutable portable autónomo
```

---

## 4. Instrucciones para Ejecución en Desarrollo

### Requisitos previos
- Windows 10 u 11 (64 bits).
- Node.js versión 18 o superior instalado.

### Pasos
1. Abrir una terminal de PowerShell en el directorio del proyecto:
   ```powershell
   cd ruta\a\RAMTRACE
   ```
2. Instalar dependencias (si no se han instalado):
   ```powershell
   npm install
   ```
3. Iniciar la aplicación en modo desarrollo:
   ```powershell
   npm start
   ```
4. Generar el ejecutable portable (opcional):
   ```powershell
   npm run build:portable
   ```

---

## 5. Proceso de Generación del Ejecutable

Para compilar la aplicación y generar el archivo ejecutable `.exe` para Windows:

```powershell
npm run build:portable
```

El ejecutable se generará en la carpeta `dist/`:
- **`dist/RamTrace 1.1.0.exe`**: Archivo ejecutable portable que no requiere instalación ni privilegios de administrador para ejecutarse en cualquier computadora con Windows 10 u 11.
- **`dist/win-unpacked/RamTrace.exe`**: Carpeta con los binarios listos para distribuir directamente o empaquetar.

---

## 6. Seguridad y Buenas Prácticas

- **Aislamiento de contexto (`contextIsolation: true`)**: El proceso de renderizado (HTML/JS) no tiene acceso directo a `require`, `node:fs` ni al shell del sistema operativo.
- **Preload seguro**: La comunicación se realiza exclusivamente a través de canales IPC específicos declarados en `preload.js`.
- **Protección contra inyección de comandos**: Ningún parámetro introducido por el usuario se concatena a comandos de PowerShell o del sistema.
- **Sin conexión requerida**: Todas las funciones de monitoreo, diagnóstico y reporte operan 100% de forma local y fuera de línea (*offline*).
