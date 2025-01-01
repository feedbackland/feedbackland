"use client";

import { authClient } from "@/app/utils/client/auth-client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

export function SignInForm({ onSuccess }: { onSuccess?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const router = useRouter();

  const signIn = async () => {
    const { data, error } = await authClient.signIn.email({
      email,
      password,
    });

    if (data && !error) {
      router.refresh();
      onSuccess?.();
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="mail@example.com"
          required
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" onClick={signIn}>
        Sign in
      </Button>
    </div>
  );
}
