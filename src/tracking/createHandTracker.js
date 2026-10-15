import { DrawingUtils, FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import simdLoader from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import simdBinary from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import basicLoader from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url'
import basicBinary from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url'

export async function createHandTracker(canvas) {
  // Usamos los archivos de la misma versión que instalamos con npm.
  const simd = await FilesetResolver.isSimdSupported()
  const detector = await HandLandmarker.createFromOptions({
    wasmLoaderPath: simd ? simdLoader : basicLoader,
    wasmBinaryPath: simd ? simdBinary : basicBinary,
  }, {
    baseOptions: { modelAssetPath: `${import.meta.env.BASE_URL}models/hand_landmarker.task` },
    runningMode: 'VIDEO',
    numHands: 1,
  })
  const context = canvas.getContext('2d')
  const drawing = new DrawingUtils(context)

  return {
    detect(video, timestamp) {
      // Cada resultado contiene los 21 puntos de cada mano encontrada.
      const result = detector.detectForVideo(video, timestamp)
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }
      context.clearRect(0, 0, canvas.width, canvas.height)
      for (const points of result.landmarks) {
        drawing.drawConnectors(points, HandLandmarker.HAND_CONNECTIONS, {
          color: '#7aff9b', lineWidth: 3,
        })
        drawing.drawLandmarks(points, { color: '#7aff9b', radius: 3 })
        drawing.drawLandmarks([points[4]], { color: '#ffad46', fillColor: '#ffad46', radius: 7 })
        drawing.drawLandmarks([points[8]], { color: '#5cdeff', fillColor: '#5cdeff', radius: 7 })
      }
      return result.landmarks[0] ?? null
    },
    close() {
      detector.close()
      drawing.close()
      context.clearRect(0, 0, canvas.width, canvas.height)
    },
  }
}
