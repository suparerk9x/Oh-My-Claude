import ReactDOM from 'react-dom/client'
import MediumApp from './MediumApp.jsx'
import './index.css'

// Register service worker for PWA install
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <MediumApp />
)
