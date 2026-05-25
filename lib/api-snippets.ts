type SnippetParams = {
  url: string;
  orgId: string;
  description: string;
};

const ENDPOINT_PATH = "/api/feedback/create";

const fallbackUrl = (url: string) =>
  url.length > 0 ? `${url}${ENDPOINT_PATH}` : `https://your-platform.com${ENDPOINT_PATH}`;

export function buildCurl({ url, orgId, description }: SnippetParams): string {
  const body = JSON.stringify({ orgId, description });
  const escapedBody = body.replace(/'/g, "'\\''");
  return [
    `curl -X POST ${fallbackUrl(url)} \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${escapedBody}'`,
  ].join("\n");
}

export function buildJs({ url, orgId, description }: SnippetParams): string {
  return [
    `const response = await fetch("${fallbackUrl(url)}", {`,
    `  method: "POST",`,
    `  headers: { "Content-Type": "application/json" },`,
    `  body: JSON.stringify({`,
    `    orgId: ${JSON.stringify(orgId)},`,
    `    description: ${JSON.stringify(description)},`,
    `  }),`,
    `});`,
    ``,
    `const data = await response.json();`,
    `console.log(data);`,
  ].join("\n");
}

export function buildPython({ url, orgId, description }: SnippetParams): string {
  return [
    `import requests`,
    ``,
    `response = requests.post(`,
    `    ${JSON.stringify(fallbackUrl(url))},`,
    `    json={`,
    `        "orgId": ${JSON.stringify(orgId)},`,
    `        "description": ${JSON.stringify(description)},`,
    `    },`,
    `)`,
    ``,
    `print(response.json())`,
  ].join("\n");
}
