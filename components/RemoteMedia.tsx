import Image from "next/image";

export function RemoteMedia({ src, alt, width = 1200, height = 800, sizes = "(max-width: 640px) 100vw, 50vw", className = "h-full w-full object-cover", priority = false }: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  return <Image src={src} alt={alt} width={width} height={height} sizes={sizes} className={className} priority={priority} quality={82} />;
}
