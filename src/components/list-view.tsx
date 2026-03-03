import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import StampPreview from './stamp-preview'
import { Dialog, DialogContent } from './ui/dialog'
import { ScrollArea } from './ui/scroll-area'
import { Button } from './ui/button'
import { Share2 } from 'lucide-react'
import CopySharePopup from './copy-share-popup'
import { domToBlob } from 'modern-screenshot'
import type { CanvasItem } from './infinite-canvas'

interface ListViewProps {
    items: CanvasItem[]
    onImageClick?: (item: CanvasItem) => void
}

const ListViewComponent: React.FC<ListViewProps> = ({ items, onImageClick }) => {
    const [selectedItem, setSelectedItem] = useState<CanvasItem | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isSharePopupOpen, setIsSharePopupOpen] = useState(false)
    const [isCapturing, setIsCapturing] = useState(false)
    const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
    const isMobile = useIsMobile()
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const isScrollingRef = useRef(false)
    const desktopStampRef = useRef<HTMLDivElement>(null)
    const mobileStampRef = useRef<HTMLDivElement>(null)
    const hiddenHorizontalRef = useRef<HTMLDivElement>(null)
    const hiddenVerticalRef = useRef<HTMLDivElement>(null)
    const selectionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

    const handleModalClose = () => {
        setIsModalOpen(false)
    }

    // Capture stamp as image for sharing
    const captureStampAsImage = async (item: CanvasItem): Promise<Blob | null> => {
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
            element.style.zIndex = '9999'

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

            // Extra wait for rendering and layout
            await new Promise(resolve => setTimeout(resolve, 800))

            // Capture the horizontal stamp preview element as a blob
            const blob = await domToBlob(element, {
                scale: 3, // Higher quality (3x resolution for better text)
                quality: 1, // Maximum quality
                type: 'image/png',
                features: {
                    // Ensure text is captured properly
                    removeControlCharacter: false,
                },
                fetch: {
                    // Use CORS for loading external resources
                    requestInit: {
                        mode: 'cors',
                        cache: 'force-cache'
                    }
                },
                // Debug options - set to true to see what's being captured
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
        if (!selectedItem) return
        const blob = await captureStampAsImage(selectedItem)
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

    const getTweetText = () => {
        if (!selectedItem) return ''
        return `Check out this memory "${selectedItem.title || 'Memory'}" preserved forever! 🌟\n\nView it at: ${window.location.origin}/#/view/${selectedItem.id.slice(0, 43)}\n\n(paste the copied image here and remove this text)`
    }

    // Function to get the index of current item
    const getCurrentIndex = () => {
        if (!selectedItem) return -1
        return items.findIndex(item => item.id === selectedItem.id)
    }

    const currentIndex = getCurrentIndex()

    // Create infinite list by repeating items multiple times (5 copies for smooth infinite scrolling)
    const infiniteItems = items.length > 0 ? [
        ...items,
        // ...items,
        // ...items,
        // ...items,
        // ...items
    ] : []

    // Handle scroll to create infinite loop effect and update selected item
    const handleScroll = useCallback((event: any) => {
        if (items.length === 0) return

        const scrollElement = event.target
        const scrollTop = scrollElement.scrollTop
        const scrollHeight = scrollElement.scrollHeight
        const clientHeight = scrollElement.clientHeight

        // Calculate the height of one complete set of items
        const singleSetHeight = scrollHeight / 5 // We have 5 copies

        // // Handle infinite scroll jumps (don't let isScrollingRef block this)
        // // If scrolled near the top (first copy), jump to the middle copy
        // if (scrollTop < singleSetHeight * 0.05 && !isScrollingRef.current) {
        //     isScrollingRef.current = true
        //     scrollElement.scrollTop = scrollTop + singleSetHeight * 2
        //     setTimeout(() => { isScrollingRef.current = false }, 100)
        //     return
        // }
        // // If scrolled near the bottom (last copy), jump to the middle copy
        // else if (scrollTop > singleSetHeight * 4.95 && !isScrollingRef.current) {
        //     isScrollingRef.current = true
        //     scrollElement.scrollTop = scrollTop - singleSetHeight * 2
        //     setTimeout(() => { isScrollingRef.current = false }, 100)
        //     return
        // }

        // Debounce the selection update to avoid jittery scrolling
        if (selectionUpdateTimeoutRef.current) {
            clearTimeout(selectionUpdateTimeoutRef.current)
        }

        selectionUpdateTimeoutRef.current = setTimeout(() => {
            // Update selected item based on scroll position
            const itemElements = scrollElement.querySelectorAll('button')
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
                    // Map back to original items array (handle infinite copies)
                    const originalIndex = closestItem % items.length
                    const newSelectedItem = items[originalIndex]

                    // Only update if it's a different item
                    setSelectedItem(prevSelected => {
                        if (!prevSelected || newSelectedItem.id !== prevSelected.id) {
                            return newSelectedItem
                        }
                        return prevSelected
                    })
                }
            }
        }, 10) // Reduced debounce for faster selection updates
    }, [items.length])

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (selectionUpdateTimeoutRef.current) {
                clearTimeout(selectionUpdateTimeoutRef.current)
            }
        }
    }, [])

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

            // Start in the middle set of items (wait for content to render)
            if (items.length > 0) {
                setTimeout(() => {
                    const singleSetHeight = scrollArea.scrollHeight / 5
                    if (singleSetHeight > 0) {
                        scrollArea.scrollTop = singleSetHeight * 2
                    }
                }, 100)
            }

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

    console.log('selectedItem', selectedItem);

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
                    <div className="p-4 pt-20 pb-35 md:pt-70 md:pb-130 md:px-16 tracking-[5px]" style={{ scrollBehavior: 'auto' }}>
                        {infiniteItems.map((item, index) => {
                            const isSelected = selectedItem?.id === item.id
                            const originalIndex = index % items.length
                            const headline = item.title || `Memory ${originalIndex + 1}`
                            const location = item.metadata?.location || 'Unknown location'
                            const date = item.metadata?.date
                                ? new Date(item.metadata.date).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                })
                                : 'Unknown date'

                            return (
                                <button
                                    key={`${item.id}-${index}`}
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
                    </div>
                    {isMobile && <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none" />}
                </ScrollArea>

                <div className="w-full z-50 relative flex items-start justify-center pb-30">
                    {selectedItem && <StampPreview
                        className='w-[90%] md:w-auto md:h-[80vh]'
                        // className={cn("", isMobile ? 'scale-40 -translate-y-1/4' : "scale-90 -translate-y-10")}
                        headline={selectedItem.title || 'Untitled Memory'}
                        location={selectedItem.metadata?.location || 'Unknown location'}
                        handle="@memories"
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
                                    handle="@memories"
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

            {/* Hidden versions for capturing */}
            {selectedItem && (
                <>
                    <div
                        ref={hiddenHorizontalRef}
                        className="absolute left-0 top-0 opacity-0 pointer-events-none"
                        style={{ visibility: 'hidden' }}
                    >
                        <StampPreview
                            headline={selectedItem.title || 'Untitled Memory'}
                            location={selectedItem.metadata?.location?.toUpperCase() || 'UNKNOWN LOCATION'}
                            handle="@memories"
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
                            layout="horizontal"
                        />
                    </div>
                    <div
                        ref={hiddenVerticalRef}
                        className="absolute left-0 top-0 opacity-0 pointer-events-none"
                        style={{ visibility: 'hidden' }}
                    >
                        <StampPreview
                            headline={selectedItem.title || 'Untitled Memory'}
                            location={selectedItem.metadata?.location?.toUpperCase() || 'UNKNOWN LOCATION'}
                            handle="@memories"
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
                            layout="vertical"
                        />
                    </div>
                </>
            )}

            <Button
                onClick={handleShare}
                disabled={isCapturing}
                size="lg"
                className="absolute h-12 bottom-10.5 z-50 left-7 bg-[#000DFF] hover:bg-[#000DFF]/90 text-white border border-[#2C2C2C] px-6 py-3 text-base font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-lg"
            >
                <Share2 className="w-4 h-4" />
                {isCapturing ? 'Capturing...' : 'Share'}
            </Button>

            {/* Copy & Share Popup */}
            <CopySharePopup
                shareUrl={`${window.location.origin}/#/view/${selectedItem?.id.split("-tile")[0]}`}
                isOpen={isSharePopupOpen}
                onClose={handleSharePopupClose}
                polaroidBlob={capturedBlob}
                tweetText={getTweetText()}
                onTwitterOpen={handleSharePopupClose}
            />
        </div>
    )
}

export default ListViewComponent

