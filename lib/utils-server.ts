import { textEmbeddingModel } from "@/lib/gemini";
import pgvector from "pgvector/pg";

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
