import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.jsx'

// iOS Safari pinch-zoom'u kapat (viewport meta yetmediği durumlar için)
// NOT: touchend preventDefault EKLEMEYIN — intro 3-tık skip'i ve hızlı ardışık
// tıklamaları kırıyor. Double-tap zoom için CSS touch-action: pan-x pan-y zaten yeterli.
const preventGesture = (e) => e.preventDefault();
document.addEventListener('gesturestart', preventGesture);
document.addEventListener('gesturechange', preventGesture);
document.addEventListener('gestureend', preventGesture);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)
