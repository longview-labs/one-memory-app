import React, { useState, useEffect, useRef } from 'react'
import { X, Share2 } from 'lucide-react'
import { Button } from './ui/button'
import { useIsMobile } from '../hooks/use-mobile'
import type { CanvasItem } from './infinite-canvas'
import StampPreview from './stamp-preview'
import CopySharePopup from './copy-share-popup'
import { domToBlob } from 'modern-screenshot'

interface ImageModalProps {
    item: CanvasItem | null
    isOpen: boolean
    onClose: () => void
}

const ImageModal: React.FC<ImageModalProps> = ({ item, isOpen, onClose }) => {
    const isMobile = useIsMobile()
    const [isAnimating, setIsAnimating] = useState(false)
    const [shouldRender, setShouldRender] = useState(false)
    const [isSharePopupOpen, setIsSharePopupOpen] = useState(false)
    const [isCapturing, setIsCapturing] = useState(false)
    const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
    const hiddenHorizontalRef = useRef<HTMLDivElement>(null)
    const hiddenVerticalRef = useRef<HTMLDivElement>(null)

    // Handle animation states
    useEffect(() => {
        if (isOpen && item) {
            // Reset animation state first when switching items
            setIsAnimating(false)
            setShouldRender(true)

            // Small delay to trigger animation
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsAnimating(true)
                })
            })
        } else {
            setIsAnimating(false)
            // Wait for animation to complete before unmounting
            const timer = setTimeout(() => {
                setShouldRender(false)
            }, 300) // Match transition duration
            return () => clearTimeout(timer)
        }
    }, [isOpen, item?.id])

    // Handle ESC key press to close modal
    useEffect(() => {
        const handleEscKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose()
            }
        }

        if (isOpen) {
            window.addEventListener('keydown', handleEscKey)
        }

        return () => {
            window.removeEventListener('keydown', handleEscKey)
        }
    }, [isOpen, onClose])

    const captureStampAsImage = async (): Promise<Blob | null> => {
        // Capture vertical on mobile, horizontal on desktop
        const elementRef = isMobile ? hiddenVerticalRef : hiddenHorizontalRef
        if (!elementRef.current) return null

        try {
            setIsCapturing(true)

            // Temporarily make the selected version visible
            const element = elementRef.current
            const originalVisibility = element.style.visibility
            const originalOpacity = element.style.opacity

            element.style.visibility = 'visible'
            element.style.opacity = '1'
            element.style.position = 'absolute'
            element.style.left = '0'
            element.style.top = '0'

            // Wait for fonts to load
            await document.fonts.ready

            // Force font loading by checking specific fonts
            await Promise.all([
                document.fonts.load('400 16px "Instrument Serif"'),
                document.fonts.load('300 16px "Montserrat"'),
                document.fonts.load('400 16px "Montserrat"'),
                document.fonts.load('500 16px "Montserrat"')
            ]).catch(() => {/* ignore font loading errors */ })

            // Ensure all images within the element are loaded
            const images = element.querySelectorAll('img')
            await Promise.all(
                Array.from(images).map(img => {
                    if (img.complete) return Promise.resolve()
                    return new Promise((resolve) => {
                        img.onload = () => resolve(null)
                        img.onerror = () => resolve(null)
                    })
                })
            )

            // Extra wait for rendering and layout (longer for mobile)
            await new Promise(resolve => setTimeout(resolve, 800))

            // Capture with optimized settings
            const blob = await domToBlob(element, {
                scale: 3, // Higher quality (3x resolution for better text)
                quality: 1, // Maximum quality
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

            // Hide it again
            element.style.visibility = originalVisibility
            element.style.opacity = originalOpacity
            element.style.zIndex = ''

            return blob
        } catch (error) {
            console.error('Error capturing stamp:', error)
            // Make sure to hide it even if there's an error
            const elementRef = isMobile ? hiddenVerticalRef : hiddenHorizontalRef
            if (elementRef.current) {
                const element = elementRef.current
                element.style.visibility = 'hidden'
                element.style.opacity = '0'
                element.style.zIndex = ''
            }
            return null
        } finally {
            setIsCapturing(false)
        }
    }

    const handleShare = async () => {
        const blob = await captureStampAsImage()
        if (blob) {
            setCapturedBlob(blob)
            // Copy image to clipboard immediately
            try {
                if (navigator.clipboard && navigator.clipboard.write) {
                    await navigator.clipboard.write([
                        new ClipboardItem({
                            'image/png': blob
                        })
                    ])
                    console.log('Image copied to clipboard')
                }
            } catch (error) {
                console.error('Failed to copy image to clipboard:', error)
            }
        }
        setIsSharePopupOpen(true)
    }

    const handleSharePopupClose = () => {
        setIsSharePopupOpen(false)
    }

    const getShareUrl = () => {
        if (!item) return ''
        console.log(item.id.slice(0, 43))
        return `${window.location.origin}/#/view/${item.id.slice(0, 43)}`
    }

    const getTweetText = () => {
        if (!item) return ''
        return `Check out this memory "${item.title || 'Memory'}" preserved forever! 🌟\n\nView it at: ${getShareUrl()}\n\n(paste the copied image here and remove this text)`
    }

    if (!shouldRender || !item) return null

    // Use metadata from the item, with fallbacks
    const details = {
        date: item.metadata?.date || new Date(),
        location: item.metadata?.location || 'Unknown Location',
    }

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    return (
        <div
            className={`fixed inset-0 z-50 flex flex-col gap-10 items-center justify-center p-4 md:p-8 transition-all duration-300 ease-out ${isAnimating
                ? 'bg-black/90 backdrop-blur-md'
                : 'bg-black/0 backdrop-blur-none'
                }`}
            onClick={handleBackdropClick}
        >
            {/* Close button */}
            <Button
                variant="ghost"
                size="lg"
                onClick={onClose}
                className={`absolute z-10 top-10 right-10 bg-black/60 !opacity-50 hover:bg-black/80 text-white border-white/20 rounded-full w-12 h-12 p-0 transition-all duration-300 ${isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                    }`}
            >
                <X className="!w-10 !h-10" />
            </Button>

            {/* Stamp Preview - centered with animation */}
            <div
                className={`relative flex items-center justify-center transition-all duration-300 ease-out ${isMobile ? 'max-w-[90vw]' : ''}
                    ${isAnimating
                        ? 'opacity-100 scale-100 translate-y-0'
                        : 'opacity-0 scale-90 translate-y-4'
                    }`}
            >
                <StampPreview
                    headline={item.title || 'Memory'}
                    location={details.location?.toUpperCase() || 'UNKNOWN LOCATION'}
                    handle="@memories"
                    date={details.date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    }).toUpperCase()}
                    imageSrc={item.imageUrl}
                    layout="vertical"
                    className='h-[80vh] md:h-[80vh]'
                />
            </div>

            {/* Hidden versions for capturing */}
            <div
                ref={hiddenHorizontalRef}
                className="absolute left-0 top-0 opacity-0 pointer-events-none -z-1"
                style={{ visibility: 'hidden' }}
            >
                <StampPreview
                    className="h-[50vh]"
                    headline={item.title || 'Memory'}
                    location={details.location?.toUpperCase() || 'UNKNOWN LOCATION'}
                    handle="@memories"
                    date={details.date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    }).toUpperCase()}
                    imageSrc={item.imageUrl}
                    layout="horizontal"
                />
            </div>
            <div
                ref={hiddenVerticalRef}
                className="absolute left-0 top-0 opacity-0 pointer-events-none -z-1"
                style={{ visibility: 'hidden' }}
            >
                <StampPreview
                    className="h-[50vh]"
                    headline={item.title || 'Memory'}
                    location={details.location?.toUpperCase() || 'UNKNOWN LOCATION'}
                    handle="@memories"
                    date={details.date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    }).toUpperCase()}
                    imageSrc={item.imageUrl}
                    layout="vertical"
                />
            </div>

            {/* Share button */}
            <Button
                onClick={handleShare}
                disabled={isCapturing}
                size='lg'
                className={`h-12 bottom-6 left-6 bg-[#000DFF] hover:bg-[#000DFF]/90 text-white border border-[#2C2C2C] px-6 py-3 text-base font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all duration-300 shadow-lg ${isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                    }`}
            >
                <Share2 className="w-4 h-4" />
                {isCapturing ? 'Capturing...' : 'Share'}
            </Button>

            {/* Copy & Share Popup */}
            <CopySharePopup
                isOpen={isSharePopupOpen}
                onClose={handleSharePopupClose}
                polaroidBlob={capturedBlob}
                tweetText={getTweetText()}
                shareUrl={getShareUrl()}
                onTwitterOpen={handleSharePopupClose}
            />
        </div>
    )
}

export default ImageModal
