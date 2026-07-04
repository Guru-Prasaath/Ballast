import parser from 'cron-parser';

export function isValidCron(expression: string): boolean {
  try {
    parser.parseExpression(expression);
    return true;
  } catch {
    return false;
  }
}

/** The next run time for a cron expression, at or after `from`. */
export function nextCronRun(expression: string, from: Date = new Date()): Date {
  return parser.parseExpression(expression, { currentDate: from }).next().toDate();
}
