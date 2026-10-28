# Changelog

Todos los cambios relevantes de RamTrace se documentan en este archivo.

El formato sigue las recomendaciones de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto utiliza versionado semántico.

## [1.1.0] - 2026-10-28

### Añadido

- Sistema de cinco temas visuales: Oscuro, Claro, Lavanda suave, Azul neón y Carmesí editorial.
- Temas con paletas, formas, paneles, bordes y fondos propios.
- Fondos optimizados para Lavanda, Azul neón y Carmesí con capas de contraste.
- Selector visual de temas con vista previa.
- Modo de Efectos reducidos: sin desenfoques, sombras ni animaciones decorativas, con paneles más opacos.
- Tipografía Montserrat local, sin dependencia de Internet.
- Controles de video independientes en los temas inmersivos.

### Cambiado

- Rediseño completo de los temas Oscuro y Claro.
- Video de fondo optimizado a 1080p con menor peso.
- El color de acento personalizado se limita a los temas Oscuro y Claro.
- Actualización de la versión del proyecto y del ejecutable portable a 1.1.0.

## [1.0.0] - 2026-10-25

### Añadido

- Versión inicial de RamTrace para Windows 10 y 11.
- Panel principal con métricas reales de memoria RAM instalada, utilizable, en uso y disponible.
- Consulta de módulos físicos mediante CIM/WMI.
- Monitoreo en tiempo real con gráfica de las últimas 60 muestras.
- Indicadores de estado con umbrales de 70% y 85%.
- Medidor circular con porcentaje y color según el estado.
- Diagnóstico de memoria con acceso seguro a `mdsched.exe`.
- Generación y exportación de reportes en TXT y CSV.
- Configuración persistente de intervalo, unidades y video de fondo.
- Interfaz oscura tecnológica con video de fondo y logo oficial.
- Aislamiento de contexto y comunicación segura mediante preload e IPC.

[1.1.0]: https://github.com/nanayoha02/RAMTRACE/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/nanayoha02/RAMTRACE/releases/tag/v1.0.0
