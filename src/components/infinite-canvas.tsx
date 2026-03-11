import React, { useRef, useState, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react'
import { useIsMobile } from '../hooks/use-mobile'
import StampPreview from './stamp-preview'
import postcardSquareBg from '@/assets/postcard-square.svg'
import type { HandlePlatform } from '@/utils/handle-links'

export interface CanvasItem {
    id: string
    x: number
    y: number
    width: number
    height: number
    imageUrl: string
    handle?: string
    handlePlatform?: HandlePlatform
    title?: string
    metadata?: {
        date?: Date
        location?: string
        camera?: string
        tags?: string[]
        description?: string
    }
    arweaveTransactionId?: string
}

interface InfiniteCanvasProps {
    items: CanvasItem[]
    itemSize?: number
    gap?: number
    isPending?: boolean
    onImageClick?: (item: CanvasItem) => void
}

export interface InfiniteCanvasRef {
    resetView: () => void
    resetDragState: () => void
    centerOnItem: (itemId: string) => void
}

// Memoized canvas item component to prevent unnecessary re-renders
const CanvasItemComponent = React.memo<{
    item: CanvasItem
    onMouseDown: (e: React.MouseEvent) => void
    onImageClick?: (item: CanvasItem) => void
}>(({ item, onMouseDown, onImageClick }) => {
    // Check if this is the upload button - do this FIRST
    const isUploadButton = item.id.startsWith('upload-button')

    const [imageLoaded, setImageLoaded] = React.useState(false)
    const [imageError, setImageError] = React.useState(false)
    const [dragStart, setDragStart] = React.useState<{ x: number; y: number } | null>(null)
    const [touchStart, setTouchStart] = React.useState<{ x: number; y: number } | null>(null)

    const handleMouseDown = (e: React.MouseEvent) => {
        // For upload button, don't track drag start - just let canvas handle panning
        if (isUploadButton) {
            onMouseDown(e)
            return
        }
        setDragStart({ x: e.clientX, y: e.clientY })
        onMouseDown(e)
    }

    const handleMouseUp = (e: React.MouseEvent) => {
        // For upload button, trigger click immediately
        if (isUploadButton && onImageClick) {
            e.stopPropagation()
            onImageClick(item)
            return
        }

        if (dragStart && onImageClick) {
            const dragDistance = Math.sqrt(
                Math.pow(e.clientX - dragStart.x, 2) + Math.pow(e.clientY - dragStart.y, 2)
            )

            // If the mouse didn't move much, treat it as a click
            if (dragDistance < 5) {
                e.stopPropagation()
                onImageClick(item)
            }
        }
        setDragStart(null)
    }

    const handleTouchStart = (e: React.TouchEvent) => {
        // For upload button, don't track touch start
        if (isUploadButton) {
            return
        }
        if (e.touches.length === 1) {
            const touch = e.touches[0]
            setTouchStart({ x: touch.clientX, y: touch.clientY })
        }
    }

    const handleTouchEnd = (e: React.TouchEvent) => {
        // For upload button, trigger tap immediately
        if (isUploadButton && onImageClick) {
            e.stopPropagation()
            onImageClick(item)
            return
        }

        if (touchStart && onImageClick && e.changedTouches.length === 1) {
            const touch = e.changedTouches[0]
            const dragDistance = Math.sqrt(
                Math.pow(touch.clientX - touchStart.x, 2) + Math.pow(touch.clientY - touchStart.y, 2)
            )

            // If the touch didn't move much, treat it as a tap
            if (dragDistance < 10) {
                e.stopPropagation()
                onImageClick(item)
            }
        }
        setTouchStart(null)
    }

    return (
        <div
            key={item.id}
            className="absolute group cursor-pointer transition-all duration-200 hover:z-10 select-none"
            style={{
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.height // Square aspect ratio for noText stamps
            }}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <div className="relative w-full h-full transition-all duration-300 hover:scale-105">
                {isUploadButton ? (
                    // Render upload button as a stamp
                    <div
                        className="relative w-full h-full aspect-square"
                        style={{
                            backgroundImage: `url(${postcardSquareBg})`,
                            backgroundSize: 'contain',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                            maskImage: `url(${postcardSquareBg})`,
                            maskSize: 'contain',
                            maskRepeat: 'no-repeat',
                            maskPosition: 'center',
                            WebkitMaskImage: `url(${postcardSquareBg})`,
                            WebkitMaskSize: 'contain',
                            WebkitMaskRepeat: 'no-repeat',
                            WebkitMaskPosition: 'center',
                        }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-[#000DFF] to-[#0008CC] flex flex-col items-center justify-center p-4">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-10 h-10 text-white mb-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                />
                            </svg>
                            <span className="text-white font-medium text-xs text-center leading-tight">
                                Preserve your<br />memory forever
                            </span>
                        </div>
                    </div>
                ) : (
                    // Render normal image item
                    <>
                        {!imageLoaded && !imageError && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50">
                                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            </div>
                        )}
                        {imageError && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50 text-white/70 text-sm">
                                Failed to load
                            </div>
                        )}
                        <div
                            className={`transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                            style={{ height: '100%', width: '100%' }}
                        >
                            <StampPreview
                                headline=""
                                location=""
                                handle=""
                                date=""
                                imageSrc={item.imageUrl}
                                layout="vertical"
                                noText={true}
                                onLoad={() => setImageLoaded(true)}
                                onError={() => setImageError(true)}
                                className="w-full h-full"
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    )
})

CanvasItemComponent.displayName = 'CanvasItemComponent'

export const InfiniteCanvas = forwardRef<InfiniteCanvasRef, InfiniteCanvasProps>(({
    items,
    itemSize = 200,
    gap = 20,
    isPending = false,
    onImageClick
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const [scale, setScale] = useState(1)
    const [isInitialized, setIsInitialized] = useState(false)
    const isMobile = useIsMobile()

    // Touch-specific state
    const [isTouching, setIsTouching] = useState(false)
    const [lastTouchDistance, setLastTouchDistance] = useState(0)
    const [touchStartOffset, setTouchStartOffset] = useState({ x: 0, y: 0 })

    // Mobile performance optimizations
    const mobileItemSize = isMobile ? Math.max(150, itemSize * 0.75) : itemSize
    const mobileGap = isMobile ? Math.max(10, gap * 0.5) : gap

    // Center the grid when items are loaded
    useEffect(() => {
        if (!containerRef.current || items.length === 0 || isPending || isInitialized) return

        const container = containerRef.current
        const rect = container.getBoundingClientRect()

        // Calculate original grid bounds (before infinite tiling)
        const minX = Math.min(...items.map(item => item.x))
        const maxX = Math.max(...items.map(item => item.x + item.width))
        const minY = Math.min(...items.map(item => item.y))
        const maxY = Math.max(...items.map(item => item.y + item.height))

        const gridWidth = maxX - minX
        const gridHeight = maxY - minY
        const gridCenterX = minX + gridWidth / 2
        const gridCenterY = minY + gridHeight / 2

        // Calculate viewport center
        const viewportCenterX = rect.width / 2
        const viewportCenterY = rect.height / 2

        // Set offset to center the original grid (tile 0,0)
        const centeredOffset = {
            x: viewportCenterX - gridCenterX,
            y: viewportCenterY - gridCenterY
        }

        setOffset(centeredOffset)
        setIsInitialized(true)
    }, [items, isPending, isInitialized])

    // Expose reset function via ref
    useImperativeHandle(ref, () => ({
        resetView: () => {
            setIsInitialized(false)
            setOffset({ x: 0, y: 0 })
            setScale(1)
            setIsDragging(false)
            setIsTouching(false)
            setLastTouchDistance(0)
            setTouchStartOffset({ x: 0, y: 0 })
        },
        resetDragState: () => {
            setIsDragging(false)
            setIsTouching(false)
            setLastTouchDistance(0)
        },
        centerOnItem: (itemId: string) => {
            if (!containerRef.current) return

            // Find the item by ID (remove index suffix if present)
            const item = items.find(i => i.id === itemId || i.id.startsWith(itemId + '-'))
            if (!item) return

            const container = containerRef.current
            const rect = container.getBoundingClientRect()

            // Calculate viewport center
            const viewportCenterX = rect.width / 2
            const viewportCenterY = rect.height / 2

            // Calculate item center
            const itemCenterX = item.x + item.width / 2
            const itemCenterY = item.y + item.height / 2

            // Set offset to center the item
            const centeredOffset = {
                x: viewportCenterX - itemCenterX,
                y: viewportCenterY - itemCenterY
            }

            setOffset(centeredOffset)
        }
    }), [items])

    // Handle mouse down for dragging
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return // Only left mouse button
        setIsDragging(true)
        setDragStart({
            x: e.clientX - offset.x,
            y: e.clientY - offset.y
        })
    }, [offset])

    // Handle mouse move for dragging
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return

        const newOffset = {
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        }
        setOffset(newOffset)
    }, [isDragging, dragStart])

    // Handle mouse up to stop dragging
    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    // Handle wheel for scrolling (not zooming)
    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault()

        // Use wheel delta for scrolling instead of zooming
        const scrollSpeed = 1.5
        const deltaX = e.deltaX * scrollSpeed
        const deltaY = e.deltaY * scrollSpeed

        setOffset(prevOffset => ({
            x: prevOffset.x - deltaX,
            y: prevOffset.y - deltaY
        }))
    }, [])

    // Touch event handlers for mobile support
    const getTouchDistance = useCallback((touches: React.TouchList) => {
        if (touches.length < 2) return 0
        const touch1 = touches[0]
        const touch2 = touches[1]
        return Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
        )
    }, [])

    const getTouchCenter = useCallback((touches: React.TouchList) => {
        if (touches.length === 1) {
            return { x: touches[0].clientX, y: touches[0].clientY }
        }
        const touch1 = touches[0]
        const touch2 = touches[1]
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        }
    }, [])

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        e.preventDefault()
        setIsTouching(true)

        const touches = e.touches
        const center = getTouchCenter(touches)

        if (touches.length === 1) {
            // Single touch - start panning
            setDragStart({
                x: center.x - offset.x,
                y: center.y - offset.y
            })
            setTouchStartOffset(offset)
        } else if (touches.length === 2) {
            // Two touches - prepare for pinch zoom
            const distance = getTouchDistance(touches)
            setLastTouchDistance(distance)
            setDragStart({
                x: center.x - offset.x,
                y: center.y - offset.y
            })
        }
    }, [offset, getTouchCenter, getTouchDistance])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isTouching) return
        e.preventDefault()

        const touches = e.touches
        const center = getTouchCenter(touches)

        if (touches.length === 1) {
            // Single touch - pan
            const newOffset = {
                x: center.x - dragStart.x,
                y: center.y - dragStart.y
            }
            setOffset(newOffset)
        } else if (touches.length === 2) {
            // Two touches - pinch zoom and pan
            const distance = getTouchDistance(touches)

            if (lastTouchDistance > 0) {
                const scaleChange = distance / lastTouchDistance
                const newScale = Math.max(0.1, Math.min(3, scale * scaleChange))

                // Calculate zoom center
                const rect = containerRef.current?.getBoundingClientRect()
                if (rect) {
                    const zoomCenterX = center.x - rect.left
                    const zoomCenterY = center.y - rect.top

                    // Adjust offset to zoom around touch center
                    const scaleRatio = newScale / scale
                    const newOffset = {
                        x: zoomCenterX - (zoomCenterX - offset.x) * scaleRatio,
                        y: zoomCenterY - (zoomCenterY - offset.y) * scaleRatio
                    }

                    setScale(newScale)
                    setOffset(newOffset)
                }
            }

            setLastTouchDistance(distance)
        }
    }, [isTouching, dragStart, getTouchCenter, getTouchDistance, lastTouchDistance, scale, offset])

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        setIsTouching(false)
        setLastTouchDistance(0)

        // If it was a quick tap with minimal movement, don't prevent click events
        if (e.changedTouches.length === 1) {
            const touch = e.changedTouches[0]
            const dragDistance = Math.sqrt(
                Math.pow(touch.clientX - (dragStart.x + touchStartOffset.x), 2) +
                Math.pow(touch.clientY - (dragStart.y + touchStartOffset.y), 2)
            )

            // Allow tap events to propagate for image clicks
            if (dragDistance < 10) {
                // This was likely a tap, let it bubble up
                return
            }
        }

        e.preventDefault()
    }, [dragStart, touchStartOffset])

    // Add event listeners
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        container.addEventListener('wheel', handleWheel, { passive: false })

        // Additional global event listeners to ensure dragging stops
        const handleGlobalMouseUp = () => {
            setIsDragging(false)
            setIsTouching(false)
        }

        const handleVisibilityChange = () => {
            if (document.hidden) {
                setIsDragging(false)
                setIsTouching(false)
            }
        }

        document.addEventListener('mouseup', handleGlobalMouseUp, true)
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            container.removeEventListener('wheel', handleWheel)
            document.removeEventListener('mouseup', handleGlobalMouseUp, true)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [handleMouseMove, handleMouseUp, handleWheel])

    // Memoized visible items calculation with infinite grid illusion
    const visibleItems = useMemo(() => {
        if (!containerRef.current || isPending || items.length === 0) return []

        const container = containerRef.current
        const rect = container.getBoundingClientRect()

        // Calculate viewport bounds in canvas coordinates
        const viewportLeft = (-offset.x) / scale
        const viewportTop = (-offset.y) / scale
        const viewportRight = viewportLeft + rect.width / scale
        const viewportBottom = viewportTop + rect.height / scale

        // Add padding to load items slightly outside viewport (reduced for mobile)
        const padding = (isMobile ? mobileItemSize : itemSize) * (isMobile ? 1.5 : 2)

        // Calculate grid dimensions matching gallery-page.tsx logic
        const itemsPerRow = Math.ceil(Math.sqrt(items.length))
        const gridCols = itemsPerRow
        const gridRows = Math.ceil(items.length / itemsPerRow)

        // Use the actual spacing from the original items (they already have correct device-specific sizing)
        if (items.length === 0) return []

        // Calculate cell dimensions from the actual item positioning
        // Gallery-page uses: x = col * (size + spacing), so spacing = (x_next - x_current) - size
        const firstItem = items[0]
        const secondItem = items.length > 1 ? items[1] : null

        let cellWidth, cellHeight
        if (secondItem && secondItem.y === firstItem.y) {
            // Items are in same row, calculate from x difference
            cellWidth = secondItem.x - firstItem.x
            cellHeight = cellWidth // Assuming square grid
        } else {
            // Fallback: use item size + estimated gap
            const estimatedGap = isMobile ? 10 : 20
            cellWidth = firstItem.width + estimatedGap
            cellHeight = firstItem.height + estimatedGap
        }

        const gridWidth = gridCols * cellWidth
        const gridHeight = gridRows * cellHeight

        const virtualItems: CanvasItem[] = []

        // Calculate which grid tiles we need to render
        const startCol = Math.floor((viewportLeft - padding) / gridWidth)
        const endCol = Math.ceil((viewportRight + padding) / gridWidth)
        const startRow = Math.floor((viewportTop - padding) / gridHeight)
        const endRow = Math.ceil((viewportBottom + padding) / gridHeight)

        // Generate virtual items for each grid tile
        for (let tileRow = startRow; tileRow <= endRow; tileRow++) {
            for (let tileCol = startCol; tileCol <= endCol; tileCol++) {
                const tileOffsetX = tileCol * gridWidth
                const tileOffsetY = tileRow * gridHeight

                // Add all items from the original grid to this tile position
                items.forEach((item, index) => {
                    // Items already have correct positioning and sizing from gallery-page
                    // No scaling needed - just offset for infinite grid tiles
                    const virtualItem: CanvasItem = {
                        ...item,
                        id: `${item.id}-${index}-tile-${tileCol}-${tileRow}`,
                        arweaveTransactionId: item.id,
                        x: item.x + tileOffsetX,
                        y: item.y + tileOffsetY,
                        // Keep original width/height from gallery-page
                        width: item.width,
                        height: item.height
                    }

                    // Check if this virtual item is in the viewport
                    if (virtualItem.x + virtualItem.width >= viewportLeft - padding &&
                        virtualItem.x <= viewportRight + padding &&
                        virtualItem.y + virtualItem.height >= viewportTop - padding &&
                        virtualItem.y <= viewportBottom + padding) {
                        virtualItems.push(virtualItem)
                    }
                })
            }
        }

        return virtualItems
    }, [items, offset, scale, itemSize, gap, isPending, isMobile, mobileItemSize, mobileGap])

    // Allow dragging through images - don't stop propagation
    const handleItemMouseDown = useCallback((e: React.MouseEvent) => {
        // Allow drag to propagate to canvas for panning
        // e.stopPropagation() - removed to enable dragging through images
    }, [])

    return (
        <div
            ref={containerRef}
            className="w-full h-screen overflow-hidden bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-pink-900/20 cursor-grab active:cursor-grabbing relative touch-none"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ cursor: isDragging || isTouching ? 'grabbing' : 'grab' }}
        >

            <div className="absolute top-0 left-0 right-0 h-60 bg-gradient-to-b from-black to-transparent z-10 pointer-events-none" />
            {/* Loading overlay */}
            {isPending && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="text-white text-lg font-medium">
                        Generating layout...
                    </div>
                </div>
            )}

            {/* Canvas content */}
            <div
                className="absolute inset-0 origin-top-left"
                style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    transformOrigin: '0 0'
                }}
            >
                {visibleItems.map((item) => (
                    <CanvasItemComponent
                        key={item.id}
                        item={item}
                        onMouseDown={handleItemMouseDown}
                        onImageClick={onImageClick}
                    />
                ))}
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none" />

            {/* Controls overlay */}
            {process.env.NODE_ENV === 'development' && <div className="absolute top-28 left-4 bg-black/20 backdrop-blur-sm rounded-lg p-3 text-white text-sm font-mono">
                <div>Scale: {scale.toFixed(2)}x</div>
                <div>Offset: ({Math.round(offset.x)}, {Math.round(offset.y)})</div>
                <div>Visible: {visibleItems.length} (∞ grid)</div>
            </div>}
        </div>
    )
})

InfiniteCanvas.displayName = 'InfiniteCanvas'

export default InfiniteCanvas
