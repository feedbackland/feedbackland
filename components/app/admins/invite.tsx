"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const FormSchema = z.object({
  email: z.string().email(),
});

export function AdminsInvite() {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(formData: z.infer<typeof FormSchema>) {
    // await updateOrg.mutateAsync({ platformTitle: formData.platformTitle });
    // setIsEditing(false);
  }

  return (
    <div>
      <Label className="mb-2">Invite admins</Label>
      <div className="border-border rounded-md border p-4 shadow-xs">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Email to invite</FormLabel>
                  <FormControl>
                    <div className="flex flex-row items-center gap-4">
                      <Input
                        type="email"
                        autoFocus={true}
                        className="w-full text-sm"
                        placeholder="The email of the person you want to invite"
                        {...field}
                      />
                      <Button type="submit" size="sm" className="h-[36px]">
                        Send invite
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>
    </div>
  );
}
