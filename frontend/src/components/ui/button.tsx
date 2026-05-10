import type { ButtonHTMLAttributes } from "react";

export function Button({ className = "", children, type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={className} {...rest}>
      {children}
    </button>
  );
}
