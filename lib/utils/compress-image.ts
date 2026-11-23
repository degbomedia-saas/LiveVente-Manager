export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024 // 2 Mo maximum

export function validateImageFile(
  file: File
): { valid: true } | { valid: false; error: string } {
  if (
    !ALLOWED_IMAGE_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number]
    )
  ) {
    return {
      valid: false,
      error:
        'Format non autorisé. Seules les images JPEG, PNG ou WebP sont acceptées.',
    }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      valid: false,
      error: 'Image trop volumineuse : taille maximale autorisée de 2 Mo.',
    }
  }
  return { valid: true }
}

/**
 * Compression d'image côté client via Canvas HTML5 avant envoi vers Supabase Storage.
 * - Dimensions max : 1000 px (largeur ou hauteur, ratio conservé)
 * - Format de sortie : image/jpeg
 * - Qualité : 0.75
 */
export async function compressImageForUpload(
  file: File,
  maxDim = 1000,
  quality = 0.75
): Promise<File> {
  if (typeof document === 'undefined' || !file.type.startsWith('image/')) {
    return file
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onerror = () => resolve(file)
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => resolve(file)
      img.onload = () => {
        const largestSide = Math.max(img.width || 1, img.height || 1)
        const scale = Math.min(1, maxDim / largestSide)
        const width = Math.max(1, Math.round(img.width * scale))
        const height = Math.max(1, Math.round(img.height * scale))

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          resolve(file)
          return
        }

        // Fond blanc pour éviter les transparences PNG qui deviennent noires en JPEG
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file)
              return
            }
            const baseName =
              file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') ||
              'image'
            const compressedFile = new File([blob], `${baseName}.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          },
          'image/jpeg',
          quality
        )
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export async function compressImageToDataUrl(
  file: File,
  maxDim = 1000,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Format image invalide'))
      img.onload = () => {
        const largestSide = Math.max(img.width || 1, img.height || 1)
        const scale = Math.min(1, maxDim / largestSide)
        const width = Math.max(1, Math.round(img.width * scale))
        const height = Math.max(1, Math.round(img.height * scale))

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(reader.result as string)
          return
        }

        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
