/**
 * Hillcrest three-cross mark.
 * Uses `currentColor` for the crosses, so it inverts to white (or any color)
 * just by setting the text color on the element or a parent.
 */
export function Logo({
  className = "",
  title = "Hillcrest",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="currentColor"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left cross */}
      <rect x="11" y="13" width="3.4" height="30" />
      <rect x="7.2" y="17" width="11" height="3.4" />
      {/* Center cross (tallest) */}
      <rect x="22.3" y="7" width="3.4" height="36" />
      <rect x="18.5" y="12" width="11" height="3.4" />
      {/* Right cross (shortest) */}
      <rect x="33.6" y="19" width="3.4" height="24" />
      <rect x="29.8" y="24" width="11" height="3.4" />
    </svg>
  );
}
