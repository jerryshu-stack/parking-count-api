/**
 * Holds the photo just taken, between the camera screen and the review screen.
 *
 * It deliberately does not travel through navigation params. A native camera URI
 * is a long `file:///var/mobile/Containers/...` path, and routing it through the
 * router means percent-encoding it into a query string and decoding it back out.
 * Anything lost in that round trip produces a path that still looks like a URI but
 * no longer resolves, and React Native's FormData reports that as a generic
 * "Network request failed" from fetch -- with no request ever leaving the device,
 * which is exactly what the server logs showed.
 *
 * A module-scoped handoff has none of that: the string the camera produced is the
 * string the uploader gets.
 */

let pending: string | null = null;

export function setPendingPhoto(uri: string) {
  pending = uri;
}

export function takePendingPhoto(): string | null {
  return pending;
}

export function clearPendingPhoto() {
  pending = null;
}
