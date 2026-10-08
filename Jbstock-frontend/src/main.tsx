import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeLanguage } from './i18n'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element was not found')
}

initializeLanguage().then(() => createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
))
