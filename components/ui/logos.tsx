import { cn } from "@/lib/utils";

export function GoogleLogo({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="100%"
      className={cn("", className)}
    >
      <path
        d="m22.6 12.3-.2-2.3H12v4.3h6a5 5 0 0 1-2.3 3.3v2.7h3.6c2-1.9 3.3-4.7 3.3-8z"
        fill="#4285F4"
      />
      <path
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .6-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8A11 11 0 0 0 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.8 14a6.6 6.6 0 0 1 0-4V7H2.2a10.9 10.9 0 0 0 0 10L5 14.6l.8-.6z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.4A6 6 0 0 1 16.2 7L19.4 4A11 11 0 0 0 2.2 7l3.6 2.8A6.6 6.6 0 0 1 12 5.4z"
        fill="#EA4335"
      />
      <path d="M1 1h22v22H1z" fill="none" />
    </svg>
  );
}

export function MicrosoftLogo({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="100%"
      className={cn("", className)}
    >
      <path d="M0 0h10v10H0V0Z" fill="#F35325" />
      <path d="M11 0h10v10H11V0Z" fill="#81BC06" />
      <path d="M0 11h10v10H0V11Z" fill="#05A6F0" />
      <path d="M11 11h10v10H11V11Z" fill="#FFBA08" />
    </svg>
  );
}
