"use client";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Tiptap2 } from "@/components/ui/tiptap2";
import { Tiptap } from "@/components/ui/tiptap";
import { supabase } from "@/lib/supabase";

export function FeedbackForm() {
  const formSchema = z.object({
    title: z
      .string()
      .min(5, { message: "Hey the title is not long Enough" })
      .max(100, { message: "Hey the title is too long" }),
    description: z
      .string()
      .min(1, { message: "Hey the title is not long Enough" })
      .max(99999, { message: "Hey the title is too long" })
      .trim(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const processedDescription = await processImagesInHTML(
        values.description,
      );

      console.log({ ...values, description: processedDescription });
    } catch (error) {
      console.error("Error submitting feedback:", error);
    }
  }

  async function processImagesInHTML(html: string): Promise<string> {
    const base64Regex =
      /<img.*?src="(data:image\/(.*?);base64,([^"]*))"[^>]*>/g;
    let modifiedHTML = html;

    const matches = Array.from(html.matchAll(base64Regex));

    for (const match of matches) {
      const fullMatch = match[0];
      const dataURL = match[1];
      const imageType = match[2];
      const base64Data = match[3];

      try {
        const blob = base64ToBlob(base64Data, `image/${imageType}`);
        const filename = `feedback-image-${Date.now()}-${Math.random().toString(36).substring(7)}.${imageType}`;
        const { data, error } = await supabase.storage
          .from("your-bucket-name")
          .upload(filename, blob);

        if (error) {
          throw error;
        }

        const { data: urlData } = supabase.storage
          .from("your-bucket-name")
          .getPublicUrl(filename);
        const publicUrl = urlData.publicUrl;

        modifiedHTML = modifiedHTML.replace(
          fullMatch,
          `<img src="${publicUrl}" alt="Uploaded Image">`,
        );
      } catch (uploadError) {
        console.error("Error uploading image:", uploadError);
      }
    }

    return modifiedHTML;
  }

  function base64ToBlob(base64: string, contentType: string): Blob {
    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);

      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: contentType });
  }

  return (
    <>
      <main className="">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Main title for your Product"
                      className="w-full bg-background"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Tiptap
                      placeholder="Write your description here"
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button className="my-4" type="submit">
              Submit
            </Button>
          </form>
        </Form>
      </main>
    </>
  );
}
