import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import { ImageIcon, Link as LinkIcon, Check, Download } from 'lucide-react'
import { Button } from './ui/button'
import { useIsMobile } from '../hooks/use-mobile'
import CopySharePopup from './copy-share-popup'
import { MemoriesLogo } from './landing-page'
import StampPreview from './stamp-preview'
import StampCaptureRenderer from './stamp-capture-renderer'
import { useStampCaptureShare } from '../hooks/use-stamp-capture-share'
import { getMemoryShareUrl, getMemoryTweetText } from '../utils/share'
import { buildArweaveTransactionUrl, fetchGraphqlWithGatewayFallback } from '@/lib/arweave-gateway'
import { HANDLE_PLATFORM_TAG, normalizeHandlePlatform, type HandlePlatform } from '@/utils/handle-links'

interface MemoryData {
    id: string
    title: string
    location: string
    handle: string
    handlePlatform: HandlePlatform
    description?: string
    imageUrl: string
    isPublic: boolean
}

const UploadedPage: React.FC = () => {
    const { transactionId } = useParams<{ transactionId: string }>()
    const navigate = useNavigate()
    const isMobile = useIsMobile()

    const [memoryData, setMemoryData] = useState<MemoryData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isPreserving, setIsPreserving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [linkCopied, setLinkCopied] = useState(false)
    const stampPreviewRef = useRef<HTMLDivElement>(null)
    const {
        capturedBlob,
        captureStampAsImage,
        handleShare,
        handleSharePopupClose,
        hiddenHorizontalRef,
        hiddenVerticalRef,
        isCapturing,
        isSharePopupOpen,
    } = useStampCaptureShare({
        captureLayout: isMobile ? 'vertical' : 'horizontal',
        memoryId: transactionId,
        shareSurface: 'uploaded_page',
    })

    useEffect(() => {
        if (!transactionId) {
            setError('No transaction ID provided')
            setIsLoading(false)
            return
        }

        loadMemoryData()
    }, [transactionId])

    const loadMemoryData = async () => {
        if (!transactionId) return

        try {
            setIsLoading(true)
            setIsPreserving(false)
            setError(null)

            // Fetch transaction metadata from Arweave
            const query = `
                query GetTransaction($id: ID!) {
                    transaction(id: $id) {
                        id
                        tags {
                            name
                            value
                        }
                    }
                }
            `

            const { data } = await fetchGraphqlWithGatewayFallback<{ transaction: { id: string; tags: { name: string; value: string }[] } | null }>(
                query,
                {
                    id: transactionId,
                },
                {
                    validateData: (data) => !!data.transaction, // Ensure transaction exists
                }
            )

            const transaction = data.transaction

            if (!transaction) {
                setMemoryData(null)
                setIsPreserving(true)
                return
            }

            // Parse tags
            const tags = transaction.tags.reduce((acc: Record<string, string>, tag: { name: string, value: string }) => {
                acc[tag.name] = tag.value
                return acc
            }, {})

            // Check if it's a valid memory (has our app tags)
            if (tags['App-Name'] !== 'Memories-App') {
                throw new Error('This transaction is not a memory from our app')
            }

            const memory: MemoryData = {
                id: transaction.id,
                title: tags.Title || 'Untitled Memory',
                location: tags.Location || '',
                handle: tags.Handle || '',
                handlePlatform: normalizeHandlePlatform(tags[HANDLE_PLATFORM_TAG]),
                description: tags.Description || '',
                imageUrl: buildArweaveTransactionUrl(transaction.id),
                isPublic: tags.Visibility === 'Public'
            }

            // Save to localStorage for gallery to use
            const uploadedMemory = {
                id: transaction.id,
                title: tags.Title || 'Untitled Memory',
                location: tags.Location || '',
                handle: tags.Handle || '',
                handlePlatform: normalizeHandlePlatform(tags[HANDLE_PLATFORM_TAG]),
                description: tags.Description || '',
                imageUrl: buildArweaveTransactionUrl(transaction.id),
                date: new Date().toISOString(),
                txid: transaction.id
            }
            localStorage.setItem('lastUploadedMemory', JSON.stringify(uploadedMemory))

            setMemoryData(memory)
        } catch (err) {
            console.error('Error loading memory:', err)
            if (err instanceof Error && err.message === 'Transaction not found') {
                setMemoryData(null)
                setIsPreserving(true)
                setError(null)
                return
            }
            setError(err instanceof Error ? err.message : 'Failed to load memory')
        } finally {
            setIsLoading(false)
        }
    }

    const getTweetText = () => {
        if (!memoryData) return ''
        return getMemoryTweetText(memoryData.title, getMemoryShareUrl(memoryData.id))
    }

    const handleGallery = () => {
        if (memoryData?.id) {
            navigate(`/gallery?highlight=${memoryData.id}`)
        } else {
            navigate('/gallery')
        }
    }

    const handleTelegramShare = () => {
        if (!memoryData) return

        const url = `${window.location.origin}/#/view/${memoryData.id}`
        const text = `Check out this memory "${memoryData.title}" preserved forever! 🌟\n\nView it at: ${window.location.origin}/#/view/${memoryData.id}\n\n(paste the copied image here and remove this text)`
        const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`

        window.open(telegramUrl, '_blank')
    }

    const handleWhatsAppShare = () => {
        if (!memoryData) return

        const url = `${window.location.origin}/#/view/${memoryData.id}`
        const text = `Check out this memory "${memoryData.title}" preserved forever! 🌟\n\nView it at: ${window.location.origin}/#/view/${memoryData.id}\n\n(paste the copied image here and remove this text)`
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`

        window.open(whatsappUrl, '_blank')
    }

    const handleCopyLink = async () => {
        if (!memoryData) return

        const url = `${window.location.origin}/#/view/${memoryData.id}`

        try {
            await navigator.clipboard.writeText(url)
            setLinkCopied(true)
            setTimeout(() => setLinkCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy link:', err)
        }
    }

    const handleDownloadImage = async () => {
        if (!capturedBlob) {
            // If we don't have the captured blob yet, capture it first
            const blob = await captureStampAsImage()
            if (!blob) {
                console.error('Failed to capture image')
                return
            }
            downloadBlob(blob)
        } else {
            // Use the existing captured blob
            downloadBlob(capturedBlob)
        }
    }

    const downloadBlob = (blob: Blob) => {
        if (!memoryData) return

        // Create a download link
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${memoryData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_memory_${memoryData.id}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                    <p className="text-white/70">Loading your memory...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <div className="text-red-400 text-xl">⚠️</div>
                    <h2 className="text-white font-semibold text-lg">Error Loading Memory</h2>
                    <p className="text-white/70 text-sm">{error}</p>
                    <Button onClick={handleGallery} className="bg-[#000DFF] text-white">
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Go to Gallery
                    </Button>
                </div>
            </div>
        )
    }

    if (isPreserving) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="text-center space-y-4 max-w-md">
                    <div className="text-white text-xl">⏳</div>
                    <h2 className="text-white font-semibold text-lg">We’re preserving your memory</h2>
                    <p className="text-white/70 text-sm">Your transaction is still being finalized on Arweave. Please check back in about 5 minutes.</p>
                    <Button onClick={handleGallery} className="bg-[#000DFF] text-white">
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Go to Gallery
                    </Button>
                </div>
            </div>
        )
    }

    if (!memoryData) return null

    return (
        <div className="min-h-screen bg-black relative overflow-hidden">
            {/* Header */}
            <div className="relative z-10 p-6">
                <MemoriesLogo />
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-6 py-8 gap-8">
                {/* Title Section */}
                <div className="text-center space-y-3 max-w-2xl">
                    <h1 className="text-white font-instrument text-4xl md:text-6xl leading-tight">
                        This memory is now permanent
                    </h1>
                    <p className="text-white/80 font-montserrat text-lg md:text-xl">
                        Preserved on Arweave for centuries.
                    </p>
                </div>

                {/* Visible Stamp Preview - vertical on mobile, horizontal on desktop */}
                <div ref={stampPreviewRef}>
                    <StampPreview
                        className={isMobile ? 'w-[80vw]' : 'w-[60vw]'}
                        headline={memoryData.title}
                        location={memoryData.location}
                        handle={memoryData.handle}
                        handlePlatform={memoryData.handlePlatform}
                        description={memoryData.description}
                        date={new Date().toLocaleDateString()}
                        imageSrc={memoryData.imageUrl}
                        layout={isMobile ? "vertical" : "horizontal"}
                    />
                </div>

                <StampCaptureRenderer
                    className={isMobile ? 'h-[900px]' : 'w-[900px]'}
                    hiddenHorizontalRef={hiddenHorizontalRef}
                    hiddenVerticalRef={hiddenVerticalRef}
                    isCapturing={isCapturing}
                    headline={memoryData.title}
                    location={memoryData.location}
                    handle={memoryData.handle}
                    handlePlatform={memoryData.handlePlatform}
                    description={memoryData.description}
                    date={new Date().toLocaleDateString()}
                    imageSrc={memoryData.imageUrl}
                />

                {/* Action Buttons */}
                <div className="flex flex-col items-center gap-4 w-full max-w-md">
                    <Button
                        onClick={handleShare}
                        disabled={isCapturing}
                        className="w-full bg-[#000DFF] text-white border border-[#2C2C2C] px-6 py-3 text-base font-medium rounded-md flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isCapturing ? 'Preparing...' : 'Share'}
                    </Button>

                    {/* Download Image Button */}
                    <Button
                        onClick={handleDownloadImage}
                        disabled={isCapturing}
                        variant="outline"
                        className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 px-6 py-3 text-base font-medium rounded-md flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        Download Image
                    </Button>

                    {/* Social Share Buttons */}
                    {/* <div className="grid grid-cols-2 gap-3 w-full">
                        <Button
                            onClick={handleTelegramShare}
                            variant="outline"
                            className="bg-[#0088cc]/10 border-[#0088cc]/30 text-white hover:bg-[#0088cc]/20 px-4 py-3 text-sm font-medium rounded-md flex items-center justify-center gap-2"
                        >
                            <Send className="w-4 h-4" />
                            Telegram
                        </Button>
                        <Button
                            onClick={handleWhatsAppShare}
                            variant="outline"
                            className="bg-[#25D366]/10 border-[#25D366]/30 text-white hover:bg-[#25D366]/20 px-4 py-3 text-sm font-medium rounded-md flex items-center justify-center gap-2"
                        >
                            <MessageCircle className="w-4 h-4" />
                            WhatsApp
                        </Button>
                    </div> */}

                    {memoryData.isPublic ? (
                        <Button
                            onClick={handleGallery}
                            variant="outline"
                            className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 px-6 py-3 text-base font-medium rounded-md flex items-center justify-center gap-2"
                        >
                            <ImageIcon className="w-4 h-4" />
                            Gallery
                        </Button>
                    ) : (
                        <Button
                            onClick={handleCopyLink}
                            variant="outline"
                            className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 px-6 py-3 text-base font-medium rounded-md flex items-center justify-center gap-2"
                        >
                            {linkCopied ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Link Copied!
                                </>
                            ) : (
                                <>
                                    <LinkIcon className="w-4 h-4" />
                                    Copy Link
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* Copy & Share Popup */}
            <CopySharePopup
                shareUrl={memoryData ? getMemoryShareUrl(memoryData.id) : ''}
                isOpen={isSharePopupOpen}
                onClose={handleSharePopupClose}
                polaroidBlob={capturedBlob}
                tweetText={getTweetText()}
                onTwitterOpen={handleSharePopupClose}
                memoryId={memoryData.id}
                shareSurface='uploaded_page'
            />
        </div>
    )
}

export default UploadedPage
