import { createRoot } from 'react-dom/client'
import '../index.css'
import { ThemeProvider } from '@/components/theme-provider'
import { HashRouter } from 'react-router'
import { AdminApp } from './admin-app'

const root = document.getElementById('root')!

createRoot(root).render(
  <ThemeProvider defaultTheme="dark">
    <HashRouter>
      <AdminApp />
    </HashRouter>
  </ThemeProvider>
)