export interface AlbumOrientationReading {beta: number; gamma: number}
export interface AlbumOrientationTilt {x: number; y: number}

/** A missing sensor axis is unavailable data, never the device's neutral angle. */
export function albumOrientationReading(beta: number | null, gamma: number | null): AlbumOrientationReading | null {
  return beta !== null && gamma !== null && Number.isFinite(beta) && Number.isFinite(gamma)
    ? {beta, gamma} : null;
}

function angleDifference(current: number, neutral: number, period: number): number {
  return ((current - neutral + period / 2) % period + period) % period - period / 2;
}

/** Small relative tilts expressed in screen-space CSS rotateX / rotateY degrees. */
export function albumOrientationTilt(reading: AlbumOrientationReading, neutral: AlbumOrientationReading,
                                     screenAngle = 0): AlbumOrientationTilt {
  const direct = {pitch: angleDifference(reading.beta, neutral.beta, 360),
    yaw: angleDifference(reading.gamma, neutral.gamma, 360)};
  // Crossing gamma's ±90° branch also changes beta to 180° − beta.
  // Choose the equivalent Euler branch nearest the held neutral pose, rather
  // than wrapping gamma alone and introducing a false 180° pitch jump.
  const alternate = {pitch: angleDifference(180 - reading.beta, neutral.beta, 360),
    yaw: angleDifference(reading.gamma + 180, neutral.gamma, 360)};
  const {pitch, yaw} = direct.pitch ** 2 + direct.yaw ** 2 <= alternate.pitch ** 2 + alternate.yaw ** 2
    ? direct : alternate;
  const angle = screenAngle * Math.PI / 180;
  const clamp = (value: number) => Math.max(-18, Math.min(18, value));
  return {
    x: clamp(-pitch * Math.cos(angle) - yaw * Math.sin(angle)),
    y: clamp(yaw * Math.cos(angle) - pitch * Math.sin(angle)),
  };
}
