import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import StampPreview from './stamp-preview'
import { Dialog, DialogContent } from './ui/dialog'
import { ScrollArea } from './ui/scroll-area'
import { Button } from './ui/button'
import { Share2 } from 'lucide-react'
import CopySharePopup from './copy-share-popup'
import type { CanvasItem } from './infinite-canvas'
import StampCaptureRenderer from './stamp-capture-renderer'
import { useStampCaptureShare } from '@/hooks/use-stamp-capture-share'
import { getMemoryShareUrl, getMemoryTweetText } from '@/utils/share'

interface ListViewProps {
    items: CanvasItem[]
    onImageClick?: (item: CanvasItem) => void
    onLoadMore?: () => void | Promise<void>
    hasMore?: boolean
    isLoadingMore?: boolean
}

const ListViewComponent: React.FC<ListViewProps> = ({
    items,
    onImageClick,
    onLoadMore,
    hasMore = false,
    isLoadingMore = false,
}) => {
    const [selectedItem, setSelectedItem] = useState<CanvasItem | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const isMobile = useIsMobile()
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const mobileStampRef = useRef<HTMLDivElement>(null)
    const selectionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const loadMoreLockRef = useRef(false)
    const {
        capturedBlob,
        handleShare,
        handleSharePopupClose,
        hiddenHorizontalRef,
        hiddenVerticalRef,
        isCapturing,
        isSharePopupOpen,
    } = useStampCaptureShare({
        captureLayout: isMobile ? 'horizontal' : 'vertical',
        memoryId: selectedItem?.id,
        shareSurface: 'list_view',
    })

    // Auto-select first item on desktop
    useEffect(() => {
        if (!isMobile && items.length > 0 && !selectedItem) {
            setSelectedItem(items[0])
        }
    }, [items, isMobile, selectedItem])

    const handleItemClick = (item: CanvasItem) => {
        setSelectedItem(item)
        // On mobile, directly trigger the preview if onImageClick is provided
        if (isMobile && onImageClick) {
            onImageClick(item)
        } else if (isMobile) {
            // Fallback: open modal if no onImageClick handler
            // setIsModalOpen(true)
        }
    }

    const handleStampPreviewClick = () => {
        // When clicking the stamp preview, use the onImageClick if provided, or open modal
        if (selectedItem) {
            if (onImageClick) {
                onImageClick(selectedItem)
            } else {
                // setIsModalOpen(true)
            }
        }
    }

    const handleShareClick = async () => {
        if (!selectedItem) return
        await handleShare()
    }

    const getTweetText = () => {
        if (!selectedItem) return ''
        return getMemoryTweetText(selectedItem.title || 'Memory', getMemoryShareUrl(selectedItem.id))
    }

    // Handle scroll for item selection and pagination
    const handleScroll = useCallback((event: any) => {
        if (items.length === 0) return

        const scrollElement = event.target as HTMLElement
        const scrollTop = scrollElement.scrollTop
        const scrollHeight = scrollElement.scrollHeight
        const clientHeight = scrollElement.clientHeight

        const distanceFromBottom = scrollHeight - (scrollTop + clientHeight)
        const isNearBottom = distanceFromBottom < 320

        if (!isNearBottom) {
            loadMoreLockRef.current = false
        }

        if (isNearBottom && hasMore && !isLoadingMore && onLoadMore && !loadMoreLockRef.current) {
            loadMoreLockRef.current = true
            void onLoadMore()
        }

        // Debounce the selection update to avoid jittery scrolling
        if (selectionUpdateTimeoutRef.current) {
            clearTimeout(selectionUpdateTimeoutRef.current)
        }

        selectionUpdateTimeoutRef.current = setTimeout(() => {
            // Update selected item based on scroll position
            const itemElements = scrollElement.querySelectorAll('button[data-list-item="true"]')
            if (itemElements.length > 0) {
                // Use the top third of the viewport as the "focus" area
                const focusPoint = scrollTop + (clientHeight * 0.3)

                // Find the item that's closest to the focus point
                let closestItem = null
                let closestDistance = Infinity

                itemElements.forEach((element: HTMLElement, index: number) => {
                    const elementTop = element.offsetTop
                    const elementCenter = elementTop + (element.offsetHeight / 2)
                    const distance = Math.abs(elementCenter - focusPoint)

                    if (distance < closestDistance) {
                        closestDistance = distance
                        closestItem = index
                    }
                })

                if (closestItem !== null) {
                    const focusedElement = itemElements[closestItem] as HTMLElement
                    const originalIndex = Number(focusedElement.dataset.itemIndex)
                    const newSelectedItem = items[originalIndex]
                    if (!newSelectedItem) return

                    // Only update if it's a different item
                    setSelectedItem(prevSelected => {
                        if (!prevSelected || newSelectedItem.id !== prevSelected.id) {
                            return newSelectedItem
                        }
                        return prevSelected
                    })
                }
            }
        }, 3) // Reduced debounce for faster selection updates
    }, [items, hasMore, isLoadingMore, onLoadMore])

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (selectionUpdateTimeoutRef.current) {
                clearTimeout(selectionUpdateTimeoutRef.current)
            }
        }
    }, [])

    useEffect(() => {
        if (!isLoadingMore) {
            loadMoreLockRef.current = false
        }
    }, [isLoadingMore])

    // Set up scroll listener
    useEffect(() => {
        const scrollArea = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
        if (scrollArea) {
            // Forcefully disable smooth scrolling on the viewport element
            const element = scrollArea as HTMLElement
            element.style.setProperty('scroll-behavior', 'auto', 'important')

            // Hide scrollbars completely
            element.style.setProperty('scrollbar-width', 'none', 'important') // Firefox
            element.style.setProperty('-ms-overflow-style', 'none', 'important') // IE/Edge
            element.style.setProperty('overflow-y', 'scroll', 'important') // Keep scroll functionality

            // Hide webkit scrollbar
            const style = document.createElement('style')
            style.textContent = `
                [data-radix-scroll-area-viewport]::-webkit-scrollbar {
                    display: none !important;
                    width: 0 !important;
                    height: 0 !important;
                }
            `
            document.head.appendChild(style)

            scrollArea.addEventListener('scroll', handleScroll)

            return () => {
                scrollArea.removeEventListener('scroll', handleScroll)
                // Clean up the injected style
                if (style.parentNode) {
                    document.head.removeChild(style)
                }
            }
        }
    }, [handleScroll, items.length])

    // Global wheel event to scroll the list from anywhere on the screen
    useEffect(() => {
        const scrollArea = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
        if (!scrollArea) return

        const handleWheel = (e: WheelEvent) => {
            // Prevent default scroll behavior
            e.preventDefault()

            // Scroll the list area
            const element = scrollArea as HTMLElement
            element.scrollTop += e.deltaY
        }

        // Add wheel listener to the window
        window.addEventListener('wheel', handleWheel, { passive: false })

        return () => {
            window.removeEventListener('wheel', handleWheel)
        }
    }, [items.length])

    if (items.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-white/60">
                No memories to display
            </div>
        )
    }

    return (
        <div className='relative h-full w-screen overflow-clip'>
            {/* Top blur fade */}
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black to-transparent z-10 pointer-events-none" />
            <div className={cn('h-full items-center justify-center', isMobile ? "flex flex-col" : "grid grid-cols-2")}>
                <ScrollArea
                    className={cn("flex-1 md:h-full grow overflow-y-scroll overflow-x-clip max-w-screen p-0 [&_[data-radix-scroll-area-scrollbar]]:hidden [&_[data-radix-scroll-area-viewport]]:scrollbar-none [&_[data-radix-scroll-area-viewport]]:[-ms-overflow-style:none] [&_[data-radix-scroll-area-viewport]]:[-webkit-overflow-scrolling:touch]",
                        isMobile ? "" : ""
                    )}
                    ref={scrollAreaRef}
                    style={{ scrollBehavior: 'auto' }}
                    scrollHideDelay={0}
                >
                    <div className="p-4 pt-20 pb-35 md:pt-70 md:pb-130 tracking-[5px]" style={{ scrollBehavior: 'auto' }}>
                        {items.map((item, index) => {
                            const isSelected = selectedItem?.id === item.id
                            const headline = item.title || `Memory ${index + 1}`

                            return (
                                <button
                                    key={item.id}
                                    data-list-item="true"
                                    data-item-index={index}
                                    onClick={() => handleItemClick(item)}
                                    className={cn(
                                        "w-full text-left p-4 transition-all duration-200",
                                        "hover:bg-white/5 active:bg-white/10"
                                    )}
                                >
                                    <div className="flex items-start gap-4">

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 max-w-screen">
                                            <h3 className={cn(
                                                isMobile ? "text-4xl" : "text-6xl",
                                                "font-medium font-instrument truncate mb-1 transition-colors duration-200",
                                                isSelected ? "text-white" : "text-white/40"
                                            )}>
                                                {headline}
                                            </h3>
                                        </div>

                                        {/* Selection indicator */}
                                        {/* {isSelected && (
                                                <div className="flex-shrink-0">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                </div>
                                            )} */}
                                    </div>
                                </button>
                            )
                        })}
                        <div className="px-4 py-6 text-white/50">
                            {isLoadingMore
                                ? 'Loading more memories...'
                                : hasMore
                                    ? 'Scroll for more'
                                    : 'You\'ve reached the end'}
                        </div>
                    </div>
                    {isMobile && <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none" />}
                </ScrollArea>

                <div className="w-full z-50 relative flex items-start justify-center pb-30">
                    {selectedItem && <StampPreview
                        className='w-[90%] md:w-auto md:h-[75vh]'
                        // className={cn("", isMobile ? 'scale-40 -translate-y-1/4' : "scale-90 -translate-y-10")}
                        headline={selectedItem.title || 'Untitled Memory'}
                        location={selectedItem.metadata?.location || 'Unknown location'}
                        handle={selectedItem.handle}
                        description={selectedItem.metadata?.description}
                        date={selectedItem.metadata?.date
                            ? new Date(selectedItem.metadata.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                            })
                            : new Date().toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                            })
                        }
                        imageSrc={selectedItem.imageUrl}
                        layout={isMobile ? "horizontal" : "vertical"}
                    />}
                </div>
            </div>

            {/* Bottom blur fade */}
            {!isMobile && <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none" />}

            {/* Preview Section */}
            {/* {selectedItem && (
                    <div className="flex-1 flex items-center justify-center p-8 relative">
                        <div
                            className="max-w-2xl w-full cursor-pointer transition-transform hover:scale-[1.02]"
                            ref={desktopStampRef}
                            onClick={handleStampPreviewClick}
                        >
                           
                        </div> */}

            {/* Share button - Desktop */}
            {/*  */}
            {/* </div> */}
            {/* )} */}

            {/* Mobile Preview Modal */}
            {isMobile && selectedItem && (
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="max-w-[95vw] max-h-[90vh] bg-black border-white/20 p-6">
                        <div className="flex flex-col items-center">
                            <div
                                ref={mobileStampRef}
                                className="cursor-pointer"
                                onClick={handleStampPreviewClick}
                            >
                                <StampPreview
                                    headline={selectedItem.title || 'Untitled Memory'}
                                    location={selectedItem.metadata?.location || 'Unknown location'}
                                    handle={selectedItem.handle}
                                    description={selectedItem.metadata?.description}
                                    date={selectedItem.metadata?.date
                                        ? new Date(selectedItem.metadata.date).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })
                                        : new Date().toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })
                                    }
                                    imageSrc={selectedItem.imageUrl}
                                    layout="vertical"
                                    className="w-full"
                                />
                            </div>

                            {/* Share button - Mobile */}
                            {/* <Button
                                onClick={handleShare}
                                disabled={isCapturing}
                                size="lg"
                                className="w-full h-12 mt-4 bg-[#000DFF] hover:bg-[#000DFF]/90 text-white border border-[#2C2C2C] px-6 py-3 text-base font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-lg"
                            >
                                <Share2 className="w-4 h-4" />
                                {isCapturing ? 'Capturing...' : 'Share'}
                            </Button> */}
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {selectedItem && (
                <StampCaptureRenderer
                    hiddenHorizontalRef={hiddenHorizontalRef}
                    hiddenVerticalRef={hiddenVerticalRef}
                    isCapturing={isCapturing}
                    headline={selectedItem.title || 'Untitled Memory'}
                    location={selectedItem.metadata?.location?.toUpperCase() || 'UNKNOWN LOCATION'}
                    handle={selectedItem.handle}
                    description={selectedItem.metadata?.description}
                    date={selectedItem.metadata?.date
                        ? new Date(selectedItem.metadata.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        }).toUpperCase()
                        : new Date().toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        }).toUpperCase()
                    }
                    imageSrc={selectedItem.imageUrl}
                />
            )}

            <Button
                onClick={handleShareClick}
                disabled={isCapturing}
                size="lg"
                className="absolute h-12 bottom-10.5 z-50 left-7 bg-[#000DFF] hover:bg-[#000DFF]/90 text-white border border-[#2C2C2C] px-6 py-3 text-base font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-lg"
            >
                <Share2 className="w-4 h-4" />
                {isCapturing ? 'Preparing...' : 'Share'}
            </Button>

            {/* Copy & Share Popup */}
            <CopySharePopup
                shareUrl={selectedItem ? getMemoryShareUrl(selectedItem.id) : ''}
                isOpen={isSharePopupOpen}
                onClose={handleSharePopupClose}
                isCapturing={isCapturing}
                polaroidBlob={capturedBlob}
                tweetText={getTweetText()}
                onTwitterOpen={handleSharePopupClose}
                memoryId={selectedItem?.id}
                shareSurface='list_view'
            />
        </div>
    )
}

export default ListViewComponent

