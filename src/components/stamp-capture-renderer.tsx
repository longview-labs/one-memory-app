import React from 'react'
import StampPreview from './stamp-preview'

interface StampCaptureRendererProps {
    hiddenHorizontalRef: React.RefObject<HTMLDivElement | null>
    hiddenVerticalRef: React.RefObject<HTMLDivElement | null>
    isCapturing?: boolean
    headline: string
    location: string
    handle: string
    description?: string
    date: string
    imageSrc: string
    className?: string
}

const StampCaptureRenderer: React.FC<StampCaptureRendererProps> = ({
    hiddenHorizontalRef,
    hiddenVerticalRef,
    isCapturing = false,
    headline,
    location,
    handle,
    description,
    date,
    imageSrc,
    className,
}) => {
    return (
        <>
            <div
                aria-hidden={!isCapturing}
                className={`fixed inset-0 z-10000 flex items-center justify-center bg-black ${
                    isCapturing ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none transition-opacity duration-300 ease-out'
                }`}
            >
                <div className="flex flex-col items-center gap-3 text-white">
                    <div className="h-10 w-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span className="text-sm font-medium">Preparing memory...</span>
                </div>
            </div>
            <div
                ref={hiddenHorizontalRef}
                className="absolute left-0 top-0 opacity-0 pointer-events-none"
                style={{ visibility: 'hidden' }}
            >
                <StampPreview
                    className={className}
                    headline={headline}
                    location={location}
                    handle={handle}
                    description={description}
                    date={date}
                    imageSrc={imageSrc}
                    layout="horizontal"
                />
            </div>
            <div
                ref={hiddenVerticalRef}
                className="absolute left-0 top-0 opacity-0 pointer-events-none"
                style={{ visibility: 'hidden' }}
            >
                <StampPreview
                    className={className}
                    headline={headline}
                    location={location}
                    handle={handle}
                    description={description}
                    date={date}
                    imageSrc={imageSrc}
                    layout="vertical"
                />
            </div>
        </>
    )
}

export default StampCaptureRenderer
