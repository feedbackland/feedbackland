import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypePrettyCode from "rehype-pretty-code";
import { CopyButton } from "./copy-button";

const highlightCode = async ({
  code,
  language,
}: {
  code: string;
  language: "ts" | "tsx";
}) => {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypePrettyCode, {
      keepBackground: false,
      theme: "poimandres",
      defaultLang: language,
    })
    .use(rehypeStringify)
    .process(code);

  return String(file);
};

export async function CodeBlock({
  code,
  language,
}: {
  code: string;
  language: "ts" | "tsx";
}) {
  const highlightedCode = await highlightCode({
    code,
    language,
  });

  return (
    <div className="relative bg-primary rounded-lg">
      <CopyButton text={code} className="absolute top-2 right-2" />
      <div className="overflow-x-auto p-0 text-xs text-gray-200">
        <section
          dangerouslySetInnerHTML={{
            __html: highlightedCode,
          }}
        />
      </div>
    </div>
  );
}
