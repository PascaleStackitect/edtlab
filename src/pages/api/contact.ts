import {
    createEmailRoute, emailField, emailMessageField, escapeHtml, escapeMultiline,
    parseRecipients, renderEmailLayout, sendEmail
} from '~/utils/email';

// Types
interface ContactFormData {
    name: string;
    email: string;
    subject: string;
    message: string;
    privacy: boolean;
    organization?: string;
}

// Subject labels mapping
const subjectLabels: Record<string, string> = {
    'general': 'General Inquiry',
    'collaboration': 'Collaboration',
    'research': 'Research',
    'technical': 'Technical Support',
    'media': 'Media',
    'other': 'Other'
};

const replyTemplateStyles = `
        .reply-template { background-color: #e8f4f8; padding: 15px; margin-top: 20px; border-radius: 5px; }
        .reply-template h3 { color: #665BA7; margin-top: 0; }`;

/**
 * Generate HTML email content
 */
const generateEmailHtml = (data: ContactFormData): string => {
    const userName = escapeHtml(data.name);
    const userEmail = escapeHtml(data.email);
    const subjectLabel = subjectLabels[data.subject] || data.subject;
    const organizationText = data.organization && data.organization.trim()
        ? escapeHtml(data.organization)
        : 'Not specified';

    // Create mailto link
    const mailtoSubject = encodeURIComponent(`Re: ${subjectLabel}`);
    const mailtoBody = encodeURIComponent(
        `Dear ${userName},\n\n` +
        `Thank you for contacting the EDT Research Program. We have received your message regarding ${subjectLabel}.\n\n` +
        `[Your response here]\n\n` +
        `Best regards,\n` +
        `EDT Research Team`
    );
    const mailtoLink = `mailto:${userEmail}?subject=${mailtoSubject}&body=${mailtoBody}`;

    return renderEmailLayout({
        title: 'New Contact Form Submission',
        footer: 'This email was sent from the EDT Research Program contact form',
        extraStyles: replyTemplateStyles,
        content: `
            ${emailField('From:', `${userName} &lt;${userEmail}&gt;`)}
            ${emailField('Organization:', organizationText)}
            ${emailField('Subject:', subjectLabel)}
            ${emailMessageField('Message:', escapeMultiline(data.message))}

            <div class='reply-template'>
                <a href='${mailtoLink}' style='display: inline-block; background-color: #665BA7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-bottom: 15px;'>
                    Reply to ${userName}
                </a>
                <p style='font-size: 13px; color: #666;'>
                    Or click 'Reply' in your email client to respond directly to <strong>${userEmail}</strong>
                </p>
                <hr style='border: none; border-top: 1px solid #ddd; margin: 15px 0;'>
                <p style='font-size: 13px; color: #666; margin-bottom: 5px;'><strong>Suggested reply template:</strong></p>
                <p style='font-style: italic; color: #666; font-size: 13px; background-color: white; padding: 10px; border-radius: 3px;'>
                    Dear ${userName},<br><br>
                    Thank you for contacting the EDT Research Program. We have received your message regarding ${subjectLabel}.<br><br>
                    [Your response here]<br><br>
                    Best regards,<br>
                    EDT Research Team
                </p>
            </div>`
    });
};

export const POST = createEmailRoute<ContactFormData>({
    name: 'contact form',
    validate: ({ name, email, subject, message, privacy, organization }) => {
        if (!name || !email || !subject || !message || privacy === undefined) {
            return { error: 'Missing required fields' };
        }
        if (!privacy) {
            return { error: 'Privacy notice must be accepted' };
        }
        return { data: { name, email, subject, message, privacy, organization } };
    },
    send: (data) => sendEmail({
        tag: 'contact',
        to: parseRecipients(process.env.LIST_INBOX || import.meta.env.LIST_INBOX),
        replyTo: { email: data.email, name: data.name },
        subject: `Contact Form: ${subjectLabels[data.subject] || data.subject} - ${data.name}`,
        htmlContent: generateEmailHtml(data),
        devPayload: data,
    }),
});
