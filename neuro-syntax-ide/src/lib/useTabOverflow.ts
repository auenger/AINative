import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Hook to detect tab container overflow and provide scroll navigation.
 *
 * Uses ResizeObserver to watch the container and its content,
 * tracking whether left/right scroll is possible and providing
 * smooth scroll-to-tab functionality.
 */
export function useTabOverflow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  /** Recalculate scroll state from the live DOM element. */
  const updateScrollState = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    // Use a 1px threshold to avoid sub-pixel rounding issues
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  /** Scroll the container by a fixed offset. */
  const scrollBy = useCallback((offset: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollBy({ left: offset, behavior: 'smooth' });
  }, []);

  /** Scroll left by roughly one tab-width. */
  const scrollLeft = useCallback(() => {
    scrollBy(-200);
  }, [scrollBy]);

  /** Scroll right by roughly one tab-width. */
  const scrollRight = useCallback(() => {
    scrollBy(200);
  }, [scrollBy]);

  /** Scroll a specific child tab element into view. */
  const scrollToTab = useCallback((index: number) => {
    const el = containerRef.current;
    if (!el) return;
    const tab = el.children[index] as HTMLElement | undefined;
    if (tab) {
      tab.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  }, []);

  // Observe container resize + listen for scroll events
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    updateScrollState();

    const observer = new ResizeObserver(() => {
      updateScrollState();
    });
    observer.observe(el);

    // Also observe first-child changes (when tabs are added/removed)
    if (el.firstElementChild) {
      observer.observe(el.firstElementChild);
    }

    el.addEventListener('scroll', updateScrollState, { passive: true });

    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', updateScrollState);
    };
  }, [updateScrollState]);

  return {
    containerRef,
    canScrollLeft,
    canScrollRight,
    scrollLeft,
    scrollRight,
    scrollToTab,
    updateScrollState,
  };
}
