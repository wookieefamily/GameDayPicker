import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Home from './pages/Home.jsx'
import PollVote from './pages/PollVote.jsx'
import PollAdmin from './pages/PollAdmin.jsx'

function usePageTracking() {
  const location = useLocation()
  useEffect(() => {
    if (typeof window.gtag !== 'function') return
    window.gtag('event', 'page_view', {
      page_path:  location.pathname,
      page_search: location.search,
    })
  }, [location.pathname, location.search])
}

export default function App() {
  usePageTracking()
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/poll/:slug" element={<PollVote />} />
      <Route path="/poll/:slug/admin" element={<PollAdmin />} />
    </Routes>
  )
}
