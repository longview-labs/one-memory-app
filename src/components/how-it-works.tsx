import React from 'react'
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { MemoriesLogo } from './landing-page'
import { Button } from './ui/button'

const HowItWorks: React.FC = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="relative z-10 p-6">
        <div className="flex items-center justify-between">
          <MemoriesLogo />
          <Link to="/">
            <Button
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 md:px-16 py-10">
        <h1 className="text-white font-instrument text-4xl md:text-6xl mb-8">
          How it works
        </h1>

        <div className="space-y-8 font-montserrat text-white/80 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Choose a photo</h2>
            <p>
              Click <strong>Preserve your memories</strong> on the home page and pick an image, or drag and drop an image directly onto the page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Add memory details</h2>
            <p>
              Fill in your memory title, location, handle, and date. These details are stored as metadata alongside your image.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Upload to Arweave</h2>
            <p>
              The app uploads your image to Arweave so your memory can live permanently on the permaweb.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. View and share</h2>
            <p>
              After upload, you are taken to your memory page where you can view it and share the link.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Explore the gallery</h2>
            <p>
              Visit the gallery to discover public memories shared by others.
            </p>
          </section>

          <section className="pt-8 border-t border-white/10">
            <p className="text-sm text-white/60">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </section>
        </div>

        <div className="mt-12 pb-12">
          <Link to="/">
            <Button
              className="bg-[#000DFF] h-14 text-white border border-[#2C2C2C] px-8 py-4 text-lg font-semibold rounded-md hover:bg-[#0008CC] transition-colors"
              variant="ghost"
              size="lg"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default HowItWorks
