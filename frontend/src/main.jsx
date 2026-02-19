import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Register service worker for PWA install
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  // StrictMode disabled - causes duplicate WebSocket connections
  // <React.StrictMode>
    <App />
  // </React.StrictMode>,
)
