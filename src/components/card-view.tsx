import React, { useState, useEffect } from 'react'
import type { CanvasItem } from './infinite-canvas'
import StampPreview from './stamp-preview'
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
    type CarouselApi,
} from './ui/carousel'

interface CardViewProps {
    items: CanvasItem[]
    onImageClick: (item: CanvasItem) => void
}

const CardView: React.FC<CardViewProps> = ({ items, onImageClick }) => {
    const [api, setApi] = useState<CarouselApi>()
    const [current, setCurrent] = useState(0)

    useEffect(() => {
        if (!api) return

        setCurrent(api.selectedScrollSnap())

        api.on("select", () => {
            setCurrent(api.selectedScrollSnap())
        })
    }, [api])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!api) return

            if (event.key === 'ArrowLeft') {
                event.preventDefault()
                api.scrollPrev()
            } else if (event.key === 'ArrowRight') {
                event.preventDefault()
                api.scrollNext()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [api])

    if (items.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-white/60">No memories to display</p>
            </div>
        )
    }

    const formatDate = (date: Date | string | undefined) => {
        if (!date) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        const d = typeof date === 'string' ? new Date(date) : date
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    }

    return (
        <div className="w-full h-full flex items-center justify-center py-16 md:py-24">
            <Carousel
                opts={{
                    align: "center",
                    loop: true,
                }}
                setApi={setApi}
                className="w-full max-w-[100vw]"
            >
                <CarouselContent className="-ml-4 md:-ml-8">
                    {items.concat(items).map((item, index) => {
                        const isCenterItem = index === current
                        return (
                            <CarouselItem
                                key={`${item.id}-${index}`}
                                className="pl-4 md:pl-8 basis-full md:basis-1/5 md:py-20"
                            >
                                <div className="flex items-center justify-center h-full py-12">
                                    <div
                                        className={`cursor-pointer transition-all relative duration-500 ease-out ${isCenterItem
                                            ? 'scale-100 z-50'
                                            : 'scale-[0.5] opacity-60 -z-1'
                                            }`}
                                        onClick={() => onImageClick(item)}
                                    >
                                        <StampPreview
                                            headline={item.title || 'Your Memory'}
                                            location={item.metadata?.location || 'EARTH'}
                                            handle="@memories"
                                            description={item.metadata?.description}
                                            date={formatDate(item.metadata?.date)}
                                            imageSrc={item.imageUrl}
                                            size='sm'
                                            layout="vertical"
                                            className="w-full h-[70vh] md:h-[60vh] object-contain drop-shadow-2xl"
                                        />
                                    </div>
                                </div>
                            </CarouselItem>
                        )
                    })}
                </CarouselContent>

                {/* Navigation Buttons */}
                <CarouselPrevious
                    size="lg"
                    className="h-12 w-12 translate-x-[15vw] md:translate-x-[40vw] !bg-black/50 hover:bg-black/60 text-white border-white/20 backdrop-blur-sm disabled:opacity-30"
                />
                <CarouselNext
                    size="lg"
                    className="h-12 w-12 -translate-x-[15vw] md:-translate-x-[40vw] !bg-black/50 hover:bg-black/60 text-white border-white/20 backdrop-blur-sm disabled:opacity-30"
                />
            </Carousel>
        </div>
    )
}

export default CardView

