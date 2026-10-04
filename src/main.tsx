import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import HoloLab from './ui/HoloLab/HoloLab.tsx'
import './styles.css'

// `?holo` opens the mutation sheen preview gallery instead of the simulation.
// This is used for UI mockups and otherwise not useful to read
const showHoloLab = new URLSearchParams(window.location.search).has('holo')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{showHoloLab ? <HoloLab /> : <App />}</StrictMode>,
)
