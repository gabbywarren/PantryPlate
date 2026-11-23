import { createWorker } from "tesseract.js";

/**
 * Preprocesses a screenshot on an offscreen canvas (upscale small text, convert to high-contrast
 * grayscale, and invert dark-mode Instagram screenshots automatically) so local OCR accuracy
 * improves substantially on phone screenshots.
 */
async function preprocessImageForOcr(source: File | Blob | string): Promise<string> {
  const objectUrl = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode image for OCR"));
      el.src = objectUrl;
    });

    const maxDim = 2200;
    const minWidth = 1200;
    let scale = 1;
    if (img.width < minWidth) {
      scale = Math.min(2, minWidth / Math.max(1, img.width));
    }
    if (img.width * scale > maxDim || img.height * scale > maxDim) {
      scale = Math.min(maxDim / img.width, maxDim / img.height);
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return objectUrl;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Detect if dark mode screenshot (average luminance < 110)
    let lumSum = 0;
    const pixelCount = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      lumSum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    const isDarkBackground = lumSum / Math.max(1, pixelCount) < 110;

    // Grayscale + contrast boost + dark-mode inversion
    const contrast = 1.35;
    for (let i = 0; i < data.length; i += 4) {
      let lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (isDarkBackground) lum = 255 - lum;
      lum = Math.max(0, Math.min(255, (lum - 128) * contrast + 128));
      data[i] = lum;
      data[i + 1] = lum;
      data[i + 2] = lum;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    if (typeof source !== "string") {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

export async function extractTextFromScreenshots(
  sources: (File | Blob | string)[],
  onProgress?: (pct: number, statusLabel: string) => void
): Promise<string[]> {
  if (sources.length === 0) return [];

  onProgress?.(5, "Starting local OCR engine…");
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(Math.min(95, Math.round(15 + m.progress * 80)), "Reading recipe text…");
      } else if (m.status === "loading language traineddata") {
        onProgress?.(12, "Downloading English OCR model (cached for offline use)…");
      }
    },
  });

  const results: string[] = [];
  try {
    for (let i = 0; i < sources.length; i++) {
      onProgress?.(
        Math.round(15 + (i / sources.length) * 75),
        `Scanning screenshot ${i + 1} of ${sources.length}…`
      );
      const prepped = await preprocessImageForOcr(sources[i]);
      const {
        data: { text },
      } = await worker.recognize(prepped);
      results.push(text.trim());
    }
    onProgress?.(100, "Done!");
    return results;
  } finally {
    await worker.terminate();
  }
}
