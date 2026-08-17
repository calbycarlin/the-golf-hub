import { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-navy/10 bg-white p-4 shadow-sm sm:p-6 ${className}`}
      {...props}
    />
  );
}
