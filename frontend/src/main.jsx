import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// iOS Safari pinch-zoom ve double-tap-zoom'u tamamen kapat (viewport meta yetmediği için)
const preventGesture = (e) => e.preventDefault();
document.addEventListener('gesturestart', preventGesture);
document.addEventListener('gesturechange', preventGesture);
document.addEventListener('gestureend', preventGesture);

// iOS double-tap zoom — 350ms içinde iki tıkı engelle (interactive değil elementlerde)
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 350) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
