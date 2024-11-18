"use client";

import { authClient } from "@/app/utils/auth-client";
import { useState } from "react";
import { getOrgFromUrl } from "@/app/utils/helpers";

export function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const org = getOrgFromUrl();

  console.log(window?.location);

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
      <input
        type="name"
        placeholder="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        type="email"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button onClick={signUp}>Sign Up</button>
    </div>
  );
}
