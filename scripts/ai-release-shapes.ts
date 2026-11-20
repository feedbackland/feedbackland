import { crc32, deflateSync } from "node:zlib";
import { inputBytes } from "../lib/ai-request-limits";
import {
  insightChunkRequest,
  insightChunks,
  insightMergeRequest,
} from "../lib/jobs/insight-analysis";
import type { calibrationClient } from "../lib/llm/client";
import { moderatePrompt, moderationInput } from "../lib/llm/content-prompts";
import type { ChatInput, VisionAsset } from "../lib/llm/input-budgets";
import type { InsightPost } from "../queries/get-insights-inputs";

const width = 2000;
const imageBytes = 1_000_000;

function pngChunk(type: string, data: Buffer) {
  const value = Buffer.alloc(data.length + 12);
  value.writeUInt32BE(data.length, 0);
  value.write(type, 4, "ascii");
  data.copy(value, 8);
  value.writeUInt32BE(crc32(value.subarray(4, -4)), value.length - 4);
  return value;
}

function chart(index: number) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(width, 4);
  header[8] = 8; // 8-bit grayscale with a zero (None) filter byte for each row.
  const pixels = Buffer.alloc((width + 1) * width);
  for (let row = 0; row < width; row++) {
    const offset = row * (width + 1) + 1;
    pixels.fill(245, offset, offset + width);
    for (let column = 0; column < 7; column++) {
      if (row >= 1600 - 150 * ((column + index) % 7) && row < 1600) {
        const left = offset + 100 + column * 260;
        pixels.fill(40 + column * 12, left, left + 210);
      }
    }
  }
  const signature = Buffer.from("89504e470d0a1a0a", "hex");
  const dimensions = pngChunk("IHDR", header);
  const data = pngChunk("IDAT", deflateSync(pixels));
  const end = pngChunk("IEND", Buffer.alloc(0));
  const description = Buffer.alloc(
    imageBytes -
      signature.length -
      dimensions.length -
      data.length -
      end.length -
      12,
    32,
  );
  description.write("Description\0Synthetic chart " + index);
  return Buffer.concat([
    signature,
    dimensions,
    data,
    pngChunk("tEXt", description),
    end,
  ]);
}

type ReleaseShape = {
  id: string;
  feature: "moderation" | "insights";
  input: ChatInput;
  images?: readonly VisionAsset[];
  validateText?: (value: string) => true;
  reply: string;
};

function repeatText(text: string, characters: number) {
  return text.repeat(Math.ceil(characters / text.length)).slice(0, characters);
}

export function releaseRequestShapes(): ReleaseShape[] {
  const posts = Array.from({ length: 100 }, (_, index): InsightPost => ({
    id: String(index + 1),
    title: repeatText("Add filtering for customer feedback. ", 160),
    description: repeatText(
      "Please add a way to find reports about the same area of the product. ",
      700,
    ),
    category: null,
    created: 0,
    upvotes: 0,
    anonymous: true,
    votesLimited: false,
    commentsLimited: false,
    comments: 0,
    recentComments: 0,
    recentVotes: 0,
    voteMomentum: 0,
    lastVote: null,
  }));
  const chunk = insightChunkRequest(insightChunks(posts)[0]);
  const merge = insightMergeRequest(
    Array.from({ length: 200 }, () => ({
      title: repeatText("Add filtering for customer feedback. ", 160),
      description: repeatText(
        "People who read the board need a better way to find reports about the same product area. ",
        115,
      ),
    })),
  );
  const vision = moderationInput(
    repeatText(
      "Please make the board filters easier to use. The charts illustrate sorting preferences. ",
      inputBytes.moderation - Buffer.byteLength(moderatePrompt),
    ),
  );
  return [
    {
      id: "maximum/insight-chunk",
      feature: "insights",
      input: chunk.input,
      validateText: (text) => {
        chunk.validateText(text);
        return true;
      },
      reply: '{"insights":[]}',
    },
    {
      id: "maximum/insight-merge",
      feature: "insights",
      input: merge.input,
      validateText: (text) => {
        merge.validateText(text);
        return true;
      },
      reply: '{"groups":[]}',
    },
    {
      id: "maximum/moderation-vision",
      feature: "moderation",
      input: vision,
      images: Array.from({ length: 4 }, (_, i) => ({
        id: "synthetic-chart-" + i,
        contentType: "image/png",
        byteSize: imageBytes,
        width,
        height: width,
        load: async (signal) => {
          signal.throwIfAborted();
          return chart(i);
        },
      })),
      reply: '{"isInappropriate":false,"confidenceScore":0.99}',
    },
  ];
}

export function runReleaseShape(
  client: ReturnType<typeof calibrationClient>,
  shape: ReleaseShape,
  options: Parameters<ReturnType<typeof calibrationClient>["chat"]>[2],
) {
  return client.chat(shape.feature, shape.input, options, {
    images: shape.images,
    validateText: shape.validateText,
  });
}
