import permanentImage from "@/assets/permanent-light.png"
import postcardV from "@/assets/postcard-v.svg"
import postcardH from "@/assets/postcard-h.svg"
import postcardSquareBg from "@/assets/postcard-square.svg"
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { ImageUp, Upload, Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import { useRef, useEffect, useState } from "react";

interface StampPreviewProps {
    headline: string;
    location: string;
    handle: string;
    date: string;
    imageSrc: string;
    size?: 'sm' | 'md' | 'lg';
    layout: 'horizontal' | 'vertical';
    noText?: boolean;
    onLoad?: () => void;
    onError?: () => void;
    className?: string;
    onReselect?: () => void;
    isProcessing?: boolean;

    onHeadlineChange?: (value: string) => void;
    onLocationChange?: (value: string) => void;
    onHandleChange?: (value: string) => void;
}

// Base widths that the fixed sizes are designed for
const BASE_WIDTH_VERTICAL = 512; // max-w-lg = 32rem = 512px
const BASE_WIDTH_HORIZONTAL = 896; // approximate expected width for horizontal

// Expected aspect ratios (width / height)
const ASPECT_RATIO_VERTICAL = 182 / 303;
const ASPECT_RATIO_HORIZONTAL = 1 / ASPECT_RATIO_VERTICAL; // ~0.61

export default function StampPreview({
    headline,
    location,
    handle,
    date,
    imageSrc,
    layout,
    noText = false,
    size,
    onLoad,
    onError,
    className,
    onReselect,
    isProcessing = false,
    onHeadlineChange,
    onLocationChange,
    onHandleChange,
}: StampPreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [contentScale, setContentScale] = useState(1);
    const [contentOffset, setContentOffset] = useState(0); // Horizontal offset in pixels
    const [effectiveWidth, setEffectiveWidth] = useState<number | null>(null); // Width of visible area

    // Calculate scale factor and horizontal offset based on effective width
    useEffect(() => {
        if (!containerRef.current) return;

        const calculateScaleAndOffset = () => {
            requestAnimationFrame(() => {
                if (!containerRef.current) return;
                
                const rect = containerRef.current.getBoundingClientRect();
                const visualWidth = rect.width;
                const visualHeight = rect.height;
                
                // The aspect ratio for this layout (width/height)
                const aspectRatio = noText ? 1 : (layout === 'horizontal' ? ASPECT_RATIO_HORIZONTAL : ASPECT_RATIO_VERTICAL);
                
                // Calculate what width would give us this height at the correct aspect ratio
                const expectedWidthFromHeight = visualHeight * aspectRatio;
                
                // The effective width is the smaller of actual width or calculated width from height
                // This handles cases where height is constrained (max-h) causing the mask to shrink
                const effectiveWidth = Math.min(visualWidth, expectedWidthFromHeight);
                
                // Calculate horizontal offset: when height constrains width, 
                // the mask is centered so we need to offset content by half the difference
                const horizontalOffset = (visualWidth - effectiveWidth) / 2;
                
                const baseWidth = layout === 'horizontal' ? BASE_WIDTH_HORIZONTAL : BASE_WIDTH_VERTICAL;
                
                // Only scale down, never up
                const scale = Math.min(1, effectiveWidth / baseWidth);
                
                console.log('Scale calculation:', { 
                    visualWidth, 
                    visualHeight, 
                    expectedWidthFromHeight, 
                    effectiveWidth, 
                    horizontalOffset,
                    baseWidth, 
                    scale 
                });
                
                setContentScale(scale);
                setContentOffset(horizontalOffset);
                setEffectiveWidth(effectiveWidth < visualWidth ? effectiveWidth : null);
            });
        };

        // Initial calculation after a short delay to ensure styles are applied
        // setTimeout(calculateScaleAndOffset, 100);
        calculateScaleAndOffset()

        // Use ResizeObserver to detect size changes
        // const observer = new ResizeObserver(() => {
        //     calculateScaleAndOffset();
        // });
        // observer.observe(containerRef.current);

        // Also listen for window resize
        window.addEventListener('resize', calculateScaleAndOffset);

        return () => {
            // observer.disconnect();
            window.removeEventListener('resize', calculateScaleAndOffset);
        };
    }, [layout, noText]);

    if (!handle) {
        handle = 'Your Handle'
    }
    if (!headline) {
        headline = 'Your Memory'
    }
    if (!location) {
        location = 'Memory Location'
    }
    if (!date) {
        date = new Date().toLocaleDateString()
    }
    if (!imageSrc) {
        imageSrc = ''
    }
    if (!layout) {
        layout = 'vertical'
    }

    // Select the appropriate background based on layout and noText
    const postcardBg = noText
        ? postcardSquareBg
        : layout === 'horizontal'
            ? postcardH
            : postcardV;

    return (
        <div
            ref={containerRef}
                className={cn(`relative text-black overflow-clip`,
                // !className?.includes('w-') && (noText ? 'w-[min(90vw,theme(maxWidth.2xl))]' : layout === 'horizontal' ? 'w-[min(90vw,theme(maxWidth.5xl))]' : 'w-[min(90vw,theme(maxWidth.lg))]'),
                className
            )}
            style={{
                backgroundImage: `url(${postcardBg})`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                maskImage: `url(${postcardBg})`,
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskImage: `url(${postcardBg})`,
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                aspectRatio: noText ? '1 / 1' : (layout === 'horizontal' ? ASPECT_RATIO_HORIZONTAL : ASPECT_RATIO_VERTICAL),
                // Pass scale factor as CSS custom property
                '--stamp-scale': contentScale,
            } as React.CSSProperties}
        >
            {/* Main content - Two sections stacked vertically or horizontally */}
            <div 
                className={cn("relative z-10 flex h-full w-full", layout === 'horizontal' ? 'flex-row' : 'flex-col')}
            >
                {/* Text section - Left side (horizontal) or Top (vertical) */}
                {/* Wrapper to constrain and center text section when height is constrained */}
                {!noText && <div 
                    className={cn(
                        "flex flex-col justify-between grow",
                        layout === 'horizontal' ? 'flex-1 max-w-1/2' : 'flex-1 w-full grow'
                    )}
                    style={{
                        // Constrain width to effective visible area and center the text section
                        // width: effectiveWidth ? `${effectiveWidth}px` : '100%',
                        // margin: effectiveWidth ? '0 auto' : undefined,
                        padding: `max(calc(var(--stamp-scale) * 2rem), 5%) max(calc(var(--stamp-scale) * 2.5rem), 5%)`,
                    }}
                >
                    <div className={cn("space-y-4", layout === 'horizontal' && 'space-y-2')}>
                        {/* Main headline */}
                        <div className="items-center justify-center">
                            <h1
                                // contentEditable
                                id="headline-text"
                                // suppressContentEditableWarning
                                onBlur={(e) => onHeadlineChange?.(e.currentTarget.textContent || '')}
                                className={cn(
                                    "font-light w-full leading-tight cursor-text font-instrument text-left rounded focus:outline-2 outline-blue-400/50",
                                    size === 'sm' ? 'text-2xl md:text-4xl min-h-[2rem] md:min-h-[2.5rem]' : size === 'lg' ? 'text-5xl md:text-8xl min-h-[3.5rem] md:min-h-[5rem]' : ''
                                )}
                                style={!size ? {
                                    fontSize: layout === 'horizontal' 
                                        ? `calc(var(--stamp-scale) * 4.5rem)`  // ~text-7xl equivalent
                                        : `calc(var(--stamp-scale) * 3.75rem)`, // ~text-6xl equivalent
                                } : undefined}
                            >
                                {headline}
                            </h1>
                            {/* <Input className={cn(
                                "font-light leading-tight font-instrument text-left",
                                size === 'sm' ? 'text-2xl md:text-4xl' : size === 'lg' ? 'text-5xl md:text-8xl' : (layout === 'horizontal' ? 'text-4xl md:text-7xl' : 'text-3xl md:text-6xl')
                            )} value={headline} onChange={(e) => setHeadline(e.target.value)} /> */}
                        </div>

                        {/* Header with location and handle */}
                        <div 
                            className={cn("flex items-center justify-start")}
                            style={{ gap: `calc(var(--stamp-scale) * 1rem)` }}
                        >
                            <div 
                                className="flex items-center max-w-1/2 w-full"
                                style={{ gap: `calc(var(--stamp-scale) * 0.25rem)`, fontSize: `calc(var(--stamp-scale) * 0.75rem)` }}
                            >
                                <svg 
                                    className="flex-shrink-0" 
                                    style={{ width: `calc(var(--stamp-scale) * 0.75rem)`, height: `calc(var(--stamp-scale) * 0.75rem)` }}
                                    fill="currentColor" 
                                    viewBox="0 0 20 20" 
                                    onClick={() => document.getElementById("location-text")?.focus()}
                                >
                                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                </svg>
                                <span
                                    // contentEditable
                                    id="location-text"
                                    // suppressContentEditableWarning
                                    onBlur={(e) => onLocationChange?.(e.currentTarget.textContent || '')}
                                    className="uppercase focus:outline-2 outline-blue-400/50 rounded-xs cursor-text tracking-wide font-light inline-block min-w-[8ch]"
                                >{location}</span>
                            </div>
                            <div 
                                className="relative max-w-1/2 w-full flex items-start"
                                style={{ fontSize: `calc(var(--stamp-scale) * 0.75rem)` }}
                            >
                                {/* <span onClick={() => document.getElementById("handle-text")?.focus()} className="font-light">{handle.startsWith("@") ? "" : "@"}</span> */}
                                <span
                                    // contentEditable
                                    id="handle-text"
                                    // suppressContentEditableWarning
                                    onBlur={(e) => onHandleChange?.(e.currentTarget.textContent || '')}
                                    className="font-light rounded-xs cursor-text focus:outline-2 outline-blue-400/50 inline-block min-w-[6ch]"
                                >{handle}</span>
                            </div>
                        </div>
                    </div>


                    {/* Footer with branding */}
                        <div 
                            className={cn("flex items-end justify-between")}
                            style={{
                                gap: `calc(var(--stamp-scale) * 1rem)`,
                                marginTop: `calc(var(--stamp-scale) * 1.5rem)`,
                            }}
                        >
                        <div className="space-y-1">
                            <p 
                                className="tracking-wide uppercase leading-tight"
                                    style={{ fontSize: `calc(var(--stamp-scale) * 8px)` }}
                            >
                                Your memories deserve forever
                            </p>
                            <div
                                className="underline underline-offset-2 tracking-wide uppercase block"
                                    style={{ fontSize: `calc(var(--stamp-scale) * 8px)` }}
                            >
                                onememory.xyz
                            </div>
                        </div>

                        {/* Permanent on Arweave badge */}
                        <img 
                            src={permanentImage} 
                            alt="Permanent on Arweave" 
                            className="relative"
                            style={{
                                height: layout === 'horizontal' 
                                    ? `calc(var(--stamp-scale) * 2rem)` 
                                    : `calc(var(--stamp-scale) * 2.5rem)`,
                                top: layout === 'horizontal' ? 0 : `calc(var(--stamp-scale) * 0.25rem)`,
                            }}
                        />
                    </div>
                </div>}

                {/* Image section - Right side (horizontal) or Bottom (vertical) */}
                <div className={cn(
                    "relative overflow-hidden !w-full h-full group",
                    noText
                        ? 'w-full h-full'
                        : cn("aspect-square", layout === 'horizontal' ? 'max-w-[50%]' : 'max-h-[50%]')
                )}>
                    {isProcessing ? (
                        <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className={cn("animate-spin text-gray-600", layout === 'horizontal' ? 'w-16 h-16' : 'w-20 h-20')} />
                                <p className="text-gray-600 font-medium text-lg">Processing image...</p>
                            </div>
                        </div>
                    ) : imageSrc ? (
                        <>
                            <img
                                src={imageSrc}
                                alt={headline}
                                className="absolute inset-0 bg-white w-full h-full object-cover object-center"
                                onLoad={onLoad}
                                onError={onError}
                                loading="lazy"
                                draggable={false}
                            />
                            {onReselect && (
                                <>
                                    <div
                                        className={cn(
                                            "absolute bg-black/30 border border-white backdrop-blur-sm rounded-full p-3 cursor-pointer z-50 hover:bg-black/80 transition-colors",
                                            noText ? "top-10 left-8" : "top-6 left-6"
                                        )}
                                        onClick={onReselect}
                                    >
                                        <ImageUp className="w-6 h-6 text-white" />
                                    </div>
                                    <div
                                        className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 cursor-pointer z-40"
                                        onClick={onReselect}
                                    >
                                        <Upload className="w-12 h-12 text-white" />
                                        <p className="text-white text-lg font-medium">Replace Image</p>
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="absolute inset-0 bg-gray-200 flex items-center justify-center group">
                            <div className="text-gray-400">
                                <svg className={cn("fill-current", layout === 'horizontal' ? 'w-24 h-24' : 'w-32 h-32')} viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                </svg>
                            </div>
                            {onReselect && (
                                <div
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 cursor-pointer z-50"
                                    onClick={onReselect}
                                >
                                    <Upload className="w-12 h-12 text-white" />
                                    <p className="text-white text-lg font-medium">Select an image</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Date stamp - Position varies by layout */}
                    {!noText && <div
                        className="absolute text-white font-semibold tracking-wider z-10"
                        style={{
                            right: layout === 'horizontal' 
                                ? `calc(var(--stamp-scale) * 2rem)` 
                                : `calc(var(--stamp-scale) * 3rem)`,
                            bottom: layout === 'horizontal' 
                                ? `calc(var(--stamp-scale) * 2rem)` 
                                : `calc(var(--stamp-scale) * 3rem)`,
                            fontSize: layout === 'horizontal' 
                                ? `calc(var(--stamp-scale) * 1rem)` 
                                : `calc(var(--stamp-scale) * 1.125rem)`,
                            writingMode: 'vertical-rl',
                            textOrientation: 'mixed',
                            letterSpacing: '0.2em',
                            mixBlendMode: 'difference'
                        }}
                    >
                        {date}
                    </div>}
                </div>
            </div>
        </div>
    );
}