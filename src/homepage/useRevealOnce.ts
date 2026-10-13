import { useEffect } from 'react'

// Drawings below the hero rise in once, the first time they scroll into view, and
// then stay. Server-rendered HTML and visitors without JavaScript or with reduced
// motion get every drawing in place from the start: the hidden-until-seen state
// applies only after this effect has marked the page ready.
export function useRevealOnce(rootSelector: string, itemSelector: string) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(rootSelector)
    if (!root || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const items = [...root.querySelectorAll<HTMLElement>(itemSelector)]
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-seen')
        observer.unobserve(entry.target)
      }
    }, { rootMargin: '0px 0px -8% 0px' })
    for (const item of items) {
      const box = item.getBoundingClientRect()
      if (box.top < innerHeight) item.classList.add('is-seen')
      else observer.observe(item)
    }
    root.classList.add('reveal-ready')
    return () => observer.disconnect()
  }, [rootSelector, itemSelector])
}
