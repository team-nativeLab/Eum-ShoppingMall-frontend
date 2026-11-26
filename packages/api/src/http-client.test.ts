import { describe, expect, it, vi } from 'vitest';
import { ApiError, isRetryableError } from './errors';
import { createApiClient } from './http-client';

const origin = 'https://eum.https.gsmsv.site';

describe('createApiClient', () => {
  it('redirect는 차단되고 network 오류로 재시도 가능합니다', async () => {
    const redirectFetch = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      expect(init?.redirect).toBe('error');
      throw new TypeError('redirect blocked');
    });
    const error = await createApiClient(origin, redirectFetch)
      .request('/api/v1/products')
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: 'NETWORK' });
    expect(isRetryableError(error)).toBe(true);
  });

  it('response body read failure는 network 오류로 바꾸고 AbortError는 전달합니다', async () => {
    const readFailure = new TypeError('stream failed');
    const failedBodyFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(new ReadableStream({ start: (controller) => controller.error(readFailure) })),
      );
    const failedBody = await createApiClient(origin, failedBodyFetch)
      .request('/api/v1/products')
      .catch((caught: unknown) => caught);
    expect(failedBody).toMatchObject({ code: 'NETWORK' });
    expect(isRetryableError(failedBody)).toBe(true);

    const abort = new DOMException('cancelled while reading', 'AbortError');
    const abortedBodyFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(new ReadableStream({ start: (controller) => controller.error(abort) })),
      );
    await expect(
      createApiClient(origin, abortedBodyFetch).request('/api/v1/products'),
    ).rejects.toBe(abort);
  });

  it('API origin을 유지하고 envelope data를 반환하며 기본 credentials를 omit합니다', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id: 1 } })));
    const client = createApiClient(`${origin}/`, fetcher);
    await expect(client.request('/api/v1/products?query=a%20b')).resolves.toEqual({ id: 1 });
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(`${origin}/api/v1/products?query=a%20b`);
    expect(fetcher.mock.calls[0]?.[1]?.credentials).toBe('omit');
  });

  it('origin 탈출, 잘못된 prefix와 중복 prefix를 거부합니다', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = createApiClient(origin, fetcher);
    await expect(client.request('https://attacker.example/api/v1/x')).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(client.request('/api/api/v1/x')).rejects.toBeInstanceOf(ApiError);
    await expect(client.request('/api/v1/../../outside')).rejects.toBeInstanceOf(ApiError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('error envelope의 상태, 코드, 메시지와 필드 오류를 보존합니다', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_INPUT',
          message: '입력 오류',
          errors: [{ field: 'name', reason: '필수' }],
        }),
        { status: 422 },
      ),
    );
    await expect(
      createApiClient(origin, fetcher).request('/api/v1/products'),
    ).rejects.toMatchObject({
      status: 422,
      serverCode: 'INVALID_INPUT',
      message: '입력 오류',
      fieldErrors: [{ field: 'name', reason: '필수' }],
    });
  });

  it('204 및 잘못된 JSON 응답을 구분합니다', async () => {
    const empty = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    await expect(
      createApiClient(origin, empty).request('/api/v1/products'),
    ).resolves.toBeUndefined();
    const malformed = vi.fn<typeof fetch>().mockResolvedValue(new Response('{', { status: 200 }));
    await expect(
      createApiClient(origin, malformed).request('/api/v1/products'),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('network failure는 NETWORK로 바꾸고 AbortError는 전달합니다', async () => {
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'));
    await expect(
      createApiClient(origin, offline).request('/api/v1/products'),
    ).rejects.toMatchObject({ code: 'NETWORK' });
    const abort = new DOMException('cancelled', 'AbortError');
    const cancelled = vi.fn<typeof fetch>().mockRejectedValue(abort);
    await expect(createApiClient(origin, cancelled).request('/api/v1/products')).rejects.toBe(
      abort,
    );
  });

  it('FormData body에 Content-Type을 임의로 설정하지 않습니다', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const form = new FormData();
    form.set('name', 'item');
    await createApiClient(origin, fetcher).request('/api/v1/products', {
      method: 'POST',
      body: form,
    });
    const requestInit = fetcher.mock.calls[0]?.[1];
    expect(new Headers(requestInit?.headers).has('content-type')).toBe(false);
  });
});
