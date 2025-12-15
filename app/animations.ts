import { SpringProps } from '@/utils/stm/react/animation/Spring';

export const animButton: SpringProps = {
  triggers: ['hover', 'down', 'up'],
  spring: {
    scale: {
      values: { default: 1, down: 0.9, enter: 1.05 },
      stiffness: 120,
      damping: 2,
    },
    rotate: {
      values: { default: 0, down: -5, enter: 3 },
      stiffness: 150,
      damping: 18,
    },
    boxShadow: {
      values: { down: 2, up: 6, enter: 10, leave: 4 },
    },
  },
};

export const animButtonBig = (...rgb: number[]) =>
  ({
    isMove: true,
    viewport: 758,
    triggers: ['hover', 'down', 'up'],
    className: 'mb-4 rounded-md',
    spring: {
      perspective: { values: { default: 600, enter: 400, down: 400 } },
      perspectiveOrigin: { values: { leave: [50, 50], enter: [50, 300] } },
      rotateX: { stiffness: 200, damping: 18 },
      rotateY: { stiffness: 200, damping: 18 },
      scale: {
        values: {
          default: 1,
          enter: 1.03,
          down: 0.97,
          up: 1.01,
        },
        stiffness: 130,
        damping: 20,
      },

      depth: {
        values: {
          default: 4,
          enter: 8,
          down: 2,
          up: 6,
        },
        stiffness: 120,
        damping: 20,
      },

      boxShadow: {
        values: {
          default: 4,
          enter: 8,
          down: 2,
          up: 6,
        },
        stiffness: 110,
        damping: 20,
      },

      shadowColor: {
        values: {
          default: [...rgb, 0.25],
          enter: [...rgb, 0.45],
          leave: [...rgb, 0.25],
          down: [...rgb, 0.15],
          up: [...rgb, 0.35],
        },
        stiffness: 120,
        damping: 10,
      },
    },
  } as SpringProps);

export const animLogo: SpringProps = {
  triggers: ['hover', 'down', 'up'],
  spring: {
    scale: {
      values: {
        default: 1,
        enter: 1.08,
        leave: 0.95,
        down: 0.92,
        up: 1.05,
      },
      stiffness: 50,
      damping: 3,
    },
    rotate: {
      values: {
        default: 0,
        enter: 3,
        leave: -3,
        down: -4,
        up: 2,
      },
      stiffness: 140,
      damping: 14,
    },
    translateY: {
      values: {
        default: 0,
        down: 2,
        up: -2,
      },
      stiffness: 130,
      damping: 16,
    },
  },
};

export const animText = {
  spring: {
    opacity: { values: { default: 0, active: 1 }, stiffness: 100, damping: 20 },
    scale: { values: { default: 0, active: 1 }, stiffness: 140, damping: 70 },
  },
};

export const animSubLabel = {
  spring: {
    translateY: {
      values: {
        default: -20,
        active: 0,
      },
      stiffness: 80,
      damping: 4,
    },
    opacity: { values: { default: 0, active: 1 }, stiffness: 50, damping: 10 },
    scale: {
      values: {
        default: 0.5,
        active: 1,
      },
      stiffness: 140,
      damping: 10,
    },
  },
};

export const animFlip = {
  isMove: true,
  spring: {
    perspective: { values: { default: 1200 } },
    rotateX: { stiffness: 120, damping: 18 },
    rotateY: { stiffness: 120, damping: 18 },
  },
};
