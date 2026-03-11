import { useCallback, useRef, useState } from 'react'
import { domToBlob } from 'modern-screenshot'
import { trackShareClipboardResult, trackShareInitiated, type ShareSurface } from '@/lib/analytics'

type StampLayout = 'horizontal' | 'vertical'

const FONT_STYLESHEET_SELECTOR = 'link[href*="fonts.googleapis.com/css2"]'
const FALLBACK_FONT_STYLESHEET_URL = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Montserrat:wght@300;400;500;600;700&display=swap'

let captureFontCssPromise: Promise<string | undefined> | null = null

const convertBlobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onloadend = () => {
        if (typeof reader.result === 'string') {
            resolve(reader.result)
            return
        }

        reject(new Error('Unable to convert font blob to data URL'))
    }

    reader.onerror = () => {
        reject(reader.error ?? new Error('Unable to read font blob'))
    }

    reader.readAsDataURL(blob)
})

const inlineFontUrls = async (cssText: string, stylesheetUrl: string) => {
    const urlPattern = /url\(([^)]+)\)/g
    const matches = Array.from(cssText.matchAll(urlPattern))

    if (matches.length === 0) return cssText

    const uniqueUrls = Array.from(new Set(matches.map((match) => match[1]?.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)))
    const replacementEntries = await Promise.all(
        uniqueUrls.map(async (rawUrl) => {
            if (!rawUrl || rawUrl.startsWith('data:')) {
                return [rawUrl, rawUrl] as const
            }

            const absoluteUrl = new URL(rawUrl, stylesheetUrl).toString()
            const response = await fetch(absoluteUrl, {
                cache: 'force-cache',
                mode: 'cors',
            })

            if (!response.ok) {
                throw new Error(`Failed to fetch capture font file: ${response.status}`)
            }

            const blob = await response.blob()
            const dataUrl = await convertBlobToDataUrl(blob)
            return [rawUrl, dataUrl] as const
        })
    )

    return replacementEntries.reduce((result, [rawUrl, dataUrl]) => {
        if (!rawUrl || rawUrl === dataUrl) return result
        return result.split(rawUrl).join(dataUrl)
    }, cssText)
}

const getCaptureFontCss = async () => {
    if (typeof window === 'undefined') return undefined

    if (!captureFontCssPromise) {
        captureFontCssPromise = (async () => {
            const fontStylesheetHref = document
                .querySelector<HTMLLinkElement>(FONT_STYLESHEET_SELECTOR)
                ?.href ?? FALLBACK_FONT_STYLESHEET_URL

            const response = await fetch(fontStylesheetHref, {
                cache: 'force-cache',
                mode: 'cors',
            })

            if (!response.ok) {
                throw new Error(`Failed to fetch capture font stylesheet: ${response.status}`)
            }

            const cssText = await response.text()
            return inlineFontUrls(cssText, fontStylesheetHref)
        })().catch((error) => {
            console.warn('Failed to load font CSS for screenshot capture:', error)
            captureFontCssPromise = null
            return undefined
        })
    }

    return captureFontCssPromise
}

interface UseStampCaptureShareOptions {
    captureLayout: StampLayout
    memoryId?: string
    shareSurface?: ShareSurface
}

export const useStampCaptureShare = ({ captureLayout, memoryId, shareSurface }: UseStampCaptureShareOptions) => {
    const [isSharePopupOpen, setIsSharePopupOpen] = useState(false)
    const [isCapturing, setIsCapturing] = useState(false)
    const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
    const hiddenHorizontalRef = useRef<HTMLDivElement>(null)
    const hiddenVerticalRef = useRef<HTMLDivElement>(null)

    const captureStampAsImage = useCallback(async (): Promise<Blob | null> => {
        const elementRef = captureLayout === 'vertical' ? hiddenVerticalRef : hiddenHorizontalRef
        if (!elementRef.current) return null

        const element = elementRef.current
        const originalVisibility = element.style.visibility
        const originalOpacity = element.style.opacity
        const originalPosition = element.style.position
        const originalLeft = element.style.left
        const originalTop = element.style.top
        const originalZIndex = element.style.zIndex

        try {
            setIsCapturing(true)

            element.style.visibility = 'visible'
            element.style.opacity = '1'
            element.style.position = 'absolute'
            element.style.left = '0'
            element.style.top = '0'
            element.style.zIndex = '9999'

            const fontCssTextPromise = getCaptureFontCss()

            if ('fonts' in document && document.fonts) {
                await document.fonts.ready

                await Promise.all([
                    document.fonts.load('400 16px "Instrument Serif"'),
                    document.fonts.load('300 16px "Montserrat"'),
                    document.fonts.load('400 16px "Montserrat"'),
                    document.fonts.load('500 16px "Montserrat"'),
                    document.fonts.load('600 16px "Montserrat"'),
                    document.fonts.load('700 16px "Montserrat"')
                ]).catch(() => { /* ignore font loading errors */ })
            }

            const images = element.querySelectorAll('img')
            await Promise.all(
                Array.from(images).map((img) => {
                    if (img.complete) return Promise.resolve()

                    return new Promise((resolve) => {
                        img.onload = () => resolve(null)
                        img.onerror = () => resolve(null)
                    })
                })
            )

            await new Promise((resolve) => setTimeout(resolve, 800))

            const fontCssText = await fontCssTextPromise

            const blob = await domToBlob(element, {
                scale: 3,
                quality: 1,
                type: 'image/png',
                font: {
                    cssText: fontCssText,
                    preferredFormat: 'woff2',
                },
                features: {
                    removeControlCharacter: false,
                },
                fetch: {
                    requestInit: {
                        mode: 'cors',
                        cache: 'force-cache'
                    }
                },
                debug: false,
            })

            return blob
        } catch (error) {
            console.error('Error capturing stamp:', error)
            return null
        } finally {
            element.style.visibility = originalVisibility
            element.style.opacity = originalOpacity
            element.style.position = originalPosition
            element.style.left = originalLeft
            element.style.top = originalTop
            element.style.zIndex = originalZIndex
            setIsCapturing(false)
        }
    }, [captureLayout])

    const handleShare = useCallback(async () => {
        if (shareSurface) {
            trackShareInitiated({
                memoryId,
                surface: shareSurface,
            })
        }

        setIsSharePopupOpen(true)
        const blob = await captureStampAsImage()

        if (blob) {
            setCapturedBlob(blob)

            try {
                if (navigator.clipboard && navigator.clipboard.write) {
                    await navigator.clipboard.write([
                        new ClipboardItem({
                            'image/png': blob
                        })
                    ])

                    if (shareSurface) {
                        trackShareClipboardResult({
                            memoryId,
                            surface: shareSurface,
                            success: true,
                        })
                    }
                }
            } catch (error) {
                console.error('Failed to copy image to clipboard:', error)

                if (shareSurface) {
                    trackShareClipboardResult({
                        memoryId,
                        surface: shareSurface,
                        success: false,
                        errorMessage: error instanceof Error ? error.message : 'Clipboard copy failed',
                    })
                }
            }
        }

    }, [captureStampAsImage, memoryId, shareSurface])

    const handleSharePopupClose = useCallback(() => {
        setIsSharePopupOpen(false)
    }, [])

    return {
        capturedBlob,
        handleShare,
        handleSharePopupClose,
        hiddenHorizontalRef,
        hiddenVerticalRef,
        isCapturing,
        isSharePopupOpen,
        captureStampAsImage,
    }
}
