"use client"

import { useState, useEffect } from "react"
import { LOADING_WORDS } from "@/components/molecules"

export function useLoadingWords(isLoading: boolean, interval = 1200): string {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!isLoading) {
      setIndex(0)
      return
    }

    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % LOADING_WORDS.length)
    }, interval)

    return () => clearInterval(timer)
  }, [isLoading, interval])

  return LOADING_WORDS[index]
}
