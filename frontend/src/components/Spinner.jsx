export default function Spinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-3',
  };

  return (
    <div className={`inline-flex items-center justify-center ${className}`} role="status">
      <div
        className={`${sizeClasses[size] || sizeClasses.md} rounded-full border-slate-300 border-t-indigo-600 animate-spin`}
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
