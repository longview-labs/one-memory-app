export type HandlePlatform = 'x' | 'instagram' | 'telegram'

export const HANDLE_PLATFORM_TAG = 'Handle-Platform'

export const sanitizeHandle = (handle?: string | null): string => {
    if (!handle) return ''
    return handle.trim().replace(/^@+/, '')
}

export const formatHandleForDisplay = (handle?: string | null): string => {
    const normalized = sanitizeHandle(handle)
    return normalized ? `@${normalized}` : ''
}

export const normalizeHandlePlatform = (platform?: string | null): HandlePlatform => {
    if (!platform) return 'x'
    const normalized = platform.trim().toLowerCase()
    if (normalized === 'instagram') return 'instagram'
    if (normalized === 'telegram') return 'telegram'
    return 'x'
}

export const buildHandleProfileUrl = (
    handle?: string | null,
    platform?: HandlePlatform | string | null,
): string | null => {
    const normalizedHandle = sanitizeHandle(handle)
    if (!normalizedHandle) return null

    const normalizedPlatform = normalizeHandlePlatform(platform)
    const encoded = encodeURIComponent(normalizedHandle)

    if (normalizedPlatform === 'instagram') {
        return `https://instagram.com/${encoded}`
    }

    if (normalizedPlatform === 'telegram') {
        return `https://t.me/${encoded}`
    }

    return `https://x.com/${encoded}`
}

export interface HandleValidationResult {
    isValid: boolean
    normalizedHandle: string
    error?: string
}

export const validateHandleForPlatform = (
    handle?: string | null,
    platform?: HandlePlatform | string | null,
): HandleValidationResult => {
    const normalizedHandle = sanitizeHandle(handle)
    const normalizedPlatform = normalizeHandlePlatform(platform)

    if (!normalizedHandle) {
        return {
            isValid: false,
            normalizedHandle,
            error: 'Please enter your handle.',
        }
    }

    if (/\s/.test(normalizedHandle)) {
        return {
            isValid: false,
            normalizedHandle,
            error: 'Handle cannot contain spaces.',
        }
    }

    if (normalizedPlatform === 'x') {
        if (!/^[A-Za-z0-9_]{1,15}$/.test(normalizedHandle)) {
            return {
                isValid: false,
                normalizedHandle,
                error: 'X handle must be 1-15 characters using letters, numbers, or underscore.',
            }
        }
    }

    if (normalizedPlatform === 'instagram') {
        if (!/^[A-Za-z0-9._]{1,30}$/.test(normalizedHandle)) {
            return {
                isValid: false,
                normalizedHandle,
                error: 'Instagram handle must be 1-30 characters using letters, numbers, period, or underscore.',
            }
        }

        if (normalizedHandle.startsWith('.') || normalizedHandle.endsWith('.') || normalizedHandle.includes('..')) {
            return {
                isValid: false,
                normalizedHandle,
                error: 'Instagram handle cannot start/end with a period or contain consecutive periods.',
            }
        }
    }

    if (normalizedPlatform === 'telegram') {
        if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(normalizedHandle)) {
            return {
                isValid: false,
                normalizedHandle,
                error: 'Telegram handle must be 5-32 characters, start with a letter, and only use letters, numbers, or underscore.',
            }
        }
    }

    return {
        isValid: true,
        normalizedHandle,
    }
}