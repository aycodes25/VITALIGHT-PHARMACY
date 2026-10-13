import { useEffect, useState } from 'react'
import ProductArt from '../../../shared/art/ProductArt.jsx'

// Drop a landscape photo of the pharmacy at frontend/public/hero.jpg (about 1200x900).
// Until the file exists the illustrations are shown instead.
export const HERO_PHOTO = '/hero.jpg'

export default function HeroVisual({ src = HERO_PHOTO }) {
  const [hasPhoto, setHasPhoto] = useState(false)

  useEffect(() => {
    let active = true
    const probe = new Image()
    probe.onload = () => { if (active) setHasPhoto(true) }
    probe.onerror = () => { if (active) setHasPhoto(false) }
    probe.src = src
    return () => { active = false; probe.onload = null; probe.onerror = null }
  }, [src])

  if (hasPhoto) {
    return (
      <div className="hero-photo">
        <img src={src} alt="Vitalight Pharmacy" />
      </div>
    )
  }

  return (
    <div className="hero-art" aria-hidden="true">
      <div className="hero-circle" />
      <ProductArt className="hero-tile tile-1" type="vitamin" color="lavender" />
      <ProductArt className="hero-tile tile-2" type="tube" color="peach" />
      <ProductArt className="hero-tile tile-3" type="firstaid" color="blue" />
    </div>
  )
}
