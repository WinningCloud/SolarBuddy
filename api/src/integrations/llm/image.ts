import sharp from 'sharp';

/**
 * Resize to at most 1600px on the long edge, re-encode as JPEG and drop all metadata.
 * sharp removes EXIF (including GPS) unless told otherwise; rotate() applies the orientation first.
 */
export async function prepareImage(input: Buffer): Promise<{ dataUrl: string; bytes: number }> {
  const out = await sharp(input)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return { dataUrl: `data:image/jpeg;base64,${out.toString('base64')}`, bytes: out.length };
}
