import React, { useState, useMemo, useCallback, useRef, useTransition, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import InfiniteCanvas, { type CanvasItem, type InfiniteCanvasRef } from './infinite-canvas'
import ImageModal from './image-modal'
import ListViewComponent from './list-view'
import CardView from './card-view'
import { clearImageUrlCache } from '../utils/generate-grid'
import { useIsMobile } from '../hooks/use-mobile'
import { Button } from './ui/button'
import { RefreshCw } from 'lucide-react'
import { MemoriesLogo } from './landing-page'
import permanent from "@/assets/permanent-light.png"
import { cn } from '@/lib/utils'
import { buildArweaveTransactionUrl, fetchWithGatewayFallback, isLikelyImageContentType } from '@/lib/arweave-gateway'
import { fetchMemories, type ArweaveTransaction } from '@/utils/memories'
import { HANDLE_PLATFORM_TAG, normalizeHandlePlatform } from '@/utils/handle-links'
import { getLocalMemories } from '@/lib/local-memories'
import { fetchBlacklist } from '@/lib/blacklist'

// Create a map to store real Arweave images
const arweaveImageMap = new Map<string, { url: string; title: string; location?: string; description?: string; handle?: string; handlePlatform?: 'x' | 'instagram' | 'telegram'; date?: string; isPrivate?: boolean }>()

// Function to check if a URL is a valid image
const getValidImageUrl = async (url: string): Promise<string | null> => {
    try {
        const { url: resolvedUrl } = await fetchWithGatewayFallback(
            url,
            { method: 'HEAD', cache: 'no-cache' },
            {
                shouldAccept: (response) => response.ok && isLikelyImageContentType(response.headers.get('content-type'))
            }
        )

        return resolvedUrl
    } catch {
        return null
    }
}


const GalleryPage: React.FC = () => {
    const [searchParams] = useSearchParams()
    const highlightId = searchParams.get('highlight')
    const [arweaveMemories, setArweaveMemories] = useState<ArweaveTransaction[]>([])
    const [validatedImages, setValidatedImages] = useState<Set<string>>(new Set())
    const [isLoadingArweave, setIsLoadingArweave] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [hasNextPage, setHasNextPage] = useState(false)
    const [endCursor, setEndCursor] = useState<string | null>(null)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [selectedImage, setSelectedImage] = useState<CanvasItem | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'card'>('grid')
    const [startTime, setStartTime] = useState(Date.now())
    const [prevConnected, setPrevConnected] = useState(null)
    const canvasRef = useRef<InfiniteCanvasRef>(null)
    const isMobile = useIsMobile()


    // useEffect(() => {
    //     const now = Date.now()
    //     const diffMs = (now - startTime)
    //     if (diffMs < 1000) {
    //         return
    //     }

    // if (prevConnected === null) {
    //     // First render - just initialize without showing modal
    //     setPrevConnected(connected)
    // } else if (prevConnected === false && connected === true) {
    //     // Transition from not connected to connected - show modal
    //     setIsUploadModalOpen(true)
    //     setPrevConnected(connected)
    // } else if (prevConnected !== connected) {
    //     // Any other state change - just update prevConnected
    //     setPrevConnected(connected)
    // }
    // }, [connected])

    // useEffect(() => {
    //     if (!api) return
    //     if (api.id == "wauth-twitter") {
    //         const username = api.authData?.username
    //         if (!username) {
    //             console.log("No username found, disconnecting")
    //             disconnect()
    //         }
    //     }
    // }, [api, connected, address])

    // Load Arweave memories
    const loadArweaveMemories = useCallback(async (cursor?: string, append = false) => {
        try {
            if (!append) {
                setIsLoadingArweave(true)
                setError(null)
            } else {
                setIsLoadingMore(true)
            }

            const response = await fetchMemories(cursor)
            const blacklist = await fetchBlacklist()
            const transactions = response.data.transactions.edges
                .map(edge => edge.node)
                .filter(tx => !blacklist.has(tx.id))

            if (append) {
                setArweaveMemories(prev => [...prev, ...transactions])
            } else {
                setArweaveMemories(transactions)
            }

            // Filter and validate image transactions
            const imageValidationPromises = transactions.map(async (transaction, index) => {
                const tags = transaction.tags.reduce((acc, tag) => {
                    acc[tag.name] = tag.value
                    return acc
                }, {} as Record<string, string>)

                // Check if Content-Type tag indicates it's an image
                const contentType = tags['Content-Type']
                const isImageContentType = contentType && contentType.startsWith('image/')

                if (isImageContentType) {
                    const url = buildArweaveTransactionUrl(transaction.id)

                    // Double-check by validating the actual URL
                    const validImageUrl = await getValidImageUrl(url)

                    if (validImageUrl) {
                        arweaveImageMap.set(transaction.id, {
                            url: validImageUrl,
                            title: tags.Title || tags.Name || `Memory ${arweaveMemories.length + index + 1}`,
                            location: tags.Location,
                            description: tags.Description,
                            handle: tags.Handle,
                            handlePlatform: normalizeHandlePlatform(tags[HANDLE_PLATFORM_TAG]),
                            date: tags.Date
                        })
                        return transaction.id
                    }
                }
                return null
            })

            // Wait for all validations to complete
            const validImageIds = await Promise.all(imageValidationPromises)
            const validIds = validImageIds.filter(id => id !== null) as string[]

            // Update validated images set
            setValidatedImages(prev => {
                const newSet = new Set(prev)
                validIds.forEach(id => newSet.add(id))
                return newSet
            })

            const lastEdgeCursor = response.data.transactions.edges.length > 0
                ? response.data.transactions.edges[response.data.transactions.edges.length - 1].cursor
                : null

            setHasNextPage(response.data.transactions.pageInfo.hasNextPage)
            setEndCursor(lastEdgeCursor)

        } catch (err) {
            console.error('Failed to load Arweave memories:', err)
            setError(err instanceof Error ? err.message : 'Failed to load Arweave memories')
        } finally {
            setIsLoadingArweave(false)
            setIsLoadingMore(false)
        }
    }, [])

    // Load more memories (pagination)
    const loadMoreMemories = useCallback(async () => {
        if (hasNextPage && !isLoadingMore && endCursor) {
            await loadArweaveMemories(endCursor, true)
        }
    }, [hasNextPage, isLoadingMore, endCursor, loadArweaveMemories])

    // Refresh memories
    const refreshMemories = useCallback(() => {
        setArweaveMemories([])
        setEndCursor(null)
        arweaveImageMap.clear()
        loadArweaveMemories()
    }, [loadArweaveMemories])

    const handleListViewMount = useCallback(() => {
        if (!isLoadingArweave && !isLoadingMore) {
            loadArweaveMemories()
        }
    }, [isLoadingArweave, isLoadingMore, loadArweaveMemories])

    // Generate items in grid layout with only validated image URLs
    const items: CanvasItem[] = useMemo(() => {
        const validImageCount = arweaveImageMap.size
        console.log(`Generating grid layout for ${validImageCount} validated images`)
        const size = isMobile ? 150 : 200
        const spacing = isMobile ? 10 : 20

        // Calculate grid dimensions based on number of validated images
        if (validImageCount === 0) return []

        // Convert validated Arweave images to array
        const arweaveArray = Array.from(arweaveImageMap.entries())

        // Calculate optimal items per row to fill the grid completely
        const totalItemCount = validImageCount
        const itemsPerRow = Math.ceil(Math.sqrt(totalItemCount))

        // Calculate how many items we need to fill the last row
        const remainder = totalItemCount % itemsPerRow
        const itemsNeeded = remainder === 0 ? 0 : itemsPerRow - remainder

        // Duplicate items to fill empty spaces in the grid
        const itemsToRender = [...arweaveArray]
        if (itemsNeeded > 0) {
            // Duplicate items to fill the last row, avoiding adjacent duplicates
            for (let i = 0; i < itemsNeeded; i++) {
                // Calculate position where this item will be placed
                const targetIndex = itemsToRender.length
                const colInRow = targetIndex % itemsPerRow

                // Find an item to duplicate that won't be adjacent
                let sourceIndex = i % validImageCount

                // Avoid left adjacency (if not first in row)
                if (colInRow > 0) {
                    const leftNeighborId = itemsToRender[targetIndex - 1][0]
                    // Try to find a different item that's not the left neighbor
                    let attempts = 0
                    while (arweaveArray[sourceIndex][0] === leftNeighborId && attempts < validImageCount) {
                        sourceIndex = (sourceIndex + 1) % validImageCount
                        attempts++
                    }
                }

                // Avoid top adjacency (if there's a row above)
                const topNeighborIndex = targetIndex - itemsPerRow
                if (topNeighborIndex >= 0 && topNeighborIndex < itemsToRender.length) {
                    const topNeighborId = itemsToRender[topNeighborIndex][0]
                    let attempts = 0
                    while (arweaveArray[sourceIndex][0] === topNeighborId && attempts < validImageCount) {
                        sourceIndex = (sourceIndex + 1) % validImageCount
                        attempts++
                    }
                }

                itemsToRender.push(arweaveArray[sourceIndex])
            }
        }

        // Map all items
        const allItems: CanvasItem[] = itemsToRender.map(([transactionId, arweaveData], index) => {
            const row = Math.floor(index / itemsPerRow)
            const col = index % itemsPerRow
            const x = col * (size + spacing)
            const y = row * (size + spacing)

            return {
                id: transactionId,
                x,
                y,
                width: size,
                height: size,
                imageUrl: arweaveData.url,
                title: arweaveData.title,
                handle: arweaveData.handle,
                handlePlatform: arweaveData.handlePlatform,
                metadata: {
                    location: arweaveData.location,
                    date: arweaveData.date ? new Date(arweaveData.date) : new Date(),
                    description: arweaveData.description,
                    tags: [],
                    camera: undefined,
                    isPrivate: arweaveData.isPrivate
                }
            }
        })

        return allItems
    }, [isMobile, validatedImages])

    const listItems: CanvasItem[] = useMemo(() => {
        return Array.from(arweaveImageMap.entries()).map(([transactionId, arweaveData], index) => ({
            id: transactionId,
            x: 0,
            y: index,
            width: 0,
            height: 0,
            handle: arweaveData.handle,
            handlePlatform: arweaveData.handlePlatform,
            imageUrl: arweaveData.url,
            title: arweaveData.title,
            metadata: {
                location: arweaveData.location,
                date: arweaveData.date ? new Date(arweaveData.date) : new Date(),
                description: arweaveData.description,
                tags: [],
                camera: undefined,
                isPrivate: arweaveData.isPrivate,
            },
        }))
    }, [validatedImages])

    // Load initial data
    useEffect(() => {
        loadArweaveMemories()
    }, [loadArweaveMemories])

    // Inject local memories after Arweave load completes
    useEffect(() => {
        if (isLoadingArweave) return
        const localMemories = getLocalMemories()
        if (localMemories.length === 0) return

        let added = 0
        for (const mem of localMemories) {
            if (!arweaveImageMap.has(mem.id)) {
                arweaveImageMap.set(mem.id, {
                    url: mem.imageUrl,
                    title: mem.title,
                    location: mem.location,
                    description: mem.description,
                    handle: mem.handle,
                    handlePlatform: mem.handlePlatform,
                    date: mem.date,
                    isPrivate: !mem.isPublic,
                })
                added++
            }
        }
        if (added > 0) {
            setValidatedImages(prev => {
                const newSet = new Set(prev)
                localMemories.forEach(mem => {
                    if (!prev.has(mem.id)) newSet.add(mem.id)
                })
                return newSet
            })
        }
    }, [isLoadingArweave])

    // Center on highlighted item when items are loaded
    useEffect(() => {
        if (highlightId && items.length > 0 && canvasRef.current && !isLoadingArweave) {
            // Wait a bit for the canvas to initialize
            setTimeout(() => {
                canvasRef.current?.centerOnItem(highlightId)
            }, 500)
        }
    }, [highlightId, items.length, isLoadingArweave])

    // Cleanup effect for memory management
    useEffect(() => {
        return () => {
            // Clear image URL cache when component unmounts
            clearImageUrlCache()
        }
    }, [])



    // Memoized reset function
    const resetView = useCallback(() => {
        if (canvasRef.current) {
            canvasRef.current.resetView()
        } else {
            // Fallback to reload if ref method not available
            window.location.reload()
        }
    }, [])

    // Handle image click to open modal
    const handleImageClick = useCallback((item: CanvasItem) => {
        // Reset canvas dragging state when opening modal
        if (canvasRef.current) {
            canvasRef.current.resetDragState()
        }
        setSelectedImage(item)
        console.log(viewMode)
        if (!viewMode.includes("list"))
            setIsModalOpen(true)
    }, [viewMode])

    // Handle modal close
    const handleModalClose = useCallback(() => {
        setIsModalOpen(false)
        setSelectedImage(null)
    }, [])

    return (
        <div
            className="relative w-full h-screen bg-black"
        >

            <div className={cn('absolute !top-6 !left-6 z-40')}>
                <MemoriesLogo theme='light' />
            </div>

            {/* Loading State */}
            {isLoadingArweave && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="text-center">
                        <div className="w-12 h-12 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
                        <div className="text-white text-lg font-medium">Loading memories...</div>
                    </div>
                </div>
            )}

            {/* Error State */}
            {error && !isLoadingArweave && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="text-center max-w-md mx-4">
                        <div className="text-red-400 text-lg font-medium mb-4">Failed to load memories</div>
                        <div className="text-white/80 text-sm mb-6">{error}</div>
                        <Button onClick={refreshMemories} className="bg-white/20 hover:bg-white/30">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Try Again
                        </Button>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!isLoadingArweave && !error && arweaveImageMap.size === 0 && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="text-center max-w-md mx-4">
                        <div className="text-white/60 text-6xl mb-6">📸</div>
                        <div className="text-white text-xl font-medium mb-4">No image memories found</div>
                        <div className="text-white/70 text-sm">
                            No image memories have been uploaded yet.
                        </div>
                    </div>
                </div>
            )}

            {
                (viewMode === 'grid' || viewMode === 'card') && !isMobile && <div className='absolute bottom-9 left-9 z-50'>
                    <img src={permanent} className='w-22 opacity-80 rounded' />
                </div>
            }

            {/* Infinite Canvas - Grid View */}
            {arweaveImageMap.size > 0 && viewMode === 'grid' && (
                <InfiniteCanvas
                    ref={canvasRef}
                    items={items}
                    itemSize={isMobile ? 150 : 200}
                    gap={isMobile ? 20 : 40}
                    isPending={isPending}
                    onImageClick={handleImageClick}
                />
            )}

            {/* List View */}
            {arweaveImageMap.size > 0 && viewMode === 'list' && (
                <div className="absolute inset-0 pt-24 z-10">
                    <ListViewComponent
                        items={listItems}
                        onImageClick={handleImageClick}
                        onLoadMore={loadMoreMemories}
                        hasMore={hasNextPage}
                        isLoadingMore={isLoadingMore}
                    />
                </div>
            )}

            {/* Card View */}
            {arweaveImageMap.size > 0 && viewMode === 'card' && (
                <div className="absolute inset-0 z-10 overflow-visible">
                    <CardView
                        items={items}
                        onImageClick={handleImageClick}
                    />
                </div>
            )}

            <div className={`fixed z-20 bottom-10 right-5`}>
                {/* button group- grid, list, card */}
                <div className="inline-flex items-center gap-0 bg-[#141218]/20  text-black rounded p-1">
                    <Button
                        variant="ghost"
                        onClick={() => setViewMode('grid')}
                        className={`h-10 px-6 rounded text-sm  font-medium transition-all ${viewMode === 'grid'
                            ? 'bg-white text-black hover:bg-white'
                            : 'text-white/70 hover:text-white hover:bg-transparent'
                            }`}
                        title="Grid View"
                    >
                        Grid
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => setViewMode('list')}
                        className={`h-10 px-6 rounded text-sm  font-medium transition-all ${viewMode === 'list'
                            ? 'bg-white text-black hover:bg-white'
                            : 'text-white/70 hover:text-white hover:bg-transparent'
                            }`}
                        title="List View"
                    >
                        List
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => setViewMode('card')}
                        className={`h-10 px-6 rounded text-sm  font-medium transition-all ${viewMode === 'card'
                            ? 'bg-white text-black hover:bg-white'
                            : 'text-white/70 hover:text-white hover:bg-transparent'
                            }`}
                        title="Card View"
                    >
                        Card
                    </Button>
                </div>
            </div>



            {/* Image Modal */}
            <ImageModal
                item={selectedImage}
                isOpen={isModalOpen}
                onClose={handleModalClose}
            />

        </div >
    )
}

export default GalleryPage
