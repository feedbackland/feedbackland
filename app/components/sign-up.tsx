"use client";

import { authClient } from "@/app/utils/auth-client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  console.log("SignUp window?.location?.host", window?.location?.host);
  console.log("SignUp window?.location?.origin", window?.location?.origin);

  const signUp = async () => {
    const { data, error } = await authClient.signUp.email(
      {
        email,
        password,
        name,
      },
      {
        onRequest: () => {
          //show loading
        },
        onSuccess: () => {
          console.log("successfully signed up");
        },
        onError: (ctx: any) => {
          console.log(ctx.error.message);
        },
      }
    );

    console.log("data", data);
    console.log("error", error);
  };

  return (
    <div>
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Sign up</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="name"
                placeholder="John Doe"
                required
                onChange={(e) => setName(e.target.value)}
              />
            </div>
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
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                required
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" onClick={signUp}>
              Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
