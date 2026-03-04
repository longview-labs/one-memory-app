import { createRoot } from 'react-dom/client'
import './index.css'
import { ThemeProvider } from '@/components/theme-provider.tsx'
import { BrowserRouter, HashRouter, Route, Routes } from "react-router"
import { ArweaveWalletKit } from "@arweave-wallet-kit/react"
import WanderStrategy from "@arweave-wallet-kit/wander-strategy"
import WAuthStrategy from "@wauth/strategy"
import { WAuthProviders } from "@wauth/strategy"
import AosyncStrategy from "@vela-ventures/aosync-strategy"

import App from './App'
import GalleryPage from './components/gallery-page'
import UploadedPage from './components/uploaded-page'
import TermsAndConditions from './components/tnc'
import HowItWorks from './components/how-it-works'

import { QuickWallet } from "quick-wallet"
import QuickWalletStrategy from '@vela-ventures/quick-wallet-strategy'
import { useEffect } from 'react'
import { Toaster } from './components/ui/sonner'
import { PostHogProvider } from "posthog-js/react"

function Main() {
  QuickWallet.connect()

  return (
    // <ArweaveWalletKit
    //   config={{
    //     appInfo: {
    //       name: "ArAO Starter",
    //       logo: "t8cPU_PWjdLXRBAN89nzb9JQoRAf5ZBF2kkTZoxtJPc",
    //     },
    //     strategies: [
    //       new QuickWalletStrategy(),
    //       new WAuthStrategy({ provider: WAuthProviders.X }),
    //       new WanderStrategy(),

    //       // Can also use more supported providers for web2 auth
    //       // new WAuthStrategy({ provider: WAuthProviders.Discord })
    //       // new WAuthStrategy({ provider: WAuthProviders.Github })
    //       // new WAuthStrategy({ provider: WAuthProviders.X })
    //       // If you would like to use any provider other than the ones available,
    //       // just raise an issue and I'll try my best to add that
    //       // new AosyncStrategy()
    //     ],
    //     permissions: ["ACCESS_ADDRESS", "SIGNATURE", "SIGN_TRANSACTION", "ACCESS_PUBLIC_KEY"],
    //   }}
    //   theme={{ displayTheme: "dark" }}
    // >
    <ThemeProvider defaultTheme="dark">
      <Toaster position="top-center" richColors />
      <HashRouter>
        <Routes>
          <Route index element={<App />} />
          <Route path='gallery' element={<GalleryPage />} />
          <Route path='view/:transactionId' element={<UploadedPage />} />
          <Route path='tnc' element={<TermsAndConditions />} />
          <Route path='how-it-works' element={<HowItWorks />} />
        </Routes>
      </HashRouter>
    </ThemeProvider>
    // </ArweaveWalletKit>
  )
}

createRoot(document.getElementById('root')!).render(
  <PostHogProvider
    apiKey={"phc_Ks5EkCuzahe3dKg2SODetHdy2q5cOU7DcYj83T9VEOJ"}
    options={{
      api_host: "https://eu.i.posthog.com",
      defaults: '2025-05-24',
      capture_exceptions: true, // This enables capturing exceptions using Error Tracking, set to false if you don't want this
      debug: import.meta.env.MODE === "development",
    }}
  >
    <Main />
  </PostHogProvider>
)