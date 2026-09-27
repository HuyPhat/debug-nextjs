// Server Component. Tells you when the HTML you're looking at was produced:
// if this changes on every reload, nothing is being cached.
export function RenderedAt() {
  return (
    <p className="rendered-at">
      HTML rendered on the server at <code>{new Date().toISOString()}</code>
    </p>
  )
}
