const LogEntry = require('../models/LogEntry');
const { analyzeLogBatch } = require('../services/claude');
const { sendNotification } = require('../services/notification');

async function processBatch(jobs, config) {
  const pairs = [];

  for (const job of jobs) {
    const entry = await LogEntry.findById(job.logEntryId);
    if (!entry) {
      console.warn('Log entry not found:', job.logEntryId);
      continue;
    }
    entry.status = 'processing';
    await entry.save();
    pairs.push({ job, entry });
  }

  if (pairs.length === 0) {
    return;
  }

  try {
    const batchResult = await analyzeLogBatch(
      pairs.map((p) => p.job),
      config
    );
    const analyzedAt = new Date();

    for (let i = 0; i < pairs.length; i++) {
      const { job, entry } = pairs[i];
      const perLog = batchResult.logs?.find((l) => l.index === i) ?? batchResult.logs?.[i];
      const analysis = {
        summary: perLog?.summary || batchResult.incidentSummary,
        severity: perLog?.severity || batchResult.overallSeverity,
        recommendation: batchResult.recommendation,
        analyzedAt,
      };

      entry.status = 'done';
      entry.analysis = analysis;
      entry.errorMessage = undefined;
      await entry.save();

      await sendNotification(config, {
        event: 'log.analyzed',
        logEntryId: job.logEntryId,
        level: job.level,
        message: job.message,
        analysis,
      });
    }

    console.log(`Processed batch of ${pairs.length} logs — ${batchResult.overallSeverity}`);
  } catch (err) {
    for (const { job, entry } of pairs) {
      entry.status = 'failed';
      entry.errorMessage = err.message;
      await entry.save();

      await sendNotification(config, {
        event: 'log.failed',
        logEntryId: job.logEntryId,
        level: job.level,
        message: job.message,
        error: err.message,
      }).catch((notifyErr) => console.error('Notification error:', notifyErr.message));
    }

    console.error(`Failed batch of ${pairs.length} logs:`, err.message);
  }
}

module.exports = { processBatch };
