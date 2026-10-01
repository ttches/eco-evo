/**
 * Zoom (render pixels per world unit) at or above which per-glorp detail is
 * worth drawing. Below it a glorp is only a few pixels across, so the flat,
 * unlit disc is used instead. Shared so the glorp outline and the conception
 * hearts switch on together.
 */
export const DETAIL_MIN_ZOOM = 0.35
