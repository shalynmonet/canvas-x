import { Link } from "@tanstack/react-router";

interface LogoProps {
  to?: string;
  className?: string;
}

export function Logo({ to = "/", className = "" }: LogoProps) {
  const content = (
    <>
      <img
        src="/favicon.png"
        alt=""
        aria-hidden="true"
        className="h-7 w-auto object-contain"
      />
      <span className="font-display text-lg font-bold tracking-tight">CanvOps</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`flex items-center gap-2 ${className}`}>
        {content}
      </Link>
    );
  }

  return <span className={`flex items-center gap-2 ${className}`}>{content}</span>;
}
