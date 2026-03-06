import React, { useState, useRef, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Upload, Image as ImageIcon, ArrowLeft, Check, Loader2, MoveLeft, Compass, X, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { useIsMobile } from '../hooks/use-mobile'
import { MemoriesLogo } from './landing-page'
import StampPreview from './stamp-preview'
import { cn } from '@/lib/utils'
import postcardV from '@/assets/postcard-v.svg'
import postcardH from '@/assets/postcard-h.svg'
import { Toggle } from './ui/toggle'
import { Switch } from './ui/switch'
import { Checkbox } from './ui/checkbox'
import { QuickWallet } from 'quick-wallet'
import convertHEIC from 'heic-convert/browser'
import ExifReader from 'exifreader'
import { checkNSFW } from '@/lib/nsfw'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from './ui/command'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from './ui/sheet'
import { Link } from 'react-router'
import { Textarea } from './ui/textarea'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { trackUploadSubmitted, type UploadSurface } from '@/lib/analytics'

interface UploadModalProps {
    isOpen: boolean
    onClose: () => void
    onUpload?: (data: UploadData) => void
    initialFile?: File | null
    uploadSurface: UploadSurface
}

export interface UploadData {
    file: File
    title: string
    location: string
    handle: string
    description?: string
    isPublic: boolean
    datetime?: string
}

const LOCATION_OPTIONS = [
    { value: 'Paris, France', label: 'Paris, France' },
    { value: 'Tokyo, Japan', label: 'Tokyo, Japan' },
    { value: 'New York, USA', label: 'New York, USA' },
    { value: 'London, UK', label: 'London, UK' },
    { value: 'Sydney, Australia', label: 'Sydney, Australia' },
    { value: 'Barcelona, Spain', label: 'Barcelona, Spain' },
    { value: 'Rome, Italy', label: 'Rome, Italy' },
    { value: 'Amsterdam, Netherlands', label: 'Amsterdam, Netherlands' },
    { value: 'Prague, Czech Republic', label: 'Prague, Czech Republic' },
    { value: 'Santorini, Greece', label: 'Santorini, Greece' },
    { value: 'Bali, Indonesia', label: 'Bali, Indonesia' },
    { value: 'Kyoto, Japan', label: 'Kyoto, Japan' },
    { value: 'Reykjavik, Iceland', label: 'Reykjavik, Iceland' }
]

const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onUpload, initialFile, uploadSurface }) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [title, setTitle] = useState('')
    const MAX_TITLE_LENGTH = 30
    const MAX_DESCRIPTION_LENGTH = 120
    const [location, setLocation] = useState('')
    const [handle, setHandle] = useState('')
    const [description, setDescription] = useState('')
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false)
    const [datetime, setDatetime] = useState('')
    const [isPublic, setIsPublic] = useState(true)
    const [isProcessing, setIsProcessing] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [mobileStep, setMobileStep] = useState<1 | 2>(1) // 1: input details, 2: preview & upload
    const [blockedReason, setBlockedReason] = useState<string | null>(null)
    const [locationOptions, setLocationOptions] = useState<{ value: string; label: string }[]>(LOCATION_OPTIONS)
    const [isLoadingLocations, setIsLoadingLocations] = useState(false)
    const [hasRequestedGeolocation, setHasRequestedGeolocation] = useState(false)
    const [isLocationSheetOpen, setIsLocationSheetOpen] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const isMobile = useIsMobile()
    // Force vertical orientation on mobile
    const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('vertical')
    // const address = useActiveAddress()
    // const api = useApi()
    // const { setOpen } = useProfileModal()
    const address = QuickWallet.getActiveAddress()
    const api = QuickWallet

    const fetchNearbyLocations = async (lat: number, lon: number) => {
        setIsLoadingLocations(true)
        try {
            const response = await fetch(
                `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=40`
            )
            const data = await response.json()

            const suggestions = data.features.map((feature: any) => {
                const name = feature.properties.name || feature.properties.city || feature.properties.town || feature.properties.village
                const country = feature.properties.country
                const state = feature.properties.state

                let label = name
                if (state && state !== name) label += `, ${state}`
                if (country) label += `, ${country}`

                // Calculate distance from user's location
                const featureLat = feature.geometry.coordinates[1]
                const featureLon = feature.geometry.coordinates[0]
                const distance = Math.sqrt(
                    Math.pow(lat - featureLat, 2) + Math.pow(lon - featureLon, 2)
                )

                return {
                    value: label,
                    label: label,
                    distance
                }
            }).filter((item: any) => item.value)
                .sort((a: any, b: any) => a.distance - b.distance)

            // Remove duplicates from nearby locations
            const seen = new Set<string>()
            const uniqueSuggestions = suggestions
                .filter((item: any) => {
                    const normalizedValue = item.value.toLowerCase().trim()
                    if (seen.has(normalizedValue)) {
                        return false
                    }
                    seen.add(normalizedValue)
                    return true
                })
                .map(({ value, label }: any) => ({ value, label }))

            setLocationOptions(uniqueSuggestions.length > 0 ? uniqueSuggestions : LOCATION_OPTIONS)
        } catch (error) {
            console.error('Error fetching nearby locations:', error)
            setLocationOptions(LOCATION_OPTIONS)
        } finally {
            setIsLoadingLocations(false)
        }
    }

    const requestGeolocation = async () => {
        if (hasRequestedGeolocation) return

        setHasRequestedGeolocation(true)

        if (!navigator.geolocation) {
            console.log('Geolocation not supported')
            return
        }

        try {
            setIsLoadingLocations(true)
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords
                    fetchNearbyLocations(latitude, longitude)
                },
                (error) => {
                    console.error('Geolocation error:', error)
                    setIsLoadingLocations(false)
                    setLocationOptions(LOCATION_OPTIONS)
                },
                {
                    timeout: 10000,
                    enableHighAccuracy: false
                }
            )
        } catch (error) {
            console.error('Error requesting geolocation:', error)
            setIsLoadingLocations(false)
            setLocationOptions(LOCATION_OPTIONS)
        }
    }

    const fetchLocationSuggestions = useMemo(() => {
        let timeoutId: NodeJS.Timeout
        return async (query: string) => {
            clearTimeout(timeoutId)

            if (query.length < 2) {
                setLocationOptions(LOCATION_OPTIONS)
                return
            }

            timeoutId = setTimeout(async () => {
                setIsLoadingLocations(true)
                try {
                    const response = await fetch(
                        `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=40`
                    )
                    const data = await response.json()

                    const suggestions = data.features.map((feature: any) => {
                        const name = feature.properties.name || feature.properties.city || feature.properties.town || feature.properties.village
                        const country = feature.properties.country
                        const state = feature.properties.state

                        let label = name
                        if (state && state !== name) label += `, ${state}`
                        if (country) label += `, ${country}`

                        return {
                            value: label,
                            label: label
                        }
                    }).filter((item: any) => item.value)

                    // Add user's typed text as first option
                    const customOption = { value: query, label: query }

                    // Remove duplicates by tracking seen values
                    const seen = new Set<string>()
                    const uniqueSuggestions = [customOption, ...suggestions].filter((item) => {
                        const normalizedValue = item.value.toLowerCase().trim()
                        if (seen.has(normalizedValue)) {
                            return false
                        }
                        seen.add(normalizedValue)
                        return true
                    })

                    setLocationOptions(uniqueSuggestions.length > 0 ? uniqueSuggestions : [customOption, ...LOCATION_OPTIONS])
                } catch (error) {
                    console.error('Error fetching locations:', error)
                    // On error, still show user's typed text as first option
                    setLocationOptions([{ value: query, label: query }, ...LOCATION_OPTIONS])
                } finally {
                    setIsLoadingLocations(false)
                }
            }, 300)
        }
    }, [])

    const compressImage = async (file: File): Promise<File> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Failed to get canvas context'));
                        return;
                    }

                    // Calculate new dimensions (max 1920x1080 while maintaining aspect ratio)
                    let width = img.width;
                    let height = img.height;
                    const maxWidth = 1920;
                    const maxHeight = 1080;

                    if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                        width = width * ratio;
                        height = height * ratio;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error('Failed to compress image'));
                                return;
                            }
                            const compressedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve(compressedFile);
                        },
                        'image/jpeg',
                        0.85 // quality
                    );
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target?.result as string;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    };

    const handleNewFile = useMemo(() => {
        return async (file: File) => {
            if (!file.type.startsWith('image/')) return;

            // reset previous metadata and errors
            setDatetime('');
            setLocation('');
            setBlockedReason(null);

            setIsProcessing(true);

            try {
                // extract Exif metadata
                const tags = await ExifReader.load(file);
                const imageDate = tags['DateTimeOriginal']?.description;
                const imageLongitude = tags['GPSLongitude']?.description;
                const imageLatitude = tags['GPSLatitude']?.description;

                // set datetime if available
                if (imageDate) {
                    // datetime can be provided in format "YYYY:MM:DD HH:MM:SS", convert to "YYYY-MM-DD HH:MM:SS"
                    const formattedDate = imageDate.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
                    // make sure it's a valid date & convert to ISO format
                    if (!isNaN(Date.parse(formattedDate))) {
                        const dateTimeISO = new Date(formattedDate).toISOString();
                        setDatetime(dateTimeISO);
                    }
                }

                // reverse geocode to get location name if GPS data is available
                if (imageLongitude && imageLatitude) {
                    const url = `https://nominatim.openstreetmap.org/reverse?lat=${imageLatitude}&lon=${imageLongitude}&format=json`;
                    const response = await fetch(url);
                    const data = await response.json();
                    if (data && data.name) {
                        setLocation(data.name);
                    }
                }
            } catch (error) {
                console.error('Error reading Exif data or reverse geocoding:', error);
            }


            // Check if it's a HEIC/HEIF file (by extension or MIME type)
            const isHeic = file.type === 'image/heic' ||
                file.type === 'image/heif' ||
                file.name.toLowerCase().endsWith('.heic') ||
                file.name.toLowerCase().endsWith('.heif')

            if (isHeic) {
                try {
                    // Convert HEIC to JPEG
                    const buffer = await file.arrayBuffer()
                    const output = await convertHEIC({
                        buffer: new Uint8Array(buffer),
                        format: 'JPEG',
                        quality: 1,
                    })
                    const blob = new Blob([output], { type: 'image/jpeg' })
                    file = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' })
                } catch (error) {
                    console.error('Error converting HEIC image:', error)
                    toast.error('Failed to process HEIC image. Please try a different image format.')
                    setIsProcessing(false)
                    return
                }
            }

            // Compress the image
            try {
                file = await compressImage(file);
            } catch (error) {
                console.error('Error compressing image:', error);
                toast.error('Failed to compress image. Please try a different image.');
                setIsProcessing(false);
                return;
            }

            // NSFW check after compression using nsfwjs
            try {
                // Create an image element to load the file
                const img = new Image();
                const imageUrl = URL.createObjectURL(file);

                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = imageUrl;
                });

                // Check for NSFW content
                const result = await checkNSFW(img);

                // Clean up the object URL
                URL.revokeObjectURL(imageUrl);

                if (result.unsafe) {
                    setBlockedReason(result.reason || 'This image was flagged as unsafe and cannot be uploaded.');
                    setIsProcessing(false);
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    return;
                }
            } catch (err) {
                console.error('Error checking image for unsafe content:', err);
                // Continue with upload if NSFW check fails - don't block the user
                // setBlockedReason('Error checking image for unsafe content.');
                // setIsProcessing(false);
                // setSelectedFile(null);
                // setPreviewUrl(null);
                // return;
            }

            setIsProcessing(false)
            setSelectedFile(file)
            const url = URL.createObjectURL(file)
            setPreviewUrl(url)
        }
    }, [])

    // Handle initial file when provided
    useEffect(() => {
        if (isOpen && initialFile) {
            handleNewFile(initialFile)
        }
    }, [isOpen, initialFile, handleNewFile])

    // Reset uploading state, mobile step, and error when modal closes
    useEffect(() => {
        if (!isOpen) {
            setIsUploading(false)
            setMobileStep(1)
            setUploadError(null)
        }
    }, [isOpen])

    // Force vertical orientation on mobile
    useEffect(() => {
        if (isMobile) {
            setOrientation('vertical')
        }
    }, [isMobile])

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        handleNewFile(file)
    }

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value || ''
        setTitle(v.slice(0, MAX_TITLE_LENGTH))
    }

    const handleSetTitle = (v: string) => {
        setTitle((v || '').slice(0, MAX_TITLE_LENGTH))
    }

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setDescription((e.target.value || '').slice(0, MAX_DESCRIPTION_LENGTH))
    }

    const handleReselect = () => {
        fileInputRef.current?.click()
    }

    const handleDragOver = (event: React.DragEvent) => {
        event.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (event: React.DragEvent) => {
        event.preventDefault()
        setIsDragging(false)
    }

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault()
        setIsDragging(false)
        const file = event.dataTransfer.files[0]
        if (!file) return
        handleNewFile(file)
    }

    const handleSubmit = async (event?: React.FormEvent | React.MouseEvent) => {
        event?.preventDefault()

        // Define default placeholder values to ignore
        const defaultTitle = 'Your Memory'
        const defaultLocation = 'Memory Location'
        const defaultHandle = 'Your Handle'

        // Check if actual values have been provided (not just defaults)
        const hasValidTitle = title.trim() && title !== defaultTitle
        const hasValidLocation = location.trim() && location.toUpperCase() !== defaultLocation
        const hasValidHandle = handle.trim() && handle !== defaultHandle
        const hasDescription = description.trim().length > 0
        const hasDatetime = Boolean(datetime)
        const isBaseValid = Boolean(selectedFile && hasValidTitle && hasValidLocation && hasValidHandle)

        trackUploadSubmitted({
            surface: uploadSurface,
            isValid: isBaseValid && description.length <= MAX_DESCRIPTION_LENGTH,
            fileType: selectedFile?.type,
            fileSizeBytes: selectedFile?.size,
            hasDescription,
            hasDatetime,
            isPublic,
            blockedReason: blockedReason || undefined,
        })

        if (!selectedFile || !hasValidTitle || !hasValidLocation || !hasValidHandle) {
            setUploadError('Please fill in all fields: title, location, and handle')
            return
        }

        if (description.length > MAX_DESCRIPTION_LENGTH) {
            setUploadError(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`)
            return
        }


        setIsUploading(true)
        setUploadError(null) // Clear any previous errors

        try {
            const uploadData: UploadData = {
                file: selectedFile,
                title: title.trim(),
                location: location.trim(),
                handle: handle.trim(),
                description: description.trim() || undefined,
                isPublic: isPublic,
                datetime: datetime || undefined
            }

            await onUpload?.(uploadData)
            // Don't close here - let the parent component handle navigation
            // handleClose() will be called by parent after successful upload
        } catch (error) {
            console.error('Upload failed:', error)
            setUploadError(error instanceof Error ? error.message : 'Upload failed. Please try again.')
            setIsUploading(false) // Re-enable the upload button
        }
    }

    const handleClose = () => {
        setSelectedFile(null)
        setPreviewUrl(null)
        setTitle('')
        setLocation('')
        setHandle('')
        setDescription('')
        setIsDescriptionOpen(false)
        setDatetime('')
        setIsUploading(false)
        setMobileStep(1)
        setUploadError(null)
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl)
        }
        onClose()
    }

    const handleBackdropClick = (e: React.MouseEvent) => {
        // Only allow backdrop click to close on mobile
        if (e.target === e.currentTarget && !isUploading && isMobile) {
            handleClose()
        }
    }

    const handleNextStep = () => {
        if (selectedFile && title.trim() && title.trim().length <= MAX_TITLE_LENGTH && handle.trim() && location.trim()) {
            setMobileStep(2)
        }
    }

    const handleBackStep = () => {
        setMobileStep(1)
    }

    const submitDisabled = !selectedFile || title.trim().length === 0 || title.trim().length > MAX_TITLE_LENGTH || description.length > MAX_DESCRIPTION_LENGTH || !handle.trim() || !location.trim() || isUploading || !!blockedReason

    if (!isOpen) return null

    return (
        <div
            className={cn(
                "fixed md:p-4 inset-0 h-full bg-black/60 backdrop-blur-md z-50 flex items-center gap-0",
                isMobile ? "flex-col overflow-y-auto" : "justify-center"
            )}
            onClick={handleBackdropClick}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden absolute"
                disabled={isProcessing}
            />
            <div className={cn(
                "relative flex-1 bg-gradient-to-br overflow-scroll from-white via-white flex flex-col h-full to-purple-50 shadow-2xl rounded-lg !font-montserrat",
                isMobile ? "p-4 gap-4 max-w-full my-auto rounded-none" : "p-6 gap-6 max-w-xl max-h-[90vh] overflow-y-auto rounded-r-none"
            )}>
                <button
                    onClick={handleClose}
                    disabled={isUploading}
                    className='absolute top-4 left-4 z-50 p-2 rounded-full hover:bg-black/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                    aria-label='Close'
                >
                    <ArrowLeft className='!w-5 !h-5 text-black/50' />
                </button>
                {/* <div className=''>
                    <MemoriesLogo theme='dark' />
                </div> */}
                <div onClick={handleClose} className='text-muted-foreground flex gap-1 items-center justify-center text-sm'>
                    New Permanent Memory
                </div>

                <form onSubmit={handleSubmit} className={cn(
                    'rounded-lg border-0 h-full border-black/20 text-black flex flex-col',
                    isMobile ? 'p-0 gap-4' : 'p-6 gap-6',
                )}>

                    {isMobile && <StampPreview
                        headline={title}
                        location={location}
                        handle={handle}
                        description={description}
                        noText
                        date={datetime ? new Date(datetime).toLocaleDateString() : new Date().toLocaleDateString()}
                        imageSrc={previewUrl}
                        layout={orientation}
                        onReselect={handleReselect}
                        isProcessing={isProcessing}
                        onHeadlineChange={handleSetTitle}
                        onLocationChange={setLocation}
                        onHandleChange={setHandle}
                    />}

                    <div className='flex flex-col gap-2'>
                        {/* <div className={cn('font-extralight font-instrument', isMobile ? 'text-xl' : 'text-3xl')}>
                            Title your memory
                        </div> */}
                        <div className='relative'>
                            <Input
                                placeholder='Name this memory'
                                className={cn('rounded-none font-montserrat border-0 placeholder:font-light border-b border-black/20 focus-visible:ring-0 focus-visible:ring-offset-0 p-1 h-7 !text-lg', isMobile ? 'text-sm' : '')}
                                value={title}
                                onChange={(e) => handleTitleChange(e)}
                                required
                                disabled={isUploading}
                                maxLength={MAX_TITLE_LENGTH}
                            />
                            <div className='absolute right-0 top-0 text-xs text-muted-foreground/70 mt-1 mr-1'>
                                {title.length}/{MAX_TITLE_LENGTH}
                            </div>
                        </div>
                    </div>
                    <div className={cn('grid gap-2 md:grid-cols-2')}>
                        <div className='relative w-full'>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsLocationSheetOpen(true)
                                    requestGeolocation()
                                }}
                                disabled={isUploading}
                                className='flex items-center justify-between w-full pl-8 pr-8 py-5 h-10 rounded-lg border border-gray-300 bg-[#F5F5F5] hover:bg-[#F5F5F5] focus-visible:ring-0 focus-visible:ring-offset-0 text-left disabled:opacity-50 disabled:cursor-not-allowed'
                            >
                                <span className={cn('truncate text-[#2C2C2C]')}>
                                    {location || 'Add Location'}
                                </span>
                            </button>
                            <svg className='absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2C2C2C] pointer-events-none z-10' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <svg className='absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2C2C2C] pointer-events-none z-10' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                        <div className='relative w-full'>
                            <Input
                                placeholder='Add your X/Instagram/TG handle'
                                className='pl-8 pr-8 py-5 text-[#2C2C2C] !placeholder-[#2C2C2C] rounded-lg border border-gray-300 !bg-[#F5F5F5] focus-visible:ring-0 focus-visible:ring-offset-0'
                                value={handle}
                                onChange={(e) => setHandle(e.target.value)}
                                disabled={isUploading}
                            />
                            <svg className='absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2C2C2C]' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <svg className='absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2C2C2C]' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                        {/* <div className='relative'>
                            <Input
                                placeholder='Date'
                                className='pl-8 pr-8 py-5 rounded-lg border border-gray-300 !bg-[#F5F5F5] focus-visible:ring-0 focus-visible:ring-offset-0'
                                value={new Date(datetime).toLocaleDateString()}
                                onChange={(e) => setDatetime(e.target.value)}
                                disabled={isUploading}
                            />
                            <svg className='absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <svg className='absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div> */}
                    </div>
                    <Collapsible open={isDescriptionOpen} onOpenChange={setIsDescriptionOpen}>
                        <div className='flex flex-col gap-2 rounded-lg border border-gray-300 bg-[#F5F5F5] p-3'>
                            <CollapsibleTrigger asChild>
                                <button
                                    type='button'
                                    className='flex w-full items-center justify-between text-left text-[#2C2C2C]'
                                    disabled={isUploading}
                                >
                                    <span>Add Description (Optional)</span>
                                    {isDescriptionOpen ? <ChevronUp className='h-5 w-5' /> : <ChevronDown className='h-5 w-5' />}
                                </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <div className='mt-2 flex flex-col gap-1'>
                                    <Textarea
                                        value={description}
                                        onChange={handleDescriptionChange}
                                        maxLength={MAX_DESCRIPTION_LENGTH}
                                        disabled={isUploading}
                                        placeholder='Add a short description...'
                                        className='min-h-20 resize-none border-gray-300 bg-white text-[#2C2C2C] placeholder:text-[#2C2C2C]/60 focus-visible:ring-0 focus-visible:ring-offset-0'
                                    />
                                    <div className='text-right text-xs text-[#B3B3B3]'>
                                        {description.length}/{MAX_DESCRIPTION_LENGTH}
                                    </div>
                                </div>
                            </CollapsibleContent>
                        </div>
                    </Collapsible>
                    {/* <div className='flex flex-col gap-2'>
                        <div className={cn('font-extralight font-instrument', isMobile ? 'text-xl' : 'text-3xl')}>
                            Twitter handle <span className='text-red-500'>*</span>
                        </div>
                        <Input
                            placeholder='@handle'
                            className={cn('w-full border border-black/20 rounded-lg', isMobile ? 'p-3 text-sm' : 'p-5')}
                            value={handle}
                            onChange={(e) => setHandle(e.target.value)}
                            required
                            disabled={isUploading}
                        />
                    </div> */}
                    {/* <div className='flex gap-5'>
                        <div className='flex flex-1 flex-col gap-2'>
                            <div className={cn('font-extralight font-instrument', isMobile ? 'text-xl' : 'text-3xl')}>
                                Location <span className='text-red-500'>*</span>
                            </div>
                            <Input
                                placeholder='Anywhere, Earth'
                                className={cn('w-full border border-black/20 rounded-lg', isMobile ? 'p-3 text-sm' : 'p-5')}
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                required
                                disabled={isUploading}
                            />
                        </div>
                        {
                            datetime ?
                                (
                                    <div className='flex flex-1 flex-col gap-2'>
                                        <div className={cn('font-extralight font-instrument', isMobile ? 'text-xl' : 'text-3xl')}>
                                            Date
                                        </div>
                                        <Input
                                            placeholder='YYYY-MM-DD HH:MM:SS'
                                            className={cn('w-full border border-black/20 rounded-lg', isMobile ? 'p-3 text-sm' : 'p-5')}
                                            value={datetime}
                                            disabled
                                        />
                                    </div>
                                )
                                : null
                        }
                    </div> */}
                    <div className='flex flex-col gap-2 border-b border-muted-foreground/70 pb-4'>
                        <div className={cn('font-montserrat flex gap-2 pl-0.5 justify-center items-start')}>
                            <div className='flex flex-col w-full gap-1'>
                                <div className='flex gap-2 justify-center items-center w-full font-light'>
                                    <Compass className='w-4.5 h-4.5 text-[#2C2C2C] ml-1.5' />
                                    <span className='text-md text-[#2C2C2C]'>Feature in explore</span>
                                    <Switch
                                        className='ml-auto relative scale-115 mr-1'
                                        checked={isPublic}
                                        onCheckedChange={setIsPublic}
                                    />
                                </div>
                                <div className='text-[13.5px] pl-1.5 antialiased font-medium text-[#B3B3B3] font-montserrat leading-4.5 tracking-tight'>
                                    Uploaded photo memories will be publicly visible in the gallery alongside memories from the community
                                </div>
                            </div>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                            disabled={isProcessing}
                        />
                        {/* <div
                            className={cn(
                                'w-full border-2 border-dashed rounded-lg transition-all',
                                isMobile ? 'h-32 p-3' : 'h-40 p-5',
                                isUploading
                                    ? 'cursor-not-allowed opacity-50'
                                    : 'cursor-pointer',
                                isDragging && !isUploading
                                    ? 'border-purple-500 bg-purple-50'
                                    : 'border-black/20 hover:border-black/40 hover:bg-gray-50',
                                isProcessing && 'cursor-not-allowed opacity-75'
                            )}
                            onDragOver={!isUploading && !isProcessing ? handleDragOver : undefined}
                            onDragLeave={!isUploading && !isProcessing ? handleDragLeave : undefined}
                            onDrop={!isUploading && !isProcessing ? handleDrop : undefined}
                            onClick={!isUploading && !isProcessing ? () => fileInputRef.current?.click() : undefined}
                        >
                            <div className='flex flex-col items-center justify-center h-full gap-2'>
                                {isProcessing ? (
                                    <>
                                        <Loader2 className={cn(
                                            'animate-spin text-blue-600',
                                            isMobile ? 'w-6 h-6' : 'w-8 h-8'
                                        )} />
                                        <p className={cn('font-medium text-gray-600 text-center px-2', isMobile ? 'text-xs' : 'text-sm')}>
                                            Processing image...
                                        </p>
                                        <p className='text-xs text-gray-500'>Extracting metadata</p>
                                    </>
                                ) : selectedFile && previewUrl ? (
                                    <>
                                        <div className={cn(
                                            'rounded-lg overflow-hidden border border-gray-300 bg-gray-100',
                                            isMobile ? 'w-16 h-16' : 'w-20 h-20'
                                        )}>
                                            <img
                                                src={previewUrl}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <p className={cn('font-medium text-gray-700 text-center px-2 line-clamp-1', isMobile ? 'text-xs' : 'text-sm')}>{selectedFile.name}</p>
                                        <p className='text-xs text-gray-500'>Click to change</p>
                                    </>
                                ) : (
                                    <>
                                        <Upload className={cn(
                                            'transition-colors',
                                            isMobile ? 'w-6 h-6' : 'w-8 h-8',
                                            isDragging ? 'text-purple-600' : 'text-gray-400'
                                        )} />
                                        <p className={cn('font-medium text-gray-600 text-center px-2', isMobile ? 'text-xs' : 'text-sm')}>
                                            {isDragging ? 'Drop your image here' : isMobile ? 'Click to upload' : 'Click to upload or drag and drop'}
                                        </p>
                                        <p className='text-xs text-gray-500'>{isMobile ? 'Up to 10MB' : 'PNG, JPG, GIF up to 10MB'}</p>
                                    </>
                                )}
                            </div>
                        </div> */}
                    </div>
                    {uploadError && (
                        <div className='text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3'>
                            {uploadError}
                        </div>
                    )}
                    {blockedReason && (
                        <div className='flex flex-col items-center justify-center gap-2 my-4 p-4 border-2 border-red-700 bg-red-100 text-red-900 rounded-xl shadow-lg'>
                            <span className='font-bold text-lg'>Upload Blocked!</span>
                            <span className='text-base font-medium text-center'>{blockedReason}</span>
                            <span className='text-sm text-red-700 text-center'>Your image violates our safety guidelines. Please choose a different image.</span>
                        </div>
                    )}
                    <>
                        <Button
                            type="submit"
                            disabled={submitDisabled}
                            className='w-full mt-auto bg-[#000DFF] disabled:bg-gray-500 font-light text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-xl p-6'
                        >
                            {isUploading ? 'Sharing...' : 'Share Memory'}
                        </Button>
                        <div className="w-full text-center py-2 -my-6">
                            <span className="text-xs text-muted-foreground/80">
                                By uploading, you agree to the{' '}
                                <Link
                                    to="/tnc"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline underline-offset-2 hover:text-muted-foreground"
                                >
                                    Terms & Conditions
                                </Link>
                                .
                            </span>
                        </div>
                    </>
                    {/* {isMobile ? (
                        <Button
                            type="button"
                            onClick={handleNextStep}
                            disabled={!selectedFile || !title.trim() || !handle.trim() || !location.trim()}
                            className='w-full bg-[#2C2C2C] font-light text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-base p-4 flex items-center justify-center gap-2'
                        >
                            Next: Preview <ArrowRight className='w-5 h-5' />
                        </Button>
                    ) : (
                        <>
                            <Button
                                type="submit"
                                disabled={!selectedFile || !title.trim() || !handle.trim() || !location.trim() || isUploading}
                                className='w-full bg-[#2C2C2C] font-light text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-xl p-6'
                            >
                                {isUploading ? 'Uploading...' : 'Upload'}
                            </Button>

                        </>
                    )} */}
                </form>

                {/* Location Sheet */}
                <Sheet open={isLocationSheetOpen} onOpenChange={setIsLocationSheetOpen}>
                    <SheetContent side="bottom" className="bg-white gap-0 h-full">
                        <div className="p-2 text-black flex-1 overflow-hidden">
                            <Command className="bg-white border border-gray-300 rounded-lg h-full" shouldFilter={false}>
                                <CommandInput
                                    placeholder="Search locations..."
                                    className="bg-white text-black"
                                    onValueChange={fetchLocationSuggestions}
                                />
                                <CommandList className="bg-white max-h-full">
                                    {isLoadingLocations ? (
                                        <div className="py-6 text-center text-sm text-gray-500">Loading...</div>
                                    ) : locationOptions.length === 0 ? (
                                        <CommandEmpty className="text-gray-500">No locations found.</CommandEmpty>
                                    ) : (
                                        <CommandGroup className="bg-white">
                                            {locationOptions.map((option) => (
                                                <CommandItem
                                                    key={option.value}
                                                    value={option.value}
                                                    onSelect={() => {
                                                        setLocation(option.value)
                                                        setIsLocationSheetOpen(false)
                                                    }}
                                                    className="cursor-pointer hover:bg-gray-100 text-black"
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            location === option.value ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {option.label}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    )}
                                </CommandList>
                            </Command>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {/* Preview section - desktop only */}
            {!isMobile && <div className='flex flex-col relative gap-0 items-center justify-center bg-[#1E1E1E] rounded-r-lg !max-h-[90vh] h-full px-10'>
                <p className='absolute top-4 text-muted-foreground'>Preview</p>
                <StampPreview
                    headline={title}
                    location={location}
                    // size="lg"
                    handle={handle}
                    description={description}
                    date={datetime ? new Date(datetime).toLocaleDateString() : new Date().toLocaleDateString()}
                    imageSrc={previewUrl}
                    layout={orientation}
                    className={cn("scale-90", orientation === 'vertical' ? 'h-[80vh]' : 'w-[50vw]')}
                    onReselect={handleReselect}
                    isProcessing={isProcessing}
                    onHeadlineChange={handleSetTitle}
                    onLocationChange={setLocation}
                    onHandleChange={setHandle}
                />
                <div className="flex items-center justify-center gap-8">
                    {!isMobile && <div className='flex items-center justify-center gap-2'>
                        <Button
                            variant='ghost'
                            className={cn('!w-7 rounded-none h-12 p-0', orientation == 'vertical' ? '' : 'opacity-50')}
                            style={{
                                backgroundImage: `url(${postcardV})`,
                                backgroundSize: 'contain',
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'center',
                            }}
                            onClick={() => setOrientation('vertical')}
                        >
                            {orientation == "vertical" && <Check className='w-4 h-4' color='black' />}
                        </Button>
                        <Button
                            variant='ghost'
                            className={cn('w-10 rounded-none h-7 p-0', orientation == 'horizontal' ? '' : 'opacity-50')}
                            onClick={() => setOrientation('horizontal')}
                            style={{
                                backgroundImage: `url(${postcardH})`,
                                backgroundSize: 'contain',
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'center',
                            }}
                        >
                            {orientation == "horizontal" && <Check className='w-4 h-4' color='black' />}
                        </Button>
                    </div>}
                </div>
            </div>}
        </div>
    )
}

export default UploadModal


{/* <Button
    className='!bg-[#000DFF] text-white disabled:opacity-50 disabled:cursor-not-allowed'
    onClick={handleSubmit}
    disabled={
        !selectedFile ||
        !title.trim() ||
        title === 'Click here to edit' ||
        !handle.trim() ||
        handle === 'YOU' ||
        !location.trim() ||
        location.toUpperCase() === 'ANYWHERE, EARTH' ||
        isUploading
    }
>
    {isUploading ? 'Uploading...' : 'Finish'}
</Button> */}