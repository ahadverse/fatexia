import type { NextFunction, Request, Response } from 'express';
import type { ZodError, ZodSchema } from 'zod';
import { ValidationError } from './errors';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Zod's own messages describe the rule, not the field — a form with three optional
 * URLs fails with a bare "Invalid url" and the user has no way to tell which one.
 * Prefixing the path makes every validation error across the API self-explanatory.
 *
 * Array indices are kept (`payoutRules.0.amount`) because on a repeated section
 * knowing *which* row failed is the whole answer.
 */
function describeIssue(issue: { path: (string | number)[]; message: string }): string {
  return issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message;
}

/**
 * The one-line, field-prefixed summary of why a parse failed.
 *
 * Split out of `validate` because /postback does not use that middleware: it has to
 * record a rejected request before answering, so it parses the query itself and needs
 * the identical message to put in the log. Two spellings of the same failure would make
 * a postback log row read differently from the response the advertiser was handed.
 */
export function zodMessage(error: ZodError): string {
  return error.issues.map(describeIssue).join(', ');
}

export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(new ValidationError(zodMessage(result.error)));
      return;
    }
    req[part] = result.data;
    next();
  };
}
