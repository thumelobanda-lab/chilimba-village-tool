/**
 * Downscales and re-encodes an image File/Blob before it ever reaches
 * uploadProfilePhoto() — this app's whole offline story assumes patchy,
 * slow mobile-money-grade connections (see useOfflineSync.js), so a raw
 * multi-megabyte phone-camera photo is exactly the wrong thing to send
 * over one. Always re-encodes as JPEG regardless of the source format
 * (transparency isn't a real concern for a face photo, and JPEG
 * compresses photos far smaller than PNG at equivalent visual quality).
 *
 * Not colocated with a vitest test — Image()/canvas decoding needs an
 * actual browser image pipeline that jsdom's default environment
 * doesn't provide, and mocking that away would just test the mock.
 *
 * @param {File|Blob} file
 * @param {number} [maxDimension] - longest side, in pixels
 * @param {number} [quality] - JPEG quality, 0-1
 * @returns {Promise<Blob>}
 */
export function resizeImageForUpload(file, maxDimension = 512, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not process that image."))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("That doesn't look like a valid image."));
    };
    img.src = objectUrl;
  });
}
