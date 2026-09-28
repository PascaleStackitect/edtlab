import {
    createEmailRoute, emailField, emailMessageField, escapeHtml, escapeMultiline,
    parseRecipients, renderEmailLayout, sendEmail
} from '~/utils/email';

// PhD club membership ("Club des doctorants") application.
// During the trial phase, applications are emailed to a single inbox
// (default guy.de-spiegeleer@inria.fr, overridable via PHD_CLUB_INBOX).

// Types
interface MembershipFormData {
    firstName: string;
    lastName: string;
    email: string;
    institution: string;
    supervisors: string;
    startDate: string;
    pcs: string[];
    funding: string;
    funder: string;
    thesisDescription: string;
    motivation: string;
    consentSupervisors: boolean;
    consentCharter: boolean;
    mailingList: boolean;
}

// Human-readable labels for the funding type select values.
const fundingLabels: Record<string, string> = {
    'doctoral-contract': 'Contrat doctoral (établissement ou organisme public)',
    'cifre': 'Convention CIFRE (entreprise)',
    'project': 'Financement sur projet',
    'other': 'Autre',
};

/**
 * Generate HTML email content
 */
const generateEmailHtml = (data: MembershipFormData): string => {
    const pcs = Array.isArray(data.pcs) ? escapeHtml(data.pcs.join(', ')) : '';
    const funder = data.funder && data.funder.trim() ? escapeHtml(data.funder) : 'Non précisé';

    const yes = '✅';
    const mailing = data.mailingList ? 'Oui' : 'Non';

    return renderEmailLayout({
        title: "Nouvelle demande d'adhésion — Club des doctorants",
        footer: "Demande envoyée depuis le formulaire d'adhésion au Club des doctorants — EDT Research Program",
        content: `
            ${emailField('Nom / Prénom :', `${escapeHtml(data.lastName)} ${escapeHtml(data.firstName)}`)}
            ${emailField('Email :', `&lt;${escapeHtml(data.email)}&gt;`)}
            ${emailField('Institution :', escapeHtml(data.institution))}
            ${emailField('Encadrant(s) :', escapeHtml(data.supervisors))}
            ${emailField('Date de démarrage de la thèse :', escapeHtml(data.startDate))}
            ${emailField('Projets ciblés (PC) :', pcs)}
            ${emailField('Financement :', escapeHtml(fundingLabels[data.funding] || data.funding))}
            ${emailField('Financeur :', funder)}
            ${emailMessageField('Descriptif de la thèse :', escapeMultiline(data.thesisDescription))}
            ${emailMessageField('Motivation pour rejoindre le club :', escapeMultiline(data.motivation))}
            ${emailField('Accord des encadrants :', yes)}
            ${emailField('Charte lue et acceptée :', yes)}
            ${emailField('Inscription liste de diffusion :', mailing)}`
    });
};

export const POST = createEmailRoute<MembershipFormData>({
    name: 'membership application',
    validate: ({
        firstName, lastName, email, institution,
        supervisors, startDate, pcs, funding, funder, thesisDescription, motivation,
        consentSupervisors, consentCharter, mailingList
    }) => {
        if (!firstName || !lastName || !email || !institution ||
            !supervisors || !startDate || !funding || !funder || !thesisDescription || !motivation ||
            !Array.isArray(pcs) ||
            consentSupervisors === undefined || consentCharter === undefined ||
            mailingList === undefined) {
            return { error: 'Missing required fields' };
        }
        if (!consentSupervisors || !consentCharter || !mailingList) {
            return { error: 'All consents must be accepted' };
        }
        return {
            data: {
                firstName, lastName, email, institution,
                supervisors, startDate, pcs, funding, funder, thesisDescription, motivation,
                consentSupervisors, consentCharter, mailingList: !!mailingList
            }
        };
    },
    send: (data) => sendEmail({
        tag: 'phd-club',
        to: parseRecipients(process.env.PHD_CLUB_INBOX || import.meta.env.PHD_CLUB_INBOX),
        replyTo: { email: data.email, name: `${data.firstName} ${data.lastName}` },
        subject: `Club des doctorants — Adhésion : ${data.lastName} ${data.firstName}`,
        htmlContent: generateEmailHtml(data),
        devPayload: data,
    }),
});
