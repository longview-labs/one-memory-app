import React, { useState, useMemo, useCallback, useRef, useTransition, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import InfiniteCanvas, { type CanvasItem, type InfiniteCanvasRef } from './infinite-canvas'
import ImageModal from './image-modal'
import ListViewComponent from './list-view'
import CardView from './card-view'
import { clearImageUrlCache } from '../utils/generate-grid'
import { useIsMobile } from '../hooks/use-mobile'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Home, Plus, User, RefreshCw, Upload, LayoutGrid, List, LayoutList } from 'lucide-react'
import { MemoriesLogo } from './landing-page'
import UploadModal, { type UploadData } from './upload-modal'
import imageCompression from 'browser-image-compression'
import { ArconnectSigner, TurboFactory } from '@ardrive/turbo-sdk/web'
import { QuickWallet } from 'quick-wallet'
import permanent from "@/assets/permanent-light.png"
import { cn } from '@/lib/utils'
import { trackUploadFailed, trackUploadSucceeded } from '@/lib/analytics'
import { buildArweaveTransactionUrl, fetchGraphqlWithGatewayFallback, fetchWithGatewayFallback, isLikelyImageContentType, validateArweaveImageWithFallback } from '@/lib/arweave-gateway'

// GraphQL query for fetching Arweave transactions
const MEMORIES_QUERY = `query GetMemories($after: String) {
    transactions(
        tags: [
            {name: "App-Name", values: ["Memories-App"]}
            {name: "App-Version", values: ["1.0.3"]}
            {name: "App-Env", values: ["${import.meta.env.DEV ? "Dev" : "Prod"}"]}
            {name: "Visibility", values: ["Public"]}
        ],
        after: $after
        first: 50
    ) {
        edges {
            cursor
            node {
                id
                tags {
                    name
                    value
                }
            }
        }
    }
}`

// Interface for GraphQL response
interface ArweaveTransaction {
    id: string
    tags: Array<{
        name: string
        value: string
    }>
}

interface TransactionEdge {
    cursor: string
    node: ArweaveTransaction
}

interface GraphQLResponse {
    data: {
        transactions: {
            edges: TransactionEdge[]
        }
    }
}

// Function to fetch memories from Arweave
const fetchMemories = async (cursor?: string): Promise<GraphQLResponse> => {
    const { data } = await fetchGraphqlWithGatewayFallback<GraphQLResponse['data']>(
        MEMORIES_QUERY,
        cursor ? { after: cursor } : {},
        {
            validateData: (data) => {
                const edges = data?.transactions?.edges
                return Array.isArray(edges) && edges.length > 0
            }
        }
    )

    return { data }
}

// Create a map to store real Arweave images
const arweaveImageMap = new Map<string, { url: string; title: string; location?: string; description?: string; handle?: string; date?: string }>()

// Compression options for image upload
const compressionOptions = {
    maxSizeMB: 0.1, // Hard limit of 100KB
    maxWidthOrHeight: 1200, // Balanced resolution for quality vs size
    useWebWorker: true,
    initialQuality: 0.9, // High quality starting point
    maxIteration: 30, // More iterations to find optimal balance
    fileType: 'image/jpeg', // JPEG for better compression
    alwaysKeepResolution: false, // Allow smart resolution adjustment
    preserveExif: false, // Remove EXIF data to save space
}

// Upload file to Arweave using Turbo
async function uploadFileTurbo(file: File, api: any, tags: { name: string, value: string }[] = []) {
    const signer = new ArconnectSigner(api)
    console.log('signer', signer);

    const turbo = TurboFactory.authenticated({ signer })
    const res = await turbo.uploadFile({
        fileStreamFactory: () => file.stream(),
        fileSizeFactory: () => file.size,
        dataItemOpts: {
            tags: [
                { name: "App-Name", value: "Memories-App" },
                { name: "App-Version", value: "1.0.3" },
                { name: "App-Env", value: import.meta.env.DEV ? "Dev" : "Prod" },
                { name: "Content-Type", value: file.type ?? "application/octet-stream" },
                { name: "Name", value: file.name ?? "unknown" },
                ...tags
            ],
        }
    })
    return res.id;
}

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
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [prevConnected, setPrevConnected] = useState(null)
    const [localStorageMemory, setLocalStorageMemory] = useState<any>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [initialFile, setInitialFile] = useState<File | null>(null)
    const canvasRef = useRef<InfiniteCanvasRef>(null)
    const isMobile = useIsMobile()
    const navigate = useNavigate()
    const address = QuickWallet.getActiveAddress()
    const api = QuickWallet

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

    // Load localStorage memory if highlighted
    useEffect(() => {
        if (highlightId) {
            const storedMemory = localStorage.getItem('lastUploadedMemory')
            if (storedMemory) {
                try {
                    const parsedMemory = JSON.parse(storedMemory)
                    if (parsedMemory.id === highlightId) {
                        setLocalStorageMemory(parsedMemory)
                        // Add to arweaveImageMap
                        arweaveImageMap.set(parsedMemory.id, {
                            url: parsedMemory.imageUrl,
                            title: parsedMemory.title,
                            location: parsedMemory.location,
                            description: parsedMemory.description,
                            handle: parsedMemory.handle,
                            date: parsedMemory.date
                        })
                        // Mark as validated
                        setValidatedImages(prev => {
                            const newSet = new Set(prev)
                            newSet.add(parsedMemory.id)
                            return newSet
                        })
                    }
                } catch (err) {
                    console.error('Failed to parse localStorage memory:', err)
                }
            }
        }
    }, [highlightId])

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
            const transactions = response.data.transactions.edges.map(edge => edge.node)

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

            // Set hasNextPage based on whether we got the full requested amount (20)
            setHasNextPage(response.data.transactions.edges.length === 20)

            // Set endCursor to the cursor of the last transaction
            if (response.data.transactions.edges.length > 0) {
                setEndCursor(response.data.transactions.edges[response.data.transactions.edges.length - 1].cursor)
            } else {
                setEndCursor(null)
            }

        } catch (err) {
            console.error('Failed to load Arweave memories:', err)
            setError(err instanceof Error ? err.message : 'Failed to load Arweave memories')
        } finally {
            setIsLoadingArweave(false)
            setIsLoadingMore(false)
        }
    }, [])

    // Load more memories (pagination)
    const loadMoreMemories = useCallback(() => {
        if (hasNextPage && !isLoadingMore && endCursor) {
            loadArweaveMemories(endCursor, true)
        }
    }, [hasNextPage, isLoadingMore, endCursor, loadArweaveMemories])

    // Refresh memories
    const refreshMemories = useCallback(() => {
        setArweaveMemories([])
        setEndCursor(null)
        arweaveImageMap.clear()
        loadArweaveMemories()
    }, [loadArweaveMemories])

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
        // Add 1 to account for the upload button
        const totalItemCount = validImageCount + 1
        const itemsPerRow = Math.ceil(Math.sqrt(totalItemCount))

        // Calculate how many items we need to fill the last row
        const remainder = totalItemCount % itemsPerRow
        const itemsNeeded = remainder === 0 ? 0 : itemsPerRow - remainder

        // Insert upload button at a strategic position - roughly every 20-25 items
        // Position it somewhere in the middle third of visible items for better visibility
        const uploadButtonPosition = validImageCount > 20
            ? Math.floor(validImageCount * 0.33) + Math.floor(Math.random() * Math.min(10, validImageCount * 0.2))
            : validImageCount > 5
                ? Math.floor(validImageCount / 2)
                : validImageCount > 0
                    ? Math.floor(Math.random() * (validImageCount - 1)) + 1
                    : 0

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

        // Map all items including the upload button
        const allItems: CanvasItem[] = itemsToRender.map(([transactionId, arweaveData], index) => {
            // Adjust index if we're past the upload button position
            const actualIndex = index >= uploadButtonPosition ? index + 1 : index
            const row = Math.floor(actualIndex / itemsPerRow)
            const col = actualIndex % itemsPerRow
            const x = col * (size + spacing)
            const y = row * (size + spacing)

            return {
                id: `${transactionId}-${index}`, // Add index to ensure unique IDs for duplicates
                x,
                y,
                width: size,
                height: size,
                imageUrl: arweaveData.url,
                title: arweaveData.title,
                metadata: {
                    location: arweaveData.location,
                    date: arweaveData.date ? new Date(arweaveData.date) : new Date(),
                    description: arweaveData.description,
                    tags: [],
                    camera: undefined
                }
            }
        })

        // Insert upload button item at the random position
        const uploadButtonRow = Math.floor(uploadButtonPosition / itemsPerRow)
        const uploadButtonCol = uploadButtonPosition % itemsPerRow
        const uploadButtonItem: CanvasItem = {
            id: 'upload-button',
            x: uploadButtonCol * (size + spacing),
            y: uploadButtonRow * (size + spacing),
            width: size,
            height: size,
            imageUrl: '', // Empty for button
            title: 'Upload Memory',
            metadata: {
                description: 'Click to upload a new memory',
                tags: ['upload'],
                date: new Date(),
                camera: undefined
            }
        }

        allItems.splice(uploadButtonPosition, 0, uploadButtonItem)

        return allItems
    }, [isMobile, validatedImages])

    // Load initial data
    useEffect(() => {
        loadArweaveMemories()
    }, [loadArweaveMemories])

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

    // Handle upload button click
    const handleUploadClick = useCallback(() => {
        // Create a file input element
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = (e: Event) => {
            const target = e.target as HTMLInputElement
            const files = target.files
            if (files && files.length > 0) {
                const file = files[0]
                setInitialFile(file)
                setIsUploadModalOpen(true)
            }
        }
        input.click()
    }, [])

    // Handle image click to open modal
    const handleImageClick = useCallback((item: CanvasItem) => {
        // Check if this is the upload button (including tiled versions)
        if (item.id === 'upload-button' || item.id.startsWith('upload-button-tile-')) {
            // Trigger file selection instead of directly opening modal
            handleUploadClick()
            return
        }

        // Reset canvas dragging state when opening modal
        if (canvasRef.current) {
            canvasRef.current.resetDragState()
        }
        setSelectedImage(item)
        console.log(viewMode)
        if (!viewMode.includes("list"))
            setIsModalOpen(true)
    }, [viewMode, handleUploadClick])

    // Handle modal close
    const handleModalClose = useCallback(() => {
        setIsModalOpen(false)
        setSelectedImage(null)
    }, [])

    // Validate that the image is accessible on Arweave
    const validateArweaveImage = async (transactionId: string, maxRetries = 10, retryDelay = 3000): Promise<boolean> => {
        console.log(`Validating Arweave image with gateway fallback: ${transactionId}`)
        const result = await validateArweaveImageWithFallback(transactionId, maxRetries, retryDelay)
        return result.isValid
    }

    // Handle image upload
    const handleImageUpload = async (file: File, uploadData: UploadData): Promise<string> => {
        if (!api) throw new Error('Wallet not initialized not found');

        console.log('originalFile instanceof Blob', file instanceof Blob);
        console.log(`originalFile size ${file.size / 1024 / 1024} MB`);

        try {
            QuickWallet.connect()
            let finalFile = file;

            // Only compress if file is larger than 100KB
            if (file.size > 100 * 1024) {
                console.log('File is larger than 100KB, compressing...');
                finalFile = await imageCompression(file, compressionOptions);
                console.log('compressedFile instanceof Blob', finalFile instanceof Blob);
                console.log(`compressedFile size ${finalFile.size / 1024} KB`);
            } else {
                console.log('File is under 100KB, uploading as-is');
            }

            const extraTags = [
                { name: "Title", value: uploadData.title },
                { name: "Location", value: uploadData.location },
                { name: "Handle", value: uploadData.handle },
                { name: "Visibility", value: uploadData.isPublic ? "Public" : "Not-Public" }
            ]

            if (uploadData.description?.trim()) {
                extraTags.push({ name: "Description", value: uploadData.description.trim() })
            }

            const id = await uploadFileTurbo(finalFile, api, extraTags);
            console.log('id', id);
            return id;
        } catch (error) {
            console.log(error);
            return '';
        }
    }

    // Handle modal upload
    const handleModalUpload = async (uploadData: UploadData) => {

        setIsUploading(true)
        const uploadStartedAt = Date.now()
        let uploadStage: 'upload' | 'validation' = 'upload'

        try {
            console.log('Upload data:', uploadData)

            // Upload the image to Arweave
            const id = await handleImageUpload(uploadData.file, uploadData)
            console.log('Upload completed, transaction ID:', id);

            if (!id) {
                throw new Error('Upload failed: No transaction ID returned')
            }

            // Validate that the image is accessible on Arweave before navigating
            uploadStage = 'validation'
            console.log('🔍 Validating image accessibility on Arweave...')
            const isValid = await validateArweaveImage(id)

            if (isValid) {
                trackUploadSucceeded({
                    memoryId: id,
                    surface: 'gallery',
                    durationMs: Date.now() - uploadStartedAt,
                    isPublic: uploadData.isPublic,
                })
                console.log('✅ Image validated successfully, navigating to view page')
                // Close modal before navigating
                setIsUploadModalOpen(false)
                setIsUploading(false)
                navigate(`/view/${id}`)
            } else {
                throw new Error('Image upload completed but failed to validate accessibility on Arweave. Please try again.')
            }
        } catch (error) {
            console.error('Upload failed:', error)
            trackUploadFailed({
                surface: 'gallery',
                stage: uploadStage,
                errorMessage: error instanceof Error ? error.message : 'Unknown upload error',
            })
            alert(error instanceof Error ? error.message : 'Upload failed. Please try again.')
        } finally {
            setIsUploading(false)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const files = e.dataTransfer.files
        if (files && files.length > 0) {
            const file = files[0]
            if (file.type.startsWith('image/')) {
                setInitialFile(file)
                setIsUploadModalOpen(true)
            }
        }
    }

    return (
        <div
            className="relative w-full h-screen bg-black"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag overlay */}
            {isDragging && (
                <div className="fixed inset-0 z-50 bg-[#000DFF]/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                    <div className="bg-black/90 border-2 border-dashed border-[#000DFF] rounded-2xl px-16 py-12 flex flex-col items-center gap-6">
                        <Upload className="w-20 h-20 text-[#000DFF]" />
                        <p className="text-3xl font-semibold text-white">Drop your photo here</p>
                    </div>
                </div>
            )}

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
                        <div className="text-white/70 text-sm mb-6">
                            Upload some image memories to see them here in your gallery.
                        </div>
                        <Button
                            onClick={() => navigate('/')}
                            className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Upload Image Memory
                        </Button>
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
                        items={items.filter(item => item.id !== 'upload-button')}
                        onImageClick={handleImageClick}
                    />
                </div>
            )}

            {/* Card View */}
            {arweaveImageMap.size > 0 && viewMode === 'card' && (
                <div className="absolute inset-0 z-10 overflow-visible">
                    <CardView
                        items={items.filter(item => item.id !== 'upload-button')}
                        onImageClick={handleImageClick}
                    />
                </div>
            )}

            {/* Floating Action Button */}
            <div className={cn(`fixed z-20 top-5 right-5`)}>
                <Button
                    className="bg-[#000DFF] text-white border border-[#2C2C2C] px-10 py-6 text-base font-medium rounded-md flex items-center gap-2"
                    variant="ghost"
                    size="lg"
                    onClick={handleUploadClick}
                >
                    <Upload className="w-4 h-4" />
                    {!isMobile ? "Preserve your memories" : "Upload"}
                </Button>
            </div>

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

            {/* Upload Modal */}
            <UploadModal
                isOpen={isUploadModalOpen}
                onClose={() => {
                    setIsUploadModalOpen(false)
                    setInitialFile(null)
                }}
                onUpload={handleModalUpload}
                initialFile={initialFile}
                uploadSurface='gallery'
            />

        </div >
    )
}

export default GalleryPage
