import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../common/errors';

/**
 * The controller's job beyond calling the service is to make sure a postback that never
 * reaches the service still leaves a trace.
 *
 * This is the bug these tests exist for: the query schema used to run as route
 * middleware, in front of everything, so an advertiser sending a value that did not
 * parse — overwhelmingly a macro their platform had not substituted — was answered 400
 * and recorded nowhere. The postback log stayed empty, and the only available reading
 * of an empty log is that the request had never arrived.
 */
const { createLog, handlePostback } = vi.hoisted(() => ({
  createLog: vi.fn(),
  handlePostback: vi.fn(async () => ({ conversionId: 'conv-1' })),
}));

vi.mock('../postback-logs/postback-log.repository', () => ({ postbackLogRepository: { create: createLog } }));
vi.mock('./postback.service', () => ({ postbackService: { handlePostback } }));

import { PostbackDirection } from '../postback-logs/postback-log.entity';
import { postbackController } from './postback.controller';

function run(query: Record<string, unknown>) {
  const req = { query, ip: '203.0.113.10' } as unknown as Request;
  const send = vi.fn();
  const res = { status: vi.fn(() => ({ send })) } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { promise: postbackController.handlePostback(req, res, next), next: next as unknown as ReturnType<typeof vi.fn>, send };
}

describe('postbackController.handlePostback', () => {
  beforeEach(() => {
    createLog.mockReset();
    handlePostback.mockReset();
    handlePostback.mockResolvedValue({ conversionId: 'conv-1' });
  });

  it('records a rejected postback before answering 400', async () => {
    const { promise, next } = run({ click_id: 'CLK-1001', secret: 's3cret', sum: 'not-a-number' });
    await promise;

    expect(createLog).toHaveBeenCalledTimes(1);
    const row = createLog.mock.calls[0][0];
    expect(row.direction).toBe(PostbackDirection.INBOUND);
    expect(row.success).toBe(false);
    expect(row.responseStatus).toBe(400);
    expect(row.sourceIp).toBe('203.0.113.10');
    // The whole query is kept, so the admin can see exactly what was sent.
    expect(row.payload).toEqual({ click_id: 'CLK-1001', secret: 's3cret', sum: 'not-a-number' });
    expect(row.errorMessage).toContain('sum');

    expect(handlePostback).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  // /postback is public and logged before any secret is checked, so a scanner must not
  // be able to write rows by hitting it. Carrying one of our own parameters is the line.
  it.each([{}, { id: '1' }, { utm_source: 'x' }])('does not record the bare probe %j', async (query) => {
    const { promise, next } = run(query);
    await promise;

    expect(createLog).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it('truncates an oversized value rather than storing it whole', async () => {
    const { promise } = run({ secret: 's3cret', click_id: 'x'.repeat(5000), sum: 'nope' });
    await promise;

    const stored = createLog.mock.calls[0][0].payload.click_id as string;
    expect(stored).toHaveLength(513);
    expect(stored.endsWith('…')).toBe(true);
  });

  it('still answers 400 when the log write itself fails', async () => {
    createLog.mockRejectedValue(new Error('database is down'));
    const { promise, next } = run({ click_id: 'CLK-1001', secret: 's3cret', sum: 'nope' });
    await promise;

    // Not a 500: the advertiser's platform would read that as retryable and keep
    // re-sending a request that can never succeed.
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it('passes a valid postback through to the service and answers 200', async () => {
    const { promise, next, send } = run({ click_id: 'CLK-1001', secret: 's3cret', sum: '1.30' });
    await promise;

    expect(createLog).not.toHaveBeenCalled();
    expect(handlePostback).toHaveBeenCalledWith(expect.objectContaining({ clickId: 'CLK-1001', reportedRevenue: 1.3 }));
    expect(send).toHaveBeenCalledWith('OK');
    expect(next).not.toHaveBeenCalled();
  });

  // The case that started this: affmine sends `sum=#payout#` when the token is wrong.
  // It must reach the service, which refuses it *after* resolving the click and offer
  // and therefore logs a row the admin can attribute.
  it('lets an unsubstituted amount macro through to the service', async () => {
    const { promise } = run({ click_id: 'CLK-1001', secret: 's3cret', sum: '#payout#' });
    await promise;

    expect(createLog).not.toHaveBeenCalled();
    expect(handlePostback).toHaveBeenCalledWith(expect.objectContaining({ reportedRevenue: null }));
  });
});
