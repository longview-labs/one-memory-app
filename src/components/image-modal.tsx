import React, { useState, useEffect } from 'react'
import { X, Share2, Check } from 'lucide-react'
import { Button } from './ui/button'
import { useIsMobile } from '../hooks/use-mobile'
import type { CanvasItem } from './infinite-canvas'
import StampPreview from './stamp-preview'
import CopySharePopup from './copy-share-popup'
import StampCaptureRenderer from './stamp-capture-renderer'
import { useStampCaptureShare } from '../hooks/use-stamp-capture-share'
import { getMemoryShareUrl, getMemoryTweetText } from '../utils/share'
import postcardV from '@/assets/postcard-v.svg'
import postcardH from '@/assets/postcard-h.svg'
import { cn } from '@/lib/utils'

interface ImageModalProps {
    item: CanvasItem | null
    isOpen: boolean
    onClose: () => void
}

const ImageModal: React.FC<ImageModalProps> = ({ item, isOpen, onClose }) => {
    const isMobile = useIsMobile()
    const [isAnimating, setIsAnimating] = useState(false)
    const [shouldRender, setShouldRender] = useState(false)
    const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('vertical')
    const {
        capturedBlob,
        handleShare,
        handleSharePopupClose,
        hiddenHorizontalRef,
        hiddenVerticalRef,
        isCapturing,
        isSharePopupOpen,
    } = useStampCaptureShare({
        captureLayout: orientation,
        memoryId: item?.id,
        shareSurface: 'image_modal',
    })

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

    useEffect(() => {
        if (isMobile) {
            setOrientation('vertical')
        }
    }, [isMobile])

    const getShareUrl = () => {
        if (!item) return ''
        return getMemoryShareUrl(item.arweaveTransactionId || item.id)
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
        description: item.metadata?.description || '',
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
                className={`absolute z-10 top-10 right-10 bg-black/60 opacity-50! hover:bg-black/80 text-white border-white/20 rounded-full w-12 h-12 p-0 transition-all duration-300 ${isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                    }`}
            >
                <X className="w-10! h-10!" />
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
                    handle={item.handle}
                    handlePlatform={item.handlePlatform}
                    description={details.description}
                    date={details.date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    }).toUpperCase()}
                    imageSrc={item.imageUrl}
                    layout={orientation}
                    className={cn(
                        'w-[85vw] sm:w-auto',
                        orientation === 'vertical' ? 'sm:h-[75vh]' : 'sm:w-[75vw] sm:max-w-[950px]'
                    )}
                />
            </div>

            {/* Share button */}
            <div className="flex gap-10">
                <Button
                    onClick={handleShare}
                    disabled={isCapturing}
                    size='lg'
                    className={`h-12 bottom-6 left-6 bg-[#000DFF] hover:bg-[#000DFF]/90 text-white border border-[#2C2C2C] px-6 py-3 text-base font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all duration-300 shadow-lg ${isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                        }`}
                >
                    <Share2 className="w-4 h-4" />
                    {isCapturing ? 'Preparing...' : 'Share'}
                </Button>
                <div
                    className={`flex items-center justify-center gap-2 transition-all duration-300 ${isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
                >
                    <Button
                        variant='ghost'
                        className={cn('w-7! rounded-none h-12 p-0', orientation === 'vertical' ? '' : 'opacity-50')}
                        style={{
                            backgroundImage: `url(${postcardV})`,
                            backgroundSize: 'contain',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                        }}
                        onClick={() => setOrientation('vertical')}
                    >
                        {orientation === 'vertical' && <Check className='w-4 h-4' color='black' />}
                    </Button>
                    <Button
                        variant='ghost'
                        className={cn('w-10 rounded-none h-7 p-0', orientation === 'horizontal' ? '' : 'opacity-50')}
                        style={{
                            backgroundImage: `url(${postcardH})`,
                            backgroundSize: 'contain',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                        }}
                        onClick={() => setOrientation('horizontal')}
                    >
                        {orientation === 'horizontal' && <Check className='w-4 h-4' color='black' />}
                    </Button>
                </div>
            </div>

            <StampCaptureRenderer
                hiddenHorizontalRef={hiddenHorizontalRef}
                hiddenVerticalRef={hiddenVerticalRef}
                isCapturing={isCapturing}
                className={orientation === 'vertical' ? 'h-[900px]' : 'w-[900px]'}
                headline={item.title || 'Memory'}
                location={details.location?.toUpperCase() || 'UNKNOWN LOCATION'}
                handle={item.handle}
                handlePlatform={item.handlePlatform}
                description={details.description}
                date={details.date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                }).toUpperCase()}
                imageSrc={item.imageUrl}
            />

            {/* Copy & Share Popup */}
            <CopySharePopup
                isOpen={isSharePopupOpen}
                onClose={handleSharePopupClose}
                isCapturing={isCapturing}
                polaroidBlob={capturedBlob}
                tweetText={getTweetText()}
                shareUrl={getShareUrl()}
                onTwitterOpen={handleSharePopupClose}
                memoryId={item.id}
                shareSurface='image_modal'
            />
        </div>
    )
}

export default ImageModal
