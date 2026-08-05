import Image from "next/image";

type ScreenshotProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
};

/**
 * Renders a real product screenshot at its native aspect ratio, styled to
 * match where ScreenshotPlaceholder left off (rounded corners, no forced
 * crop). Swap a ScreenshotPlaceholder for this once the real asset lands
 * in public/screenshots/.
 */
export default function Screenshot({
  src,
  alt,
  width,
  height,
  className = "",
  priority = false,
}: ScreenshotProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={`h-auto w-full rounded-df-lg ${className}`}
    />
  );
}
