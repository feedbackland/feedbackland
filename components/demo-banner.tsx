"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function DemoBanner() {
  const { isAdmin, isLoaded } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (window.location.hostname === "demo.feedbackland.com") {
      setShow(true);
    }
  }, []);

  if (!show || (isLoaded && isAdmin)) return null;

  return (
    <div className="bg-primary text-primary-foreground flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium">
      <Info className="h-4 w-4" />
      <span>
        You can log into the admin account by using the email{" "}
        <strong>admin@demo.com</strong> and password <strong>demo1234</strong>
      </span>
    </div>
  );
}
