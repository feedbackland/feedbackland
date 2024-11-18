"use client";
import { authClient } from "@/app/utils/auth-client";
import { useState } from "react";

export function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const signIn = async () => {
    const { data, error } = await authClient.signIn.email(
      {
        email,
        password,
      },
      {
        onRequest: () => {
          //show loading
        },
        onSuccess: () => {
          console.log("successfully signed in");
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
      <input
        type="email"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={signIn}>Sign In</button>
    </div>
  );
}
