import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`w-full rounded-xl border-2 border-navy/15 bg-white px-4 py-3 text-base text-navy placeholder:text-navy/40 focus:border-navy focus:outline-none ${className}`}
        {...props}
      />
    );
  }
);

export function Label({ className = "", ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`mb-1.5 block text-sm font-semibold text-navy/80 ${className}`} {...props} />;
}
