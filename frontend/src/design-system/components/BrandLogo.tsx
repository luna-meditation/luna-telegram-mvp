import { lunaBrandAssets } from '../brand';

export function BrandLogo({
  size = 32,
  className = '',
  alt = 'Luna Meditation logo',
  eager = false
}: {
  size?: number;
  className?: string;
  alt?: string;
  eager?: boolean;
}) {
  return (
    <img
      src={lunaBrandAssets.mark}
      width={size}
      height={size}
      className={`brand-logo ${className}`}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}
