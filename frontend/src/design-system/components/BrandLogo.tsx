import { lunaBrandAssets } from '../brand';
import {OptimizedImage} from './OptimizedImage';

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
    <OptimizedImage
      src={lunaBrandAssets.mark}
      width={size}
      height={size}
      sizes={`${size}px`}
      className={`brand-logo ${className}`}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}
