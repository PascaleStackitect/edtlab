import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendTransacEmail = vi.fn();

vi.mock('@getbrevo/brevo', () => ({
    TransactionalEmailsApi: class {
        setApiKey() {}
        sendTransacEmail = sendTransacEmail;
    },
    TransactionalEmailsApiApiKeys: { apiKey: 0 },
    SendSmtpEmail: class {},
}));

import { createEmailRoute, sendEmail, InvalidReplyToError } from '@utils/email';

// Shape of the axios error the Brevo SDK rejects with
const brevoError = (status: number, message: string) =>
    Object.assign(new Error(`Request failed with status code ${status}`), {
        response: { status, data: { code: 'invalid_parameter', message } },
    });

const route = createEmailRoute<{ email: string }>({
    name: 'test form',
    validate: (body) => ({ data: body }),
    send: ({ email }) => sendEmail({
        tag: 'test',
        to: ['inbox@example.org'],
        replyTo: { email, name: 'Test' },
        subject: 'Test',
        htmlContent: '<p>Test</p>',
        devPayload: {},
    }),
});

let ip = 0;
const post = (body: unknown) => route({
    request: new Request('http://localhost/api/test', {
        method: 'POST',
        // A fresh IP per call so the rate limiter never kicks in
        headers: { 'x-forwarded-for': `10.0.0.${++ip}` },
        body: JSON.stringify(body),
    }),
} as any) as Promise<Response>;

describe('sendEmail / createEmailRoute — Brevo errors', () => {
    beforeEach(() => {
        sendTransacEmail.mockReset();
        process.env.BREVO_API_KEY = 'test-key';
    });

    it('maps a Brevo 400 on replyTo to InvalidReplyToError', async () => {
        sendTransacEmail.mockRejectedValue(brevoError(400, 'replyTo email is not valid'));
        await expect(sendEmail({
            tag: 'test', to: ['inbox@example.org'], replyTo: { email: 'a@inria.f', name: 'A' },
            subject: 's', htmlContent: 'h', devPayload: {},
        })).rejects.toBeInstanceOf(InvalidReplyToError);
    });

    it('answers 400 invalid_email when Brevo rejects the submitter address', async () => {
        sendTransacEmail.mockRejectedValue(brevoError(400, 'replyTo email is not valid'));
        const res = await post({ email: 'a@inria.f' });
        expect(res.status).toBe(400);
        expect(await res.json()).toMatchObject({ code: 'invalid_email' });
    });

    it('keeps other Brevo errors as 500', async () => {
        sendTransacEmail.mockRejectedValue(brevoError(401, 'Key not found'));
        const res = await post({ email: 'a@inria.fr' });
        expect(res.status).toBe(500);
        expect(await res.json()).not.toHaveProperty('code');
    });

    it('succeeds when Brevo accepts the email', async () => {
        sendTransacEmail.mockResolvedValue({});
        const res = await post({ email: 'a@inria.fr' });
        expect(res.status).toBe(200);
    });
});
