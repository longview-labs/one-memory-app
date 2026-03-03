import React, { useState, useCallback, useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { Upload } from 'lucide-react'
import { Button } from './ui/button'
import UploadModal, { type UploadData } from './upload-modal'
import { useIsMobile } from '../hooks/use-mobile'
import imageCompression from 'browser-image-compression';
import { ArconnectSigner, TurboFactory } from '@ardrive/turbo-sdk/web';
import permanentImage from "@/assets/permanent.png"
import { cn } from '@/lib/utils'
import StampPreview from './stamp-preview'
import { QuickWallet } from 'quick-wallet'
import { loadNSFWModel } from '@/lib/nsfw'

interface MemoryData {
    id: string
    imageUrl: string
    title: string
    location: string
    handle: string
    date: string
}


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

export async function uploadFileTurbo(file: File, api: any, tags: { name: string, value: string }[] = []) {
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
                { name: "Content-Type", value: file.type ?? "application/octet-stream" },
                { name: "Name", value: file.name ?? "unknown" },
                ...tags
            ],
        }
    })
    return res.id;
}

export function MemoriesLogo({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
    return <Link to="/"> <div className={cn("flex items-center drop-shadow shadow-black gap-4", theme === 'dark' ? 'invert' : '')}>
        <div className="h-9 flex-shrink-0">
            <img src="/logo.svg" alt="Memories" className="w-full h-full" />
        </div>
        {/* <div className="flex flex-col items-start justify-center relative -top-0.5">
            <h1 className="text-white font-instrument text-2xl md:text-4xl leading-none">
                <span className='font-extrabold'>one</span> <span className='!font-light'>moment</span>
            </h1>
            <span className="text-white text-[10px] mt-0.5 font-montserrat font-light">by arweave</span>
        </div> */}
    </div>
    </Link>
}

const LandingPage: React.FC = () => {
    const [isUploading, setIsUploading] = useState(false)
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const [randomMemories, setRandomMemories] = useState<MemoryData[]>([])
    const [isLoadingMemories, setIsLoadingMemories] = useState(true)
    const [prevConnected, setPrevConnected] = useState(null)
    const [startTime, setStartTime] = useState(Date.now())
    const isMobile = useIsMobile()
    const [isDragging, setIsDragging] = useState(false)
    const [initialFile, setInitialFile] = useState<File | null>(null)
    const api = QuickWallet
    const navigate = useNavigate()
    const address = QuickWallet.getActiveAddress()

    // Preload NSFW model when landing page mounts
    useEffect(() => {
        loadNSFWModel().catch(error => {
            console.error('Failed to preload NSFW model:', error)
        })
    }, [])

    async function handleImageUpload(file: File, uploadData: UploadData): Promise<string> {
        if (!api) throw new Error('Wallet not initialized not found');

        console.log('originalFile instanceof Blob', file instanceof Blob); // true
        console.log(`originalFile size ${file.size / 1024 / 1024} MB`);

        try {
            let finalFile = file;

            // Only compress if file is larger than 100KB
            if (file.size > 100 * 1024) {
                console.log('File is larger than 100KB, compressing...');
                finalFile = await imageCompression(file, compressionOptions);
                console.log('compressedFile instanceof Blob', finalFile instanceof Blob); // true
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

            // add Date tag if available
            if (uploadData.datetime) {
                extraTags.push({ name: "Date", value: uploadData.datetime })
            }

            const id = await uploadFileTurbo(finalFile, api, extraTags);
            console.log('id', id);
            return id;
        } catch (error) {
            console.log(error);
            return '';
        }
    }


    // Function to validate that the image is accessible on Arweave
    const validateArweaveImage = async (transactionId: string, maxRetries = 10, retryDelay = 3000): Promise<boolean> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Validating Arweave image (attempt ${attempt}/${maxRetries}): ${transactionId}`)

                const response = await fetch(`https://arweave.net/${transactionId}`, {
                    method: 'HEAD',
                    cache: 'no-cache'
                })

                if (response.ok) {
                    const contentType = response.headers.get('content-type')
                    if (contentType && contentType.startsWith('image/')) {
                        console.log('✅ Image successfully validated on Arweave')
                        return true
                    } else {
                        console.log('❌ Response is not an image, content-type:', contentType)
                    }
                } else {
                    console.log(`❌ HTTP ${response.status}: ${response.statusText}`)
                }
            } catch (error) {
                console.log(`❌ Validation attempt ${attempt} failed:`, error)
            }

            // Wait before retrying (except on the last attempt)
            if (attempt < maxRetries) {
                console.log(`⏳ Waiting ${retryDelay}ms before retry...`)
                await new Promise(resolve => setTimeout(resolve, retryDelay))
            }
        }

        console.log('❌ Failed to validate image after all attempts')
        return false
    }

    const handleModalUpload = async (uploadData: UploadData) => {

        setIsUploading(true)

        try {
            console.log('Upload data:', uploadData)

            // Upload the image to Arweave
            const id = await handleImageUpload(uploadData.file, uploadData)
            console.log('Upload completed, transaction ID:', id);

            if (!id) {
                throw new Error('Upload failed: No transaction ID returned')
            }

            // Validate that the image is accessible on Arweave before navigating
            console.log('🔍 Validating image accessibility on Arweave...')
            const isValid = await validateArweaveImage(id)

            if (isValid) {
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
            // You might want to show a user-friendly error message here
            alert(error instanceof Error ? error.message : 'Upload failed. Please try again.')
        } finally {
            setIsUploading(false)
        }
    }

    const handleUploadClick = () => {
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

    const handleExploreGallery = useCallback(() => {
        navigate('/gallery')
    }, [navigate])

    // Use two static placeholder stamps instead of fetching from Arweave
    useEffect(() => {
        const placeholders: MemoryData[] = [
            {
                id: 'placeholder-1',
                imageUrl: '',
                title: 'Your first memory',
                location: 'ANYWHERE, EARTH',
                handle: 'YOU',
                date: 'TODAY'
            },
            {
                id: 'placeholder-2',
                imageUrl: '',
                title: 'Your first memory',
                location: 'ANYWHERE, EARTH',
                handle: 'YOU',
                date: 'TODAY'
            }
        ]

        setRandomMemories(placeholders)
        setIsLoadingMemories(false)
    }, [])

    return (
        <div
            className="flex flex-col min-h-screen h-auto md:h-screen bg-black relative overflow-scroll md:overflow-hidden"
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

            {/* Header */}
            <div className="z-10 left-0 right-0 p-6">
                <MemoriesLogo />
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex-1 px-6 md:px-16 pb-10 overflow-hidden">
                {/* Welcome Section - Always Visible */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
                    {/* Left Content */}
                    <div className="relative space-y-10 self-center pt-6 md:pt-0 lg:-top-10">
                        <div className="space-y-6">
                            <h2 className="text-white font-instrument text-5xl md:text-8xl md:leading-[90px]">
                                Your memories <br />can last forever
                            </h2>
                            <p className="font-montserrat text-white text-xl leading-relaxed">
                                Save your favourite photo memory, forever<br /> Seriously, no strings attached, own your memories with Arweave,<br /> upload now.
                            </p>
                        </div>

                        <div className="flex flex-col items-start gap-5">
                            <Button
                                className="bg-[#000DFF] h-16 text-white border border-[#2C2C2C] px-10 py-4 text-xl font-semibold rounded-md flex items-center gap-3 hover:bg-[#0008CC] transition-colors"
                                variant="ghost"
                                size="lg"
                                onClick={handleUploadClick}
                            >
                                <Upload className="w-5 h-5" />
                                Preserve your memories
                            </Button>
                            <Button
                                variant="link"
                                onClick={handleExploreGallery}
                                className="p-0 m-0 text-xl text-muted-foreground font-normal hover:no-underline hover:text-foreground"
                            >
                                or <span className="underline">explore the gallery</span>
                            </Button>
                        </div>
                    </div>

                    {/* Right Content - Stamp Preview */}
                    <div className="flex justify-center items-center">
                        <div className="relative w-full md:max-w-lg left-4 md:left-0">
                            {isLoadingMemories ? (
                                <div className="flex items-center justify-center">
                                    <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                </div>
                            ) : randomMemories.length >= 2 ? (
                                <>
                                    {/* First postcard - back layer */}
                                    <div className="absolute h-full transform -rotate-5 -translate-x-10 md:-rotate-10 md:-translate-x-20 md:translate-y-10 translate-y-5 opacity-90 hover:opacity-80 transition-all duration-300 cursor-pointer" onClick={() => navigate(`/view/${randomMemories[0].id}`)}>
                                        <StampPreview
                                            headline={randomMemories[0].title}
                                            location={randomMemories[0].location}
                                            handle={randomMemories[0].handle}
                                            date={randomMemories[0].date}
                                            imageSrc={randomMemories[0].imageUrl}
                                            layout={isMobile ? "horizontal" : "vertical"}
                                        />
                                    </div>

                                    {/* Second postcard - front layer */}
                                    <div className="relative transform rotate-2 -translate-x-3 hover:rotate-0 transition-transform duration-300 cursor-pointer" onClick={() => navigate(`/view/${randomMemories[1].id}`)}>
                                        <StampPreview
                                            headline={randomMemories[1].title}
                                            location={randomMemories[1].location}
                                            handle={randomMemories[1].handle}
                                            date={randomMemories[1].date}
                                            imageSrc={randomMemories[1].imageUrl}
                                            layout={isMobile ? "horizontal" : "vertical"}
                                        />
                                    </div>
                                </>
                            ) : randomMemories.length === 1 ? (
                                <div className="relative transform hover:scale-105 transition-transform duration-300 cursor-pointer" onClick={() => navigate(`/view/${randomMemories[0].id}`)}>
                                    <StampPreview
                                        headline={randomMemories[0].title}
                                        location={randomMemories[0].location}
                                        handle={randomMemories[0].handle}
                                        date={randomMemories[0].date}
                                        imageSrc={randomMemories[0].imageUrl}
                                        layout={isMobile ? "horizontal" : "vertical"}
                                    />
                                </div>
                            ) : (
                                <>
                                    {/* Fallback to placeholder postcards */}
                                    <div className="absolute transform -rotate-10 -translate-x-20 translate-y-10 opacity-90 hover:opacity-80 transition-all duration-300">
                                        <StampPreview
                                            headline="Your first memory"
                                            location="ANYWHERE, EARTH"
                                            handle="@YOU"
                                            date="TODAY"
                                            imageSrc=""
                                            layout="vertical"
                                        />
                                    </div>

                                    <div className="relative transform rotate-3 hover:rotate-0 transition-transform duration-300">
                                        <StampPreview
                                            headline="Your first memory"
                                            location="ANYWHERE, EARTH"
                                            handle="@YOU"
                                            date="TODAY"
                                            imageSrc=""
                                            layout="vertical"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            {/* <div className="relative z-10 px-6 md:px-16 py-10 md:py-0 md:-top-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs md:text-sm">
                    <div className="flex flex-col md:flex-row md:w-1/2 justify-between">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-white/60">
                            <span>Learn more about</span>
                            <a href="https://arweave.org" target="_blank" rel="noopener noreferrer" className="text-muted-foreground underline underline-offset-4 hover:text-white/80 transition-colors p-0">
                                Arweave
                            </a>
                            <span>and the</span>
                            <a href="https://permaweb.org" target="_blank" rel="noopener noreferrer" className="text-muted-foreground underline underline-offset-4 hover:text-white/80 transition-colors p-0">
                                Permaweb
                            </a>
                        </div>

                        <span className="text-white/60 text-center">© 2025 Memories by Arweave. All rights reserved.</span>
                    </div>
                    <img src={permanentImage} alt="Permanent" className="h-14" draggable={false} />
                </div>
            </div> */}

            {/* Upload Modal */}
            <UploadModal
                isOpen={isUploadModalOpen}
                onClose={() => {
                    setIsUploadModalOpen(false)
                    setInitialFile(null)
                }}
                onUpload={handleModalUpload}
                initialFile={initialFile}
            />

            <div className='absolute bottom-2 left-2 z-20'>
                <Link to="/tnc" className='text-xs text-muted-foreground/80 px-1'>Terms & Conditions</Link>
            </div>
        </div>
    )
}
export default LandingPage;

