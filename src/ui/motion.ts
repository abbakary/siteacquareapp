import type { Transition, Variants } from 'motion/react';

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const DURATIONS = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
  count: 0.6,
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
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATIONS.base, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: -6,
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
    transition: { duration: DURATIONS.base, ease: EASE_IN_OUT },
  },
};

export const backdropFade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATIONS.base } },
  exit: { opacity: 0, transition: { duration: DURATIONS.fast } },
};

export const tapPress = {
  whileTap: { scale: 0.97 },
  transition: { duration: DURATIONS.fast, ease: EASE_OUT },
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
    transition: { duration: DURATIONS.base, ease: EASE_OUT },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? -24 : 24,
    transition: { duration: DURATIONS.fast, ease: EASE_IN_OUT },
  }),
};
