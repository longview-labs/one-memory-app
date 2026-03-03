import React, { useEffect, useState } from 'react'
import { Check, Twitter, Copy, X, Send, MessageCircle, Share2, Instagram } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { useIsMobile } from '../hooks/use-mobile'

interface CopySharePopupProps {
    isOpen: boolean
    onClose: () => void
    isCapturing?: boolean
    polaroidBlob: Blob | null
    tweetText: string
    shareUrl: string
    onTwitterOpen?: () => void
}

const CopySharePopup: React.FC<CopySharePopupProps> = ({
    isOpen,
    onClose,
    isCapturing = false,
    polaroidBlob,
    tweetText,
    shareUrl,
    onTwitterOpen
}) => {
    const isMobile = useIsMobile()
    const [status, setStatus] = useState<'select' | 'copying' | 'copied' | 'countdown' | 'error'>('select')
    const [countdown, setCountdown] = useState<number>(6)
    const [errorMessage, setErrorMessage] = useState<string>('')
    const [selectedPlatform, setSelectedPlatform] = useState<'twitter' | 'telegram' | 'whatsapp' | null>(null)

    useEffect(() => {
        if (!isOpen) {
            // Reset state when popup closes
            setStatus('select')
            setCountdown(6)
            setErrorMessage('')
            setSelectedPlatform(null)
            return
        }
    }, [isOpen])

    const handleCopyToClipboard = async () => {
        if (!polaroidBlob) {
            setStatus('error')
            setErrorMessage('No image available to copy')
            return
        }

        try {
            setStatus('copying')

            // Check if clipboard API is supported
            if (!navigator.clipboard || !navigator.clipboard.write) {
                throw new Error('Clipboard API not supported in this browser')
            }

            // Copy the polaroid image to clipboard
            navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': polaroidBlob
                })
            ]);

            setStatus('copied')

            // Start countdown
            setStatus('countdown')
            setCountdown(6)

        } catch (error) {
            console.error(error);
            setStatus('error')
            setErrorMessage(error instanceof Error ? error.message : 'Failed to copy image')
        }
    }

    // useEffect(() => {
    //     if (status === 'countdown' && countdown > 0) {
    //         const timer = setTimeout(() => {
    //             setCountdown(prev => prev - 1)
    //         }, 1000)

    //         return () => clearTimeout(timer)
    //     } else if (status === 'countdown' && countdown === 0) {
    //         // Open Twitter and close popup
    //         openTwitter()
    //     }
    // }, [status, countdown])

    // Handle ESC key press to close popup
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

    const handlePlatformSelect = async (platform: 'twitter' | 'telegram' | 'whatsapp') => {
        setSelectedPlatform(platform)

        await handleCopyToClipboard()
        if (platform === 'twitter') {
            const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
            window.open(twitterUrl, '_blank', 'noopener,noreferrer')
        } else if (platform === 'telegram') {
            const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(tweetText)}`
            window.open(telegramUrl, '_blank', 'noopener,noreferrer')
        } else if (platform === 'whatsapp') {
            const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(tweetText)}`
            window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
        }
        onClose()
    }

    const handleNativeShare = async () => {
        if (!polaroidBlob) {
            setStatus('error')
            setErrorMessage('No image available to share')
            return
        }

        try {
            const filesArray = [
                new File([polaroidBlob], 'memory.png', {
                    type: 'image/png',
                    lastModified: new Date().getTime(),
                }),
            ]
            const shareData = {
                title: 'Check out this memory!',
                text: tweetText,
                files: filesArray,
            }

            if (navigator.canShare && navigator.canShare(shareData)) {
                await navigator.share(shareData)
                onClose()
            } else {
                setStatus('error')
                setErrorMessage('Web Share API is not supported in this browser')
            }
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error('Error sharing:', error)
                setStatus('error')
                setErrorMessage('Failed to share image')
            }
        }
    }

    // const openTwitter = () => {
    //     const encodedText = encodeURIComponent(tweetText)
    //     const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}`

    //     window.open(twitterUrl, '_blank', 'noopener,noreferrer')
    //     onTwitterOpen?.()
    //     onClose()
    // }

    // const handleManualTwitterOpen = () => {
    //     openTwitter()
    // }

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={handleBackdropClick}
        >
            <Card className={`bg-black/90 border border-[#2C2C2C] w-full max-w-md overflow-hidden shadow-2xl rounded-xl animate-in fade-in-0 zoom-in-95 duration-200`}>
                <CardContent className="p-6 space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#000DFF] rounded-full flex items-center justify-center">
                                {isCapturing ? (
                                    <div className="flex flex-col items-center gap-3 text-white">
                                        <div className="h-10 w-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                        <span className="text-sm font-medium">Preparing...</span>
                                    </div>
                                ) : status === 'select' ? (
                                    <Copy className="w-5 h-5 text-white" />
                                ) : (
                                    <Twitter className="w-5 h-5 text-white" />
                                )}
                            </div>
                            <h2 className="text-white font-semibold text-lg">
                                {isCapturing ? 'Preparing Share' : status === 'select' ? 'Share Your Memory' : 'Share on X'}
                            </h2>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="bg-black/60 hover:bg-black/80 text-white border-white/20 rounded-full w-8 h-8 p-0"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Status Content */}
                    <div className="text-center space-y-4">
                        {isCapturing && (
                            <>
                                <div className="w-16 h-16 mx-auto bg-white/10 rounded-full flex items-center justify-center">
                                    <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                </div>
                                <div>
                                    <h3 className="text-white font-medium text-lg mb-2">
                                        Preparing Memory
                                    </h3>
                                    <p className="text-white/70 text-sm">
                                        Building your share image...
                                    </p>
                                </div>
                            </>
                        )}
                        {!isCapturing && status === 'select' && (
                            <>
                                <div>
                                    <h3 className="text-white font-medium text-lg mb-2">
                                        Choose where to share
                                    </h3>
                                    <p className="text-white/70 text-sm">
                                        Select your preferred platform
                                    </p>
                                </div>

                                {/* Platform Selection Buttons */}
                                <div className="space-y-3 pt-2">
                                    <Button
                                        onClick={() => handlePlatformSelect('twitter')}
                                        className="w-full bg-[#14171A] border border-white/20 text-white hover:bg-black py-6 text-base font-medium rounded-lg flex items-center justify-center gap-3"
                                    >
                                        <Twitter className="w-5 h-5" />
                                        Share on X (Twitter)
                                    </Button>

                                    <Button
                                        onClick={() => handlePlatformSelect('telegram')}
                                        className="w-full bg-[#0088cc]/10 border border-[#0088cc]/30 text-white hover:bg-[#0088cc]/20 py-6 text-base font-medium rounded-lg flex items-center justify-center gap-3"
                                    >
                                        <Send className="w-5 h-5" />
                                        Share on Telegram
                                    </Button>

                                    <Button
                                        onClick={() => handlePlatformSelect('whatsapp')}
                                        className="w-full bg-[#25D366]/10 border border-[#25D366]/30 text-white hover:bg-[#25D366]/20 py-6 text-base font-medium rounded-lg flex items-center justify-center gap-3"
                                    >
                                        <MessageCircle className="w-5 h-5" />
                                        Share on WhatsApp
                                    </Button>
                                    {/* Native Share Button - Show first if supported */}
                                    {navigator.share && (
                                        <Button
                                            onClick={handleNativeShare}
                                            className="w-full  border-[#c13584]/30 bg-[#c13584]/10 hover:bg-[#c13584]/20 border text-white py-6 text-base font-medium rounded-lg flex items-center justify-center gap-3"
                                        >
                                            <Instagram className="w-5 h-5" />
                                            Share via Instagram
                                        </Button>
                                    )}
                                </div>

                                {/* Info Box */}
                                <div className="bg-white/5 border border-[#2C2C2C] rounded-lg p-3 text-left">
                                    <p className="text-white/60 text-xs">
                                        💡 The image has been copied to your clipboard so you can paste it directly into your shared message!
                                    </p>
                                </div>
                            </>
                        )}
                        {!isCapturing && status === 'copying' && (
                            <>
                                <div className="w-16 h-16 mx-auto bg-white/10 rounded-full flex items-center justify-center">
                                    <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                </div>
                                <div>
                                    <h3 className="text-white font-medium text-lg mb-2">
                                        Copying to Clipboard
                                    </h3>
                                    <p className="text-white/70 text-sm">
                                        Preparing your polaroid image...
                                    </p>
                                </div>
                            </>
                        )}

                        {!isCapturing && status === 'copied' && (
                            <>
                                <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
                                    <Check className="w-8 h-8 text-green-400" />
                                </div>
                                <div>
                                    <h3 className="text-white font-medium text-lg mb-2">
                                        Image Copied to Clipboard! ✓
                                    </h3>
                                    <p className="text-white/70 text-sm">
                                        You can now paste it anywhere you want
                                    </p>
                                </div>
                            </>
                        )}

                        {!isCapturing && status === 'countdown' && (
                            <>
                                <div className="w-16 h-16 mx-auto bg-[#000DFF]/20 rounded-full flex items-center justify-center">
                                    <span className="text-2xl font-bold text-[#000DFF]">
                                        {countdown}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-white font-medium text-lg mb-2">
                                        Opening X in {countdown} seconds...
                                    </h3>
                                    <p className="text-white/70 text-sm mb-2">
                                        Your image is already copied to clipboard!
                                    </p>
                                    <p className="text-white/60 text-xs">
                                        Just paste it (Ctrl+V / Cmd+V) in your tweet
                                    </p>
                                </div>
                            </>
                        )}

                        {!isCapturing && status === 'error' && (
                            <>
                                <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
                                    <X className="w-8 h-8 text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-white font-medium text-lg mb-2">
                                        Copy Failed
                                    </h3>
                                    <p className="text-white/70 text-sm">
                                        {errorMessage}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Actions */}
                    {!isCapturing && status !== 'select' && (
                        <div className="space-y-3">
                            {/* {status === 'countdown' && (
                                <Button
                                    onClick={handleManualTwitterOpen}
                                    className="w-full bg-[#000DFF] hover:bg-[#000DFF]/90 text-white border border-[#2C2C2C]"
                                >
                                    <Twitter className="w-4 h-4 mr-2" />
                                    Open X Now
                                </Button>
                            )} */}

                            {/* {status === 'error' && (
                                <>
                                    <Button
                                        onClick={handleCopyToClipboard}
                                        className="w-full bg-[#000DFF] hover:bg-[#000DFF]/90 text-white border border-[#2C2C2C]"
                                    >
                                        <Copy className="w-4 h-4 mr-2" />
                                        Try Again
                                    </Button>
                                    <Button
                                        onClick={handleManualTwitterOpen}
                                        variant="outline"
                                        className="w-full bg-white/10 border border-[#2C2C2C] text-white hover:bg-white/20"
                                    >
                                        <Twitter className="w-4 h-4 mr-2" />
                                        Open X Without Image
                                    </Button>
                                </>
                            )} */}

                            {(status === 'copying' || status === 'copied' || status === 'countdown') && (
                                <Button
                                    onClick={onClose}
                                    variant="outline"
                                    className="w-full bg-white/10 border border-[#2C2C2C] text-white hover:bg-white/20"
                                >
                                    Cancel
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Preview Text */}
                    {!isCapturing && status !== 'copying' && status !== 'select' && (
                        <div className="bg-white/5 border border-[#2C2C2C] rounded-lg p-3">
                            <p className="text-white/60 text-xs mb-1">Tweet Preview:</p>
                            <p className="text-white/80 text-sm">
                                {tweetText.length > 100 ? `${tweetText.substring(0, 100)}...` : tweetText}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default CopySharePopup
