/**
 * Read a local image file path and return raw base64 (no data-URI prefix).
 */
export async function fileUriToBase64(path: string): Promise<string> {
  const uri = path.startsWith('file://') ? path : `file://${path}`;
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Could not read selfie image.');
  }
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string' || !result) {
        reject(new Error('Could not read selfie image.'));
        return;
      }
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      if (!base64?.trim()) {
        reject(new Error('Could not read selfie image.'));
        return;
      }
      resolve(base64.trim());
    };
    reader.onerror = () => reject(new Error('Could not read selfie image.'));
    reader.readAsDataURL(blob);
  });
}
