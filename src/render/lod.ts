/**
 * Zoom (render pixels per world unit) at or above which per-glorp detail is
 * worth drawing. Below it a glorp is only a few pixels across, so the flat,
 * unlit disc is used instead. Shared so the glorp outline and the conception
 * hearts switch on together.
 */
export const DETAIL_MIN_ZOOM = 0.35

/**
 * Zoom the glorp sprite is *authored* at. The detail shader snaps the silhouette
 * and sheen to this grid no matter how far the camera zooms, so a glorp always
 * reads as one fixed sprite (the same one the HoloLab previews) instead of
 * re-shading smoothly as you zoom in. Kept at the LOD threshold so the sprite is
 * exactly the lowest-detail view; never set it above `DETAIL_MIN_ZOOM`, or the
 * grid would be finer than one render pixel per sprite cell at that zoom.
 */
export const DETAIL_SPRITE_ZOOM = DETAIL_MIN_ZOOM
