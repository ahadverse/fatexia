import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
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

export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(new ValidationError(result.error.issues.map(describeIssue).join(', ')));
      return;
    }
    req[part] = result.data;
    next();
  };
}
