const API_URL = import.meta.env.VITE_BACKEND_API_URL

export async function uploadFileTurbo(file: File, tags: { name: string, value: string }[] = []) {
  const { ArconnectSigner, TurboFactory } = await import('@ardrive/turbo-sdk/web')
  const { buildMemoryUploadTags } = await import('@/utils/memory-tags')
  const { QuickWallet } = await import('quick-wallet')

  QuickWallet.connect()
  const signer = new ArconnectSigner(QuickWallet)
  const turbo = TurboFactory.authenticated({ signer })
  const res = await turbo.uploadFile({
    fileStreamFactory: () => file.stream(),
    fileSizeFactory: () => file.size,
    dataItemOpts: {
      tags: buildMemoryUploadTags(file, tags),
    }
  })
  return res.id;
}

export interface UploadMetadata {
  title: string
  location: string
  handle: string
  handlePlatform: string
  isPublic: boolean
  description?: string
  datetime?: string
}

export async function uploadViaBackend(file: File, metadata: UploadMetadata): Promise<string> {
  if (!API_URL) {
    throw new Error('VITE_BACKEND_API_URL is not configured')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('title', metadata.title)
  formData.append('location', metadata.location)
  formData.append('handle', metadata.handle)
  formData.append('handlePlatform', metadata.handlePlatform)
  formData.append('isPublic', String(metadata.isPublic))

  if (metadata.description?.trim()) {
    formData.append('description', metadata.description.trim())
  }

  if (metadata.datetime) {
    formData.append('datetime', metadata.datetime)
  }

  const res = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    body: formData,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.reason || data.error || `Upload failed (HTTP ${res.status})`)
  }

  return data.id
}