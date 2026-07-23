// ─────────────────────────────────────────────
// In-browser NSFW image screening via nsfwjs. The model (and TensorFlow) are
// loaded lazily on first use so they never bloat the initial bundle.
// Fails closed: if we can't verify an image, we don't send it.
// ─────────────────────────────────────────────

type Prediction = { className: string; probability: number };
type Model = { classify: (img: HTMLImageElement) => Promise<Prediction[]> };

let modelPromise: Promise<Model> | null = null;

async function getModel(): Promise<Model> {
  if (!modelPromise) {
    modelPromise = (async () => {
      await import("@tensorflow/tfjs");
      const nsfwjs = await import("nsfwjs");
      return (await nsfwjs.load()) as unknown as Model;
    })();
  }
  return modelPromise;
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("bad image"));
    img.src = URL.createObjectURL(file);
  });
}

export async function isImageSafe(
  file: File
): Promise<{ safe: boolean; reason?: string }> {
  let img: HTMLImageElement | null = null;
  try {
    const model = await getModel();
    img = await fileToImage(file);
    const preds = await model.classify(img);
    const score = (name: string) =>
      preds.find((p) => p.className === name)?.probability ?? 0;
    const porn = score("Porn");
    const hentai = score("Hentai");
    const sexy = score("Sexy");
    if (porn + hentai > 0.5 || sexy > 0.85) {
      return {
        safe: false,
        reason: "That image looks explicit, so it wasn't sent.",
      };
    }
    return { safe: true };
  } catch {
    // Model/verify failed — fail closed so nothing unchecked slips through.
    return {
      safe: false,
      reason: "Couldn't verify this image was safe — please try again.",
    };
  } finally {
    if (img) URL.revokeObjectURL(img.src);
  }
}
