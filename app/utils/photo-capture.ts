/**
 * Open the camera / photo picker and resolve with the chosen File.
 *
 * Shared by the card scan and the QR read, so the awkward parts live in one
 * place: iOS Safari doesn't reliably fire `oncancel`, so a window refocus with
 * no `change` event is treated as a cancel — otherwise the promise dangles
 * forever and the screen sits in a capture state the user can't escape.
 * Rejects with `Error('Cancelled')`, which callers swallow silently.
 */
export function capturePhoto(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    let settled = false
    input.onchange = () => {
      settled = true
      const file = input.files?.[0]
      if (!file) { reject(new Error('Cancelled')); return }
      resolve(file)
    }
    input.oncancel = () => { settled = true; reject(new Error('Cancelled')) }
    const onFocus = () => {
      setTimeout(() => {
        window.removeEventListener('focus', onFocus)
        if (!settled) reject(new Error('Cancelled'))
      }, 800)
    }
    window.addEventListener('focus', onFocus)
    input.click()
  })
}
