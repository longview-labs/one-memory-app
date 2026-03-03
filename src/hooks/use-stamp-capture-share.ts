import { useCallback, useRef, useState } from 'react'
import { domToBlob } from 'modern-screenshot'

type StampLayout = 'horizontal' | 'vertical'

interface UseStampCaptureShareOptions {
    captureLayout: StampLayout
}

export const useStampCaptureShare = ({ captureLayout }: UseStampCaptureShareOptions) => {
    const [isSharePopupOpen, setIsSharePopupOpen] = useState(false)
    const [isCapturing, setIsCapturing] = useState(false)
    const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
    const hiddenHorizontalRef = useRef<HTMLDivElement>(null)
    const hiddenVerticalRef = useRef<HTMLDivElement>(null)

    const captureStampAsImage = useCallback(async (): Promise<Blob | null> => {
        const elementRef = captureLayout === 'vertical' ? hiddenVerticalRef : hiddenHorizontalRef
        if (!elementRef.current) return null

        try {
            setIsCapturing(true)

            const element = elementRef.current
            const originalVisibility = element.style.visibility
            const originalOpacity = element.style.opacity
            const originalPosition = element.style.position
            const originalLeft = element.style.left
            const originalTop = element.style.top
            const originalZIndex = element.style.zIndex

            element.style.visibility = 'visible'
            element.style.opacity = '1'
            element.style.position = 'absolute'
            element.style.left = '0'
            element.style.top = '0'
            element.style.zIndex = '9999'

            if ('fonts' in document && document.fonts) {
                await document.fonts.ready

                await Promise.all([
                    document.fonts.load('400 16px "Instrument Serif"'),
                    document.fonts.load('300 16px "Montserrat"'),
                    document.fonts.load('400 16px "Montserrat"'),
                    document.fonts.load('500 16px "Montserrat"')
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

            const blob = await domToBlob(element, {
                scale: 3,
                quality: 1,
                type: 'image/png',
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

            element.style.visibility = originalVisibility
            element.style.opacity = originalOpacity
            element.style.position = originalPosition
            element.style.left = originalLeft
            element.style.top = originalTop
            element.style.zIndex = originalZIndex

            return blob
        } catch (error) {
            console.error('Error capturing stamp:', error)
            return null
        } finally {
            setIsCapturing(false)
        }
    }, [captureLayout])

    const handleShare = useCallback(async () => {
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
                }
            } catch (error) {
                console.error('Failed to copy image to clipboard:', error)
            }
        }

    }, [captureStampAsImage])

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
