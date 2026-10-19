export function eventBelongsToActiveScene(
  payload: unknown,
  activeSceneId: string | null,
): payload is { sceneId: string } {
  return Boolean(
    activeSceneId
    && payload
    && typeof payload === 'object'
    && 'sceneId' in payload
    && payload.sceneId === activeSceneId,
  );
}
