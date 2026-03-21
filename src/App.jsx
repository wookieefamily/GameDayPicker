import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import PollVote from './pages/PollVote.jsx'
import PollAdmin from './pages/PollAdmin.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/poll/:slug" element={<PollVote />} />
      <Route path="/poll/:slug/admin" element={<PollAdmin />} />
    </Routes>
  )
}
