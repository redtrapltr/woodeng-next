/* src/lib/image.ts ---------------------------------------------- */
export async function validateImage(file: File) {
  const max = 5 * 1024 * 1024; // 5 MB
  if (!/image\/(png|jpe?g)/i.test(file.type)) {
    throw new Error('Only PNG or JPG images are allowed');
  }
  if (file.size > max) throw new Error('Image must be ≤ 5 MB');
}

/**
 * Temporary client-side “upload”.
 * Replace this with your S3 / IPFS / backend call later.
 */
export async function uploadImage(file: File): Promise<string> {
  await validateImage(file);
  return URL.createObjectURL(file);               // previewable blob-URL
}
