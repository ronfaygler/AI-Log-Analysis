export function loadEnv() {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) {
    throw new Error('Missing required environment variable: API_URL');
  }

  const authToken = process.env.MCP_AUTH_TOKEN;
  const email = process.env.MCP_EMAIL;
  const password = process.env.MCP_PASSWORD;

  if (!authToken && (!email || !password)) {
    throw new Error('Set MCP_AUTH_TOKEN or both MCP_EMAIL and MCP_PASSWORD');
  }

  return {
    port: Number(process.env.PORT) || 4001,
    apiUrl: apiUrl.replace(/\/$/, ''),
    authToken,
    email,
    password,
    transport: process.env.MCP_TRANSPORT || 'http',
  };
}
