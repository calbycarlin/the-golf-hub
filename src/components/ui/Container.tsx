export function Container({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 ${className}`} {...props} />;
}
