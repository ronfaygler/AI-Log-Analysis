const Anthropic = require('@anthropic-ai/sdk');

let client;

function getClient(apiKey) {
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

async function analyzeLog(job, config) {
  const anthropic = getClient(config.anthropicApiKey);

  const prompt = `You are a log analysis assistant for LogSentinel. Analyze this application log entry and respond with JSON only (no markdown):

{
  "summary": "one sentence what happened",
  "severity": "low|medium|high|critical",
  "recommendation": "one actionable next step for an engineer"
}

Log level: ${job.level}
Source: ${job.source || 'unknown'}
Message: ${job.message}
Metadata: ${JSON.stringify(job.metadata || {})}
Logged at: ${job.loggedAt}`;

  const response = await anthropic.messages.create({
    model: config.anthropicModel,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Claude response did not contain JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.summary || !parsed.severity || !parsed.recommendation) {
    throw new Error('Claude JSON missing required fields');
  }

  return {
    summary: parsed.summary,
    severity: parsed.severity,
    recommendation: parsed.recommendation,
    analyzedAt: new Date(),
  };
}

module.exports = { analyzeLog };
