"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
// import { Switch } from "@/components/ui/switch";

export function ModeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  if (theme) {
    // return (
    //   <Switch
    //     checked={theme === "dark"}
    //     onCheckedChange={() =>
    //       setTheme((theme) => (theme === "light" ? "dark" : "light"))
    //     }
    //   />
    // );

    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() =>
          setTheme((theme) => (theme === "light" ? "dark" : "light"))
        }
      >
        {theme === "light" ? (
          <Sun className="size-4" />
        ) : (
          <Moon className="size-4" />
        )}
        <span className="sr-only">Toggle dark mode</span>
      </Button>
    );
  }

  return null;
}
