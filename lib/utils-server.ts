import { textEmbeddingModel } from "@/lib/gemini";
import pgvector from "pgvector/pg";
import { v4 as uuidv4 } from "uuid";
import imageSize from "image-size";
import { put } from "@vercel/blob";

export const generateVector = async (text: string) => {
  try {
    const result = await textEmbeddingModel.embedContent(text);
    return result.embedding.values;
  } catch {
    throw new Error("Failed to generate vector");
  }
};

export const generateEmbedding = async (text: string) => {
  try {
    const vector = await generateVector(text);
    return pgvector.toSql(vector);
  } catch {
    throw new Error("Failed to generate embedding");
  }
};

export const base64ToBlob = ({
  base64,
  contentType,
}: {
  base64: string;
  contentType: string;
}) => {
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
};

export const processImagesInHTML = async (html: string) => {
  const base64Regex = /<img.*?src="(data:image\/(.*?);base64,([^"]*))"[^>]*>/g;

  let modifiedHTML = html; // Start with original HTML

  const matches = Array.from(html.matchAll(base64Regex));

  // Create an array of promises, one for each image processing task
  const processingPromises = matches.map(async (match) => {
    const fullMatch = match[0];
    const imageType = match[2];
    const base64Data = match[3];

    try {
      // Decode base64 to buffer for image-size
      const imageBuffer = Buffer.from(base64Data, "base64");

      const { width, height } = imageSize(imageBuffer); // Get dimensions

      const blob = base64ToBlob({
        base64: base64Data,
        contentType: `image/${imageType}`,
      });

      const filename = `image-${uuidv4()}.${imageType}`;

      const { url } = await put(filename, blob, {
        access: "public",
      });

      // Return the original match and the replacement string
      return {
        original: fullMatch,
        replacement: `<img src="${url}" alt="Uploaded Image" width="${width}" height="${height}">`,
      };
    } catch (error) {
      console.error(
        "Error processing image:",
        error,
        "Original match:",
        fullMatch,
      );

      // Return null or the original match if processing fails for this image
      return { original: fullMatch, replacement: fullMatch }; // Keep original if error
    }
  });

  // Wait for all image processing tasks to complete
  const results = await Promise.all(processingPromises);

  // Perform replacements after all promises are resolved
  results.forEach((result) => {
    if (result) {
      // Ensure result is not null/undefined from potential errors handled above
      modifiedHTML = modifiedHTML.replace(result.original, result.replacement);
    }
  });

  return modifiedHTML; // Return the final modified HTML
};
