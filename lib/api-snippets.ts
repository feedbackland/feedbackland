const ENDPOINT_PATH = "/api/feedback/create";

export const EXAMPLE_DESCRIPTION = "We need a dark mode option in the settings.";

type SnippetParams = {
  url: string;
  orgId: string;
};

const buildEndpointUrl = (url: string) =>
  url.length > 0
    ? `${url}${ENDPOINT_PATH}`
    : `https://your-platform.com${ENDPOINT_PATH}`;

export function buildCurl({ url, orgId }: SnippetParams): string {
  const body = JSON.stringify({ orgId, description: EXAMPLE_DESCRIPTION });
  const escaped = body.replace(/'/g, "'\\''");
  return [
    `curl -X POST ${buildEndpointUrl(url)} \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${escaped}'`,
  ].join("\n");
}

export function buildJs({ url, orgId }: SnippetParams): string {
  return [
    `const response = await fetch("${buildEndpointUrl(url)}", {`,
    `  method: "POST",`,
    `  headers: { "Content-Type": "application/json" },`,
    `  body: JSON.stringify({`,
    `    orgId: ${JSON.stringify(orgId)},`,
    `    description: ${JSON.stringify(EXAMPLE_DESCRIPTION)},`,
    `  }),`,
    `});`,
    ``,
    `const data = await response.json();`,
    `console.log(data);`,
  ].join("\n");
}

export function buildPython({ url, orgId }: SnippetParams): string {
  return [
    `import requests`,
    ``,
    `response = requests.post(`,
    `    ${JSON.stringify(buildEndpointUrl(url))},`,
    `    json={`,
    `        "orgId": ${JSON.stringify(orgId)},`,
    `        "description": ${JSON.stringify(EXAMPLE_DESCRIPTION)},`,
    `    },`,
    `)`,
    ``,
    `print(response.json())`,
  ].join("\n");
}
