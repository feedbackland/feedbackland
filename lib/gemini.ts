import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const textEmbeddingModel = genAI.getGenerativeModel({
  model: "text-embedding-004",
});
