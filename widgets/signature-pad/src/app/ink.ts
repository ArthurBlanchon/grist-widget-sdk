/** A signature as strokes, and as the image saved in Grist. */

export type Point = { x: number; y: number }
export type Stroke = Point[]

/** The saved image's size: a page-like 3:1 box, independent of the pad's size on screen. */
export const IMAGE = { width: 900, height: 300 }

/** Draws `strokes` (in the pad's coordinates, 0 to 1 each way) into `ctx`, `width` × `height`. */
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: readonly Stroke[], width: number, height: number, ink: string) {
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.lineWidth = Math.max(2, width / 300)
  ctx.strokeStyle = ink
  for (const stroke of strokes) {
    if (stroke.length === 0) continue
    ctx.beginPath()
    ctx.moveTo(stroke[0]!.x * width, stroke[0]!.y * height)
    for (const p of stroke.slice(1)) ctx.lineTo(p.x * width, p.y * height)
    if (stroke.length === 1) ctx.lineTo(stroke[0]!.x * width + 0.1, stroke[0]!.y * height)
    ctx.stroke()
  }
}

/**
 * The signature as a PNG: dark ink on a white page, whatever the theme the
 * pad is shown in, so it prints and reads like a signature on paper. A
 * typed signature is the name, written large.
 */
export function signatureImage(signature: { strokes: readonly Stroke[] } | { typed: string }): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = IMAGE.width
  canvas.height = IMAGE.height
  const ctx = canvas.getContext("2d")
  if (!ctx) return Promise.reject(new Error("This browser can't draw the signature."))
  ctx.fillStyle = "white"
  ctx.fillRect(0, 0, IMAGE.width, IMAGE.height)
  if ("strokes" in signature) drawStrokes(ctx, signature.strokes, IMAGE.width, IMAGE.height, "black")
  else {
    ctx.fillStyle = "black"
    ctx.font = `italic ${IMAGE.height / 3}px serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(signature.typed, IMAGE.width / 2, IMAGE.height / 2, IMAGE.width * 0.9)
  }
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The signature could not be saved as an image."))), "image/png"))
}
