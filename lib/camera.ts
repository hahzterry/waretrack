/** Imperative camera API used by the floating map buttons. */
export const cameraApi: {
  zoomIn: () => void;
  zoomOut: () => void;
  rotate: (dir: 1 | -1) => void;
  reset: () => void;
  focus: (x: number, z: number) => void;
} = {
  zoomIn: () => {},
  zoomOut: () => {},
  rotate: () => {},
  reset: () => {},
  focus: () => {},
};
