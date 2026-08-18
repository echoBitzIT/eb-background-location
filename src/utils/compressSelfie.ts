import { Image } from 'react-native-compressor';
import { fileUriToBase64 } from './fileBase64';

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/**
 * Resize/compress a local selfie, then return raw base64 for API upload.
 * On compress failure, falls back to uncompressed fileUriToBase64.
 */
export async function compressSelfieToBase64(path: string): Promise<string> {
  const uri = toFileUri(path);

  try {
    const compressedUri = await Image.compress(uri, {
      compressionMethod: 'auto',
      maxWidth: 1280,
      maxHeight: 1280,
      quality: 0.6,
      output: 'jpg',
      returnableOutputType: 'uri',
    });

    return await fileUriToBase64(compressedUri);
  } catch {
    return fileUriToBase64(path);
  }
}
