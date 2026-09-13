import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Shrink a camera photo before it is uploaded.
 *
 * A modern iPhone shoots ~12 MP, which is several megabytes of JPEG. Sending that
 * untouched is wrong three times over: it is slow on a phone network, it is stored
 * forever at full size, and the vision model has to downscale it anyway before it
 * can look at it -- so the only thing the extra pixels buy is latency.
 *
 * 1600px on the long edge is well above what the model needs to count cars in a
 * lot, and lands around 200-400 KB.
 *
 * Failure here is not fatal: if manipulation fails for any reason the original URI
 * is returned and the upload proceeds as before.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.6;

export async function preparePhoto(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_EDGE } }],
      { compress: QUALITY, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  } catch {
    return uri;
  }
}
