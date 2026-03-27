import React, { useState, useCallback, useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from './ui/button'
import { useIsMobile } from '../hooks/use-mobile'
import { cn } from '@/lib/utils'
import StampPreview from './stamp-preview'

interface MemoryData {
    id: string
    imageUrl: string
    title: string
    location: string
    handle: string
    date: string
}

const presetMemories: MemoryData[] = [
    {
        id: 'preset-birthday',
        imageUrl: '/birthday.jpg',
        title: 'Birthday with friends',
        location: 'AUSTIN, USA',
        handle: 'MEMORIES',
        date: 'JUNE 2025'
    },
    {
        id: 'preset-camping',
        imageUrl: '/camping.jpg',
        title: 'Weekend camping trip',
        location: 'YOSEMITE, USA',
        handle: 'MEMORIES',
        date: 'SEPT 2025'
    },
    {
        id: 'preset-wedding',
        imageUrl: '/wedding.jpg',
        title: 'Wedding day',
        location: 'SEATTLE, USA',
        handle: 'MEMORIES',
        date: 'APRIL 2025'
    },
    {
        id: 'preset-friends-pizza',
        imageUrl: '/friends-pizza.jpg',
        title: 'Pizza & Chill with friends',
        location: 'BROOKLYN, USA',
        handle: 'MEMORIES',
        date: 'OCT 2025'
    }
]


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
    const [randomMemories, setRandomMemories] = useState<MemoryData[]>([])
    const [isLoadingMemories, setIsLoadingMemories] = useState(true)
    const isMobile = useIsMobile()
    const navigate = useNavigate()

    const handleExploreGallery = useCallback(() => {
        navigate('/gallery')
    }, [navigate])

    // Use preset memories and randomize the front card on each landing load
    useEffect(() => {
        if (presetMemories.length === 0) {
            setRandomMemories([])
            setIsLoadingMemories(false)
            return
        }

        const frontIndex = Math.floor(Math.random() * presetMemories.length)
        const frontMemory = presetMemories[frontIndex]
        const remainingMemories = presetMemories.filter((_, index) => index !== frontIndex)
        const backMemory = remainingMemories.length > 0
            ? remainingMemories[Math.floor(Math.random() * remainingMemories.length)]
            : null

        setRandomMemories(backMemory ? [backMemory, frontMemory] : [frontMemory])
        setIsLoadingMemories(false)
    }, [])

    return (
        <div
            className="flex flex-col min-h-screen h-auto md:h-screen bg-black relative overflow-scroll md:overflow-hidden"
        >

            {/* Header */}
            <div className="z-10 left-0 right-0 p-6">
                <MemoriesLogo />
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex-1 px-6 md:px-16 pb-25 overflow-hidden">
                {/* Welcome Section - Always Visible */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
                    {/* Left Content */}
                    <div className="relative space-y-10 self-center pt-6 md:pt-0 lg:-top-10">
                        <div className="space-y-6">
                            <h2 className="text-white font-instrument text-5xl lg:text-8xl lg:leading-[90px]">
                                Your memory <br />can last forever
                            </h2>
                            <p className="font-montserrat text-white text-sm md:text-xl leading-relaxed">
                                Save your favourite photo memory, forever<br /> Seriously, no strings attached, own your memory with Arweave,<br /> upload now.
                            </p>
                        </div>

                        <div className="flex flex-col items-start gap-5">
                            <Button
                                className="bg-[#000DFF] h-16 text-white border border-[#2C2C2C] px-10 py-4 text-xl font-semibold rounded-md flex items-center gap-3 hover:bg-[#0008CC] transition-colors"
                                variant="ghost"
                                size="lg"
                                onClick={handleExploreGallery}
                            >
                                Explore the gallery
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
                                    <div className="absolute w-full transform -rotate-5 -translate-x-10 md:-rotate-10 md:-translate-x-20 md:translate-y-5 translate-y-5 opacity-90 hover:opacity-80 transition-all duration-300">
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
                                    <div className="relative transform rotate-2 -translate-x-3 hover:rotate-0 transition-transform duration-300">
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
                                            handle="YOU"
                                            date="TODAY"
                                            imageSrc=""
                                            layout="vertical"
                                        />
                                    </div>

                                    <div className="relative transform rotate-3 hover:rotate-0 transition-transform duration-300">
                                        <StampPreview
                                            headline="Your first memory"
                                            location="ANYWHERE, EARTH"
                                            handle="YOU"
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

            <div className='absolute bottom-2 left-2 z-20 flex items-center text-muted-foreground/80'>
                <Link to="/how-it-works" className='px-1'>How it works</Link>
                <span className='px-1'>•</span>
                <Link to="/tnc" className='px-1'>Terms & Conditions</Link>
            </div>
        </div>
    )
}
export default LandingPage;

