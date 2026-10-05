/**
 * Zoom (render pixels per world unit) at or above which per-glorp detail is
 * worth drawing. Below it a glorp is only a few pixels across, so the flat,
 * unlit disc is used instead. Shared so the glorp outline and the conception
 * hearts switch on together.
 */
export const DETAIL_MIN_ZOOM = 0.35

/**
 * Zoom the mutation flare is *authored* at. The detail shader snaps the flare's
 * sheen to this grid no matter how far the camera zooms, so a mutated glorp
 * always wears the same 8-bit pattern (the one the HoloLab previews) even as its
 * silhouette sharpens with the zoom. Kept at the LOD threshold so the flare is
 * exactly the lowest-detail view; never set it above `DETAIL_MIN_ZOOM`, or the
 * flare grid would be finer than one render pixel per sprite cell, and
 * `glorpShapeRadius` (sized from this zoom) would under-cover the coarser body
 * grid at the threshold and clip silhouettes.
 */
export const DETAIL_SPRITE_ZOOM = DETAIL_MIN_ZOOM
