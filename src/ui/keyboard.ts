/** Whether a key event target is a field where typing should win over hotkeys. */
export const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable)

/** Whether a key event target natively activates on Space (buttons, links). */
export const isSpaceActivatingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLButtonElement ||
  target instanceof HTMLAnchorElement ||
  (target instanceof HTMLElement && target.getAttribute('role') === 'button')
