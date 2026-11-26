import type { Transition, Variants } from 'motion/react';

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const DURATIONS = {
  button: 0.15,
  dropdown: 0.18,
  card: 0.2,
  sidebar: 0.25,
  page: 0.28,
  chart: 0.85,
  count: 0.9,
  // Legacy aliases kept for backwards compatibility
  fast: 0.15,
  base: 0.2,
  slow: 0.28,
} as const;

export const SPRING_SNAPPY: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.8,
};

export const SPRING_SHEET: Transition = {
  type: 'spring',
  stiffness: 360,
  damping: 34,
  mass: 0.9,
};

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATIONS.page, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: DURATIONS.fast, ease: EASE_IN_OUT },
  },
};

export const dropdownMenu: Variants = {
  initial: { opacity: 0, y: 6, scale: 0.97 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: DURATIONS.dropdown, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: 4,
    scale: 0.97,
    transition: { duration: DURATIONS.fast, ease: EASE_IN_OUT },
  },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATIONS.base, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: DURATIONS.fast, ease: EASE_IN_OUT },
  },
};

export const sheetUp: Variants = {
  initial: { opacity: 0, y: '100%' },
  animate: {
    opacity: 1,
    y: 0,
    transition: SPRING_SHEET,
  },
  exit: {
    opacity: 0,
    y: '100%',
    transition: { duration: DURATIONS.sidebar, ease: EASE_IN_OUT },
  },
};

export const backdropFade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATIONS.base, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: DURATIONS.fast, ease: EASE_IN_OUT } },
};

export const tapPress = {
  whileHover: { scale: 1.01 },
  whileTap: { scale: 0.97 },
  transition: { duration: DURATIONS.button, ease: EASE_OUT },
};

export const MAX_STAGGER_ITEMS = 8;

export function getStaggerDelay(index: number): number {
  if (index >= MAX_STAGGER_ITEMS) return 0;
  return index * 0.04;
}

export const listStagger: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

export const listItem: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATIONS.base,
      ease: EASE_OUT,
      delay: getStaggerDelay(index),
    },
  }),
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: DURATIONS.fast, ease: EASE_IN_OUT },
  },
};

export const stepSlide: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? 24 : -24,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATIONS.page, ease: EASE_OUT },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? -24 : 24,
    transition: { duration: DURATIONS.fast, ease: EASE_IN_OUT },
  }),
};
