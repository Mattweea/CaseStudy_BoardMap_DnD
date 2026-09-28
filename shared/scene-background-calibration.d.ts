export interface SceneBackgroundCalibration {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface SceneBackgroundViewportTransform {
  translateX: number;
  translateY: number;
  scale: number;
}

export function sceneBackgroundViewportTransform(
  calibration: SceneBackgroundCalibration,
  camera: { x: number; y: number },
  zoom: number,
  cellSize: number,
): SceneBackgroundViewportTransform;
