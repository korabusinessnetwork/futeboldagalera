import { FOTO } from '../domain/constants'

/**
 * Comprime a foto no cliente: crop central quadrado, 320x320, JPEG q=0.72.
 * Constantes da secao 11 da spec.
 */
export async function compressPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2

  const canvas = document.createElement('canvas')
  canvas.width = FOTO.size
  canvas.height = FOTO.size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível neste dispositivo.')
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, FOTO.size, FOTO.size)
  bitmap.close?.()
  return canvas.toDataURL('image/jpeg', FOTO.quality)
}
