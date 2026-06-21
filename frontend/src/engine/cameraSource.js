// engine/cameraSource.js
// Handles getting hand-landmark frames into the MediaPipe `Hands` engine,
// with a three-tier fallback so the app degrades gracefully instead of
// going blank: MediaPipe's own Camera helper -> raw getUserMedia -> a
// simulator that draws a placeholder so the rest of the UI stays testable
// without hardware.

export const STREAM_MODE = {
  MEDIAPIPE: 'mediapipe',
  NATIVE: 'native',
  SIMULATOR: 'simulator',
};

/**
 * Starts the best available video source and pipes frames into handsEngine.
 * Returns a teardown function and reports status changes via onStatus.
 */
export const startCameraSource = ({ videoEl, bioCanvasEl, handsEngine, onStatus }) => {
  let cameraStream = null;
  let fallbackInterval = null;
  let rafId = null;
  let stopped = false;

  const stop = () => {
    stopped = true;
    if (fallbackInterval) clearInterval(fallbackInterval);
    if (rafId) cancelAnimationFrame(rafId);
    if (cameraStream && typeof cameraStream.stop === 'function') {
      cameraStream.stop();
    } else if (videoEl?.srcObject) {
      videoEl.srcObject.getTracks().forEach((track) => track.stop());
    }
  };

  const activateSimulator = () => {
    onStatus({ mode: STREAM_MODE.SIMULATOR, message: 'Camera unavailable — simulator active' });
    if (!bioCanvasEl) return;
    bioCanvasEl.width = 640;
    bioCanvasEl.height = 480;
    const ctx = bioCanvasEl.getContext('2d');
    fallbackInterval = setInterval(() => {
      if (stopped) return;
      ctx.clearRect(0, 0, 640, 480);
      ctx.fillStyle = 'rgba(237, 232, 223, 0.06)';
      ctx.strokeStyle = 'rgba(237, 232, 223, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(10, 10, 620, 460);
      ctx.fillStyle = 'rgba(237, 232, 223, 0.7)';
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.fillText('No camera detected — connect a webcam to begin', 25, 35);
    }, 100);
  };

  const tryNative = () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      activateSimulator();
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (!videoEl || stopped) return;
        videoEl.srcObject = stream;
        const processFrame = async () => {
          if (!videoEl || videoEl.paused || videoEl.ended || stopped) return;
          try {
            await handsEngine.send({ image: videoEl });
          } catch {
            // a single dropped frame shouldn't kill the loop
          }
          rafId = requestAnimationFrame(processFrame);
        };
        videoEl.onloadedmetadata = () => {
          videoEl
            .play()
            .then(() => {
              rafId = requestAnimationFrame(processFrame);
              onStatus({ mode: STREAM_MODE.NATIVE, message: 'Camera connected' });
            })
            .catch(() => onStatus({ mode: STREAM_MODE.NATIVE, message: 'Camera permission denied', error: true }));
        };
      })
      .catch(() => activateSimulator());
  };

  const tryMediaPipeCamera = async () => {
    try {
      cameraStream = new window.Camera(videoEl, {
        onFrame: async () => {
          if (!videoEl || !bioCanvasEl || stopped) return;
          bioCanvasEl.width = videoEl.videoWidth;
          bioCanvasEl.height = videoEl.videoHeight;
          await handsEngine.send({ image: videoEl });
        },
        width: 640,
        height: 480,
      });
      await cameraStream.start();
      onStatus({ mode: STREAM_MODE.MEDIAPIPE, message: 'Camera connected' });
    } catch (err) {
      console.warn('MediaPipe camera helper failed, falling back to native stream', err);
      tryNative();
    }
  };

  tryMediaPipeCamera();

  return stop;
};
