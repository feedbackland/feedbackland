/**
 * Minimal header shown when the board is embedded in the slide-in drawer widget,
 * in place of the full <PlatformHeader> (org title, navigation, account/theme
 * controls). The drawer is a focused "leave feedback" surface, so it carries
 * only a title — matching the widget's own accessible name ("Share your
 * feedback") — with the feedback form directly beneath it.
 */
export function PlatformHeaderDrawer() {
  return (
    <div className="pb-5">
      <h1 className="text-xl font-bold tracking-tight">Share your feedback</h1>
    </div>
  );
}
