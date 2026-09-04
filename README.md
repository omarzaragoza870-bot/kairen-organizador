# KAIREN Organizador de archivos

Aplicación web para organizar, convertir y preparar imágenes y documentos PDF directamente desde el navegador.

La interfaz utiliza un estilo claro inspirado en iOS: superficies blancas, fondo gris suave, controles redondeados y azul como color principal.

## Herramientas incluidas

- Renombrar archivos de forma secuencial o mediante búsqueda y reemplazo.
- Crear uno o varios PDF a partir de imágenes.
- Convertir imágenes entre JPG, PNG, WEBP y BMP.
- Leer archivos HEIC, HEIF, TIFF, GIF y otros formatos compatibles.
- Comprimir imágenes y cambiar su ancho máximo.
- Unir varios archivos PDF.
- Aplanar formularios PDF.
- Separar un PDF por grupos de páginas.
- Quitar fondos con procesamiento local.
- Detectar, recortar y enderezar documentos fotografiados.

## Privacidad

La aplicación no incluye servidor, base de datos ni sistema de carga de archivos. Las imágenes y los PDF seleccionados se procesan dentro del navegador del usuario.

Algunas herramientas descargan librerías o modelos desde internet para poder funcionar. Esto no significa que los archivos seleccionados se envíen a esos servicios.

## Cómo usarlo

1. Abre `index.html` en Google Chrome o Microsoft Edge.
2. Elige una herramienta en la barra superior.
3. Arrastra los archivos al área indicada o presiónala para seleccionarlos.
4. Ajusta las opciones necesarias.
5. Presiona el botón principal para procesar y descargar el resultado.

También puede publicarse directamente mediante GitHub Pages, sin compilación y sin instalar paquetes.

## Estructura del proyecto

```text
kairen-organizador/
├── index.html
├── README.md
└── assets/
    ├── css/
    │   └── styles.css
    ├── img/
    │   └── kairen-logo.png
    └── js/
        ├── app.js
        └── vendor-loader.js
```

- `index.html`: contiene únicamente la estructura de la página.
- `assets/css/styles.css`: contiene colores, diseño y adaptación para teléfonos.
- `assets/js/app.js`: contiene el funcionamiento de las nueve herramientas.
- `assets/js/vendor-loader.js`: carga los componentes especiales para HEIC y eliminación de fondo.
- `assets/img/kairen-logo.png`: logotipo utilizado por la página y el navegador.

## Recomendaciones

- Mantén abierta la pestaña mientras se procesan los archivos.
- Con lotes grandes, procesa grupos pequeños para reducir el uso de memoria.
- Revisa los documentos escaneados automáticamente antes de reemplazar cualquier archivo original.
- Conserva siempre una copia de los archivos originales.

## Dependencias externas

- jsPDF
- JSZip
- UTIF.js
- PDF-Lib
- OpenCV.js
- heic-to
- IMG.LY Background Removal

Se necesita conexión a internet para cargar estas dependencias y los modelos que algunas herramientas utilizan por primera vez.

## Compatibilidad

Recomendado para versiones recientes de Google Chrome y Microsoft Edge en Windows, macOS y Android.

## Autor

© 2026 KAIREN · Creado por Isai Zaragoza · Todos los derechos reservados.
