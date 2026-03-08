"use client"

import { useState, useEffect } from "react"

export function useScrollScale(minScale = 0.7, scrollRange = 1000): number {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const newScale = Math.max(minScale, 1 - scrollY / scrollRange)
      setScale(newScale)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [minScale, scrollRange])

  return scale
}
