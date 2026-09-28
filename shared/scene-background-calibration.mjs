export function sceneBackgroundViewportTransform(
  calibration,
  camera,
  zoom,
  cellSize,
) {
  return {
    translateX: (calibration.offsetX - camera.x * cellSize) * zoom,
    translateY: (calibration.offsetY - camera.y * cellSize) * zoom,
    scale: calibration.scale * zoom,
  };
}
