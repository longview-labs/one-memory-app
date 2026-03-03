import React, { useState, useEffect } from 'react'
import { X, Share2 } from 'lucide-react'
import { Button } from './ui/button'
import { useIsMobile } from '../hooks/use-mobile'
import type { CanvasItem } from './infinite-canvas'
import StampPreview from './stamp-preview'
import CopySharePopup from './copy-share-popup'
import StampCaptureRenderer from './stamp-capture-renderer'
import { useStampCaptureShare } from '../hooks/use-stamp-capture-share'
import { getMemoryShareUrl, getMemoryTweetText } from '../utils/share'

interface ImageModalProps {
    item: CanvasItem | null
    isOpen: boolean
    onClose: () => void
}

const ImageModal: React.FC<ImageModalProps> = ({ item, isOpen, onClose }) => {
    const isMobile = useIsMobile()
    const [isAnimating, setIsAnimating] = useState(false)
    const [shouldRender, setShouldRender] = useState(false)
    const {
        capturedBlob,
        handleShare,
        handleSharePopupClose,
        hiddenHorizontalRef,
        hiddenVerticalRef,
        isCapturing,
        isSharePopupOpen,
    } = useStampCaptureShare({ captureLayout: 'horizontal' })

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

    const getShareUrl = () => {
        if (!item) return ''
        return getMemoryShareUrl(item.id)
    }

    const getTweetText = () => {
        if (!item) return ''
        return getMemoryTweetText(item.title || 'Memory', getShareUrl())
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
                    className='w-[85vw] md:w-auto md:h-[80vh]'
                />
            </div>

            <StampCaptureRenderer
                hiddenHorizontalRef={hiddenHorizontalRef}
                hiddenVerticalRef={hiddenVerticalRef}
                isCapturing={isCapturing}
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
            />

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
                isCapturing={isCapturing}
                polaroidBlob={capturedBlob}
                tweetText={getTweetText()}
                shareUrl={getShareUrl()}
                onTwitterOpen={handleSharePopupClose}
            />
        </div>
    )
}

export default ImageModal
