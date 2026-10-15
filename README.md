# RECapp · Logo 3D

Vue 3 + Three.js + Vite. Una escena negra a pantalla completa con el logo
original extruido, rojo `#D50006` y blanco, iluminación frontal y giro de 360°
cada 30 segundos. Un reflejo tenue que se desvanece debajo del logo simula un
piso negro, con separación para dar la sensación de que el logo flota.
Pensada para monitores de escritorio, con un panel para practicar seguimiento de manos.

## Práctica de manos

Abrir la aplicación desde `localhost` (o HTTPS), pulsar **Activar cámara** y
mostrar una mano completa con buena iluminación. El panel dibuja 21 puntos:
la punta del pulgar (4) en naranja y la del índice (8) en celeste.
Elegir un modo con sus botones o mantener **✌️ durante 750 ms** para pasar al
siguiente (Zoom → Velocidad → Giro → Letras). Soltar el gesto durante al menos
350 ms antes de repetirlo. Una barra muestra el progreso de confirmación.

| Modo | Movimiento | Rango |
| --- | --- | --- |
| Zoom | Separar/juntar pulgar e índice | 0,60×–1,15× |
| Velocidad | Subir/bajar la mano | 0,25×–3,00× |
| Giro | Llevar la mano a un lado del recuadro | Izquierda/derecha; el centro conserva el sentido |
| Letras | Separar/juntar pulgar e índice | 0,65×–1,08× por letra |

Mantener **✊ durante 750 ms** pausa o reanuda el giro; también hay un botón.
El pulgar debe estar recogido para reconocer el puño. Los comandos tienen
prioridad sobre los ajustes continuos. Durante la pausa se puede seguir
ajustando zoom y letras. Al perder la mano o apagar la cámara, los valores
se conservan; el logo sigue girando si no se pausó explícitamente.

`src/tracking/handControls.js` contiene los modos, límites, reglas geométricas
para V/puño y la confirmación temporal. Son heurísticas para aprender con la
palma de frente, no un clasificador entrenado de gestos: con la mano de perfil
pueden fallar. No se requiere descargar otro modelo.

`src/tracking/handZoom.js` mide la separación entre los puntos 4 y 8 en píxeles
y la divide por la distancia entre muñeca (0) y base del dedo medio (9). Esa
proporción reduce el efecto de acercar toda la mano a la cámara; funciona mejor
con la palma de frente. Una apertura de 0,15 a 1,35 se convierte en zoom, con
límites y suavizado. Son umbrales iniciales ajustables para practicar.
Vue comunica el valor a `setZoom()` de la escena, que actualiza la cámara.
Los demás ajustes llegan por `setControls()`. La velocidad y el sentido se
integran en el tiempo para evitar saltos al cambiar de dirección.

`src/scene/logoParts.js` identifica las seis letras por sus límites en el PNG
original. Cada letra se escala desde su centro, junto con su reflejo. Las
cuatro esquinas y el punto rojo conservan su tamaño. Si se reemplaza el logo,
hay que actualizar esos límites además de regenerar sus contornos.

`src/components/HandPractice.vue` administra la cámara y el ciclo de detección.
`src/tracking/createHandTracker.js` carga MediaPipe, analiza cada cuadro y dibuja
los puntos sobre un canvas transparente. Se analiza una mano hasta 20 veces por
segundo y se omite la detección cuando la pestaña está oculta.

El modelo está en `public/models/hand_landmarker.task`, descargado del
[modelo oficial, versión 1](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task).
Los archivos WebAssembly se incluyen desde la dependencia instalada, también
en la compilación de producción. El video se procesa en el navegador.
Referencia: [Hand Landmarker para JavaScript](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js).

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
