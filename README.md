# E1064 - Lector digital

Lector estático para GitHub Pages del estudio **Consultoría en Estrategias de Posicionamiento de Marca Corporativa**.

## Estructura

- `index.html` - página principal y lector.
- `css/styles.css` - diseño responsive y animación 3D de cambio de página.
- `js/reader.js` - navegación, cambio de tomo, zoom, fullscreen y gestos móviles.
- `assets/mockup.jpg` - mockup del estudio.
- `pages/tomo-1/` - 253 páginas renderizadas en WebP.
- `pages/tomo-2/` - 369 páginas renderizadas en WebP.
- `.nojekyll` - evita procesamiento de Jekyll.
- `robots.txt` - solicita a buscadores no indexar el sitio.

## Publicar en GitHub Pages

1. Crea un repositorio nuevo.
2. Sube **el contenido de esta carpeta** conservando la estructura.
3. En GitHub abre `Settings > Pages`.
4. En `Build and deployment`, selecciona `Deploy from a branch`.
5. Elige `main` y `/ (root)`.
6. Guarda y espera a que GitHub publique la URL.

## Sobre los PDF

Los PDF originales **no se incluyen** en esta carpeta. El lector utiliza páginas renderizadas como imágenes WebP y no presenta botones de descarga o impresión.

Esto evita ofrecer el PDF como archivo descargable, pero no constituye DRM: si el repositorio o GitHub Pages es público, una persona con conocimientos técnicos todavía puede acceder a los archivos de imagen individuales desde el navegador.

Si el estudio contiene información confidencial, no debe considerarse GitHub Pages público como un sistema de control de acceso.
