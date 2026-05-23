export function SkeletonBlock({ className = '' }) {
  return <div className={`savo-shimmer rounded-xl ${className}`} />;
}

export function SkeletonText({ width = 'w-full', className = '' }) {
  return <div className={`savo-shimmer h-3 rounded ${width} ${className}`} />;
}
