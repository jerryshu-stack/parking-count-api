import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Shrink a camera photo before it is uploaded, and confirm the result is a file
 * that can actually be read back.
 *
 * A modern phone shoots ~12 MP, several megabytes of JPEG. The vision model
 * downscales it before it looks at it, so the extra pixels buy nothing but upload
 * time and storage -- a full-size upload was measured end to end at 36 seconds.
 *
 * Uses the contextual API; `manipulateAsync` is deprecated as of SDK 52.
 *
 * Returns the original URI if anything here fails: a smaller photo is an
 * optimisation, and it must never be the reason a report cannot be sent.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.6;

export async function preparePhoto(uri: string): Promise<string> {
  try {
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width: MAX_EDGE });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });

    // A URI that exists but is empty would fail inside fetch with an opaque
    // network error, so it is cheaper to find out here.
    const info = await FileSystem.getInfoAsync(saved.uri);
    if (!info.exists || !('size' in info) || !info.size) return uri;

    console.log(`[parktogether] photo prepared: ${Math.round(info.size / 1024)} KB`);
    return saved.uri;
  } catch (e) {
    console.error(`[parktogether] photo prepare failed, sending original -- ${String(e)}`);
    return uri;
  }
}
