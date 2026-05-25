const LogEntry = require('../models/LogEntry');
const { analyzeLog } = require('../services/claude');
const { sendNotification } = require('../services/notification');

async function processJob(job, config) {
  if (job.type !== 'analyze_log' || !job.logEntryId) {
    console.warn('Skipping unknown job type:', job.type);
    return;
  }

  const entry = await LogEntry.findById(job.logEntryId);
  if (!entry) {
    console.warn('Log entry not found:', job.logEntryId);
    return;
  }

  entry.status = 'processing';
  await entry.save();

  try {
    const analysis = await analyzeLog(job, config);

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

    console.log(`Processed log ${job.logEntryId} — ${analysis.severity}`);
  } catch (err) {
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

    console.error(`Failed log ${job.logEntryId}:`, err.message);
  }
}

module.exports = { processJob };
