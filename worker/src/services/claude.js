const Anthropic = require('@anthropic-ai/sdk');

let client;

function getClient(apiKey) {
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

function parseJsonResponse(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Claude response did not contain JSON');
  }
  return JSON.parse(jsonMatch[0]);
}

async function analyzeLogBatch(jobs, config) {
  const anthropic = getClient(config.anthropicApiKey);
  const capped = jobs.slice(0, config.batchMaxLogs);

  const logLines = capped
    .map((job, index) => {
      return `[${index}] level=${job.level} source=${job.source || 'unknown'} at=${job.loggedAt}
  message: ${job.message}
  metadata: ${JSON.stringify(job.metadata || {})}`;
    })
    .join('\n\n');

  const prompt = `You are a log analysis assistant for LogSentinel. Analyze this batch of ${capped.length} application log entries together. Look for patterns (attacks, outages, regressions). Respond with JSON only (no markdown):

{
  "incidentSummary": "one sentence describing the overall pattern across logs",
  "overallSeverity": "low|medium|high|critical",
  "recommendation": "one actionable next step for an engineer",
  "logs": [
    { "index": 0, "summary": "brief per-log summary", "severity": "low|medium|high|critical" }
  ]
}

Include one "logs" entry per input index (0 through ${capped.length - 1}).

Logs:
${logLines}`;

  const response = await anthropic.messages.create({
    model: config.anthropicModel,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const parsed = parseJsonResponse(text);

  if (!parsed.incidentSummary || !parsed.overallSeverity || !parsed.recommendation) {
    throw new Error('Claude JSON missing required batch fields');
  }

  if (!Array.isArray(parsed.logs)) {
    parsed.logs = [];
  }

  return parsed;
}

/** @deprecated Single-log analysis; worker uses analyzeLogBatch */
async function analyzeLog(job, config) {
  const batch = await analyzeLogBatch([job], config);
  const perLog = batch.logs[0];
  return {
    summary: perLog?.summary || batch.incidentSummary,
    severity: perLog?.severity || batch.overallSeverity,
    recommendation: batch.recommendation,
    analyzedAt: new Date(),
  };
}

module.exports = { analyzeLog, analyzeLogBatch };
