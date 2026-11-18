// OpenClaw Pixel Agents (MIT). c8ad068639626ac59dd8280c2acae011ec6e450a
// Original src/game/furnitureGeometry.ts; TypeScript types removed. See third-party/samples/openclaw-pixel-agents/LICENSE.
/** Grid-cell geometry around the centre of the stored anchor tile.
 * This describes rendered/navigation footprints, never placement legality.
 */
                                                                                           

export function furnitureRectangle(x        , y        , w        , h        , rawRotation = 0)                     {
  if (rawRotation % 90 !== 0) throw new RangeError('Furniture rotation must be a quarter turn');
  const rotation = ((rawRotation % 360) + 360) % 360;
  const swapsAxes = rotation === 90 || rotation === 270;
  if (rotation === 90) x += 1 - h;
  else if (rotation === 180) { x += 1 - w; y += 1 - h; }
  else if (rotation === 270) y += 1 - w;
  return { x, y, width: swapsAxes ? h : w, height: swapsAxes ? w : h };
}

export function rectanglesOverlap(a                    , b                    )          {
  return Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x)
    && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);
}

export function assessFurniturePreview(
  rectangle                    ,
  furniture                                            ,
  gridWidth        , gridHeight        , excludeId         ,
)                                                          {
  const { x, y, width, height } = rectangle;
  return {
    overlap: furniture.some(item => item.id !== excludeId && rectanglesOverlap(rectangle, item)),
    border: x < 1 || y < 1 || x + width > gridWidth - 1 || y + height > gridHeight - 1,
    outside: x < 0 || y < 0 || x + width > gridWidth || y + height > gridHeight,
  };
}
