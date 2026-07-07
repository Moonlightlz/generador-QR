/**
 * Builders for static QR payloads. Everything is encoded directly into the
 * QR matrix — no shortener, no redirect service, no expiry. What you encode
 * is exactly what any scanner reads, forever.
 */

export type ContentType = 'url' | 'text' | 'wifi' | 'vcard' | 'email' | 'phone' | 'whatsapp';

export interface WifiData {
  ssid: string;
  password: string;
  security: 'WPA' | 'WEP' | 'nopass';
  hidden: boolean;
}

export interface VCardData {
  firstName: string;
  lastName: string;
  organization: string;
  title: string;
  phone: string;
  email: string;
  website: string;
}

export interface EmailData {
  to: string;
  subject: string;
  body: string;
}

export interface PhoneData {
  number: string;
  mode: 'call' | 'sms';
  smsMessage: string;
}

export interface WhatsAppData {
  number: string;
  message: string;
}

export interface ContentState {
  url: string;
  text: string;
  wifi: WifiData;
  vcard: VCardData;
  email: EmailData;
  phone: PhoneData;
  whatsapp: WhatsAppData;
}

export const DEFAULT_CONTENT: ContentState = {
  url: 'https://ejemplo.com',
  text: '',
  wifi: { ssid: '', password: '', security: 'WPA', hidden: false },
  vcard: { firstName: '', lastName: '', organization: '', title: '', phone: '', email: '', website: '' },
  email: { to: '', subject: '', body: '' },
  phone: { number: '', mode: 'call', smsMessage: '' },
  whatsapp: { number: '', message: '' },
};

/** Escapes special chars in WIFI: payload fields per the de-facto standard. */
function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

/** Escapes special chars in vCard 3.0 text values. */
function escapeVCard(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/([;,])/g, '\\$1').replace(/\n/g, '\\n');
}

function digitsOnly(value: string): string {
  return value.replace(/[^\d+]/g, '');
}

export function buildPayload(type: ContentType, c: ContentState): string {
  switch (type) {
    case 'url': {
      const u = c.url.trim();
      if (!u) return '';
      return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(u) ? u : `https://${u}`;
    }
    case 'text':
      return c.text;
    case 'wifi': {
      const w = c.wifi;
      if (!w.ssid) return '';
      const pass = w.security === 'nopass' ? '' : `P:${escapeWifi(w.password)};`;
      const hidden = w.hidden ? 'H:true;' : '';
      return `WIFI:T:${w.security};S:${escapeWifi(w.ssid)};${pass}${hidden};`;
    }
    case 'vcard': {
      const v = c.vcard;
      const fullName = [v.firstName, v.lastName].filter(Boolean).join(' ');
      if (!fullName) return '';
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${escapeVCard(v.lastName)};${escapeVCard(v.firstName)};;;`,
        `FN:${escapeVCard(fullName)}`,
        v.organization && `ORG:${escapeVCard(v.organization)}`,
        v.title && `TITLE:${escapeVCard(v.title)}`,
        v.phone && `TEL;TYPE=CELL:${v.phone}`,
        v.email && `EMAIL:${v.email}`,
        v.website && `URL:${v.website}`,
        'END:VCARD',
      ].filter(Boolean);
      return lines.join('\n');
    }
    case 'email': {
      const e = c.email;
      if (!e.to) return '';
      const params = new URLSearchParams();
      if (e.subject) params.set('subject', e.subject);
      if (e.body) params.set('body', e.body);
      const q = params.toString();
      return `mailto:${e.to}${q ? `?${q}` : ''}`;
    }
    case 'phone': {
      const p = c.phone;
      const num = digitsOnly(p.number);
      if (!num) return '';
      if (p.mode === 'sms') return `SMSTO:${num}:${p.smsMessage}`;
      return `tel:${num}`;
    }
    case 'whatsapp': {
      const w = c.whatsapp;
      const num = digitsOnly(w.number).replace(/^\+/, '');
      if (!num) return '';
      const msg = w.message ? `?text=${encodeURIComponent(w.message)}` : '';
      return `https://wa.me/${num}${msg}`;
    }
  }
}
