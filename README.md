# RECapp · Logo 3D

Vue 3 + Three.js + Vite. Una escena negra a pantalla completa con el logo
original extruido, rojo `#D50006` y blanco, iluminación frontal y giro de 360°
cada 30 segundos. Un reflejo tenue que se desvanece debajo del logo simula un
piso negro, con separación para dar la sensación de que el logo flota.
Pensada para monitores de escritorio, sin interfaz adicional.

## Ejecutar

Requiere Node.js 22.12+ o 20.19+.

```sh
npm install
npm run dev
```

Abrir la dirección que indique Vite (normalmente `http://localhost:5173`).

```sh
npm run build
npm run preview
```

La versión de producción se genera en `dist/`.

## Geometría e iluminación

Los contornos de `src/assets/logo-contours.json` se extrajeron de la transparencia
de `RECAPP.png`. Cada franja tiene volumen real, caras laterales y un pequeño
bisel; los huecos están abiertos. Se conservan las letras, el punto y las cuatro
esquinas blancas de la imagen. El PNG original no se modifica.

En `src/scene/createLogoScene.js`, `settings` controla el ancho, la profundidad,
el tiempo por vuelta, la proporción de pantalla, la intensidad de la luz frontal,
la separación del piso y la opacidad del reflejo.
Los colores están en el JSON de contornos. El encuadre conserva las proporciones
del logo y se adapta al tamaño del monitor, sin layouts móviles.

La animación se pausa cuando la pestaña está oculta y respeta la preferencia de
movimiento reducido del sistema. Si WebGL no está disponible, se muestra una
versión vectorial estática del mismo logo.

Para regenerar contornos después de reemplazar la imagen (Python 3 con Pillow):

```sh
python3 scripts/trace-logo.py
```

## Verificación en navegador

```sh
npx playwright install chromium
npm test
```

Documentación de referencia: [Vue](https://vuejs.org/guide/quick-start.html),
[Vite](https://vite.dev/guide/) y [Three.js](https://threejs.org/docs/).
