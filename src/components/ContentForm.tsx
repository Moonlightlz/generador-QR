import { Link as LinkIcon, Type, Wifi, Contact, Mail, Phone, MessageCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ContentType, ContentState } from '../lib/payloads';

const TABS: { type: ContentType; label: string; icon: typeof LinkIcon }[] = [
  { type: 'url', label: 'URL', icon: LinkIcon },
  { type: 'text', label: 'Texto', icon: Type },
  { type: 'wifi', label: 'WiFi', icon: Wifi },
  { type: 'vcard', label: 'Contacto', icon: Contact },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'phone', label: 'Tel/SMS', icon: Phone },
  { type: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

const inputCls =
  'w-full border-2 border-neutral-900 p-3 font-mono text-sm focus:outline-none bg-neutral-50 focus:bg-white placeholder:text-neutral-300';
const labelCls = 'block text-[10px] font-black text-neutral-400 mb-1 uppercase tracking-widest';

interface Props {
  type: ContentType;
  content: ContentState;
  onTypeChange: (t: ContentType) => void;
  onContentChange: (c: ContentState) => void;
}

export default function ContentForm({ type, content, onTypeChange, onContentChange }: Props) {
  const set = <K extends keyof ContentState>(key: K, value: ContentState[K]) =>
    onContentChange({ ...content, [key]: value });

  return (
    <section className="bg-white border-2 border-neutral-900 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 bg-blue-600 rounded-full shrink-0"></div>
        <h2 className="text-xs font-black uppercase tracking-widest">Contenido del QR</h2>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-7 border-2 border-neutral-900 mb-5 bg-neutral-100">
        {TABS.map(({ type: t, label, icon: Icon }, i) => (
          <button
            key={t}
            onClick={() => onTypeChange(t)}
            title={label}
            className={cn(
              'flex flex-col items-center gap-1 py-2 px-1 font-mono text-[9px] font-black uppercase tracking-tight transition-colors',
              i > 0 && 'border-l-2 border-neutral-900 max-sm:[&:nth-child(5)]:border-l-0',
              i >= 4 && 'max-sm:border-t-2 max-sm:border-neutral-900',
              type === t ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {type === 'url' && (
        <div>
          <label className={labelCls}>Dirección web</label>
          <input
            type="text"
            value={content.url}
            onChange={(e) => set('url', e.target.value)}
            placeholder="https://ejemplo.com"
            className={inputCls}
          />
        </div>
      )}

      {type === 'text' && (
        <div>
          <label className={labelCls}>Texto libre</label>
          <textarea
            value={content.text}
            onChange={(e) => set('text', e.target.value)}
            placeholder="Cualquier texto que quieras codificar…"
            rows={4}
            className={cn(inputCls, 'resize-y')}
          />
        </div>
      )}

      {type === 'wifi' && (
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Nombre de red (SSID)</label>
            <input
              type="text"
              value={content.wifi.ssid}
              onChange={(e) => set('wifi', { ...content.wifi, ssid: e.target.value })}
              placeholder="MiRedWiFi"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Contraseña</label>
              <input
                type="text"
                value={content.wifi.password}
                onChange={(e) => set('wifi', { ...content.wifi, password: e.target.value })}
                placeholder="••••••••"
                disabled={content.wifi.security === 'nopass'}
                className={cn(inputCls, 'disabled:opacity-40')}
              />
            </div>
            <div>
              <label className={labelCls}>Seguridad</label>
              <select
                value={content.wifi.security}
                onChange={(e) => set('wifi', { ...content.wifi, security: e.target.value as 'WPA' | 'WEP' | 'nopass' })}
                className={cn(inputCls, 'h-[46px]')}
              >
                <option value="WPA">WPA / WPA2 / WPA3</option>
                <option value="WEP">WEP</option>
                <option value="nopass">Sin contraseña</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-neutral-600 cursor-pointer">
            <input
              type="checkbox"
              checked={content.wifi.hidden}
              onChange={(e) => set('wifi', { ...content.wifi, hidden: e.target.checked })}
              className="w-4 h-4 accent-neutral-900"
            />
            Red oculta
          </label>
        </div>
      )}

      {type === 'vcard' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nombre</label>
              <input type="text" value={content.vcard.firstName}
                onChange={(e) => set('vcard', { ...content.vcard, firstName: e.target.value })}
                placeholder="Ana" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Apellidos</label>
              <input type="text" value={content.vcard.lastName}
                onChange={(e) => set('vcard', { ...content.vcard, lastName: e.target.value })}
                placeholder="García" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Organización</label>
              <input type="text" value={content.vcard.organization}
                onChange={(e) => set('vcard', { ...content.vcard, organization: e.target.value })}
                placeholder="Empresa S.A." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Cargo</label>
              <input type="text" value={content.vcard.title}
                onChange={(e) => set('vcard', { ...content.vcard, title: e.target.value })}
                placeholder="Directora" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Teléfono</label>
              <input type="tel" value={content.vcard.phone}
                onChange={(e) => set('vcard', { ...content.vcard, phone: e.target.value })}
                placeholder="+52 55 1234 5678" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={content.vcard.email}
                onChange={(e) => set('vcard', { ...content.vcard, email: e.target.value })}
                placeholder="ana@empresa.com" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Sitio web</label>
            <input type="url" value={content.vcard.website}
              onChange={(e) => set('vcard', { ...content.vcard, website: e.target.value })}
              placeholder="https://empresa.com" className={inputCls} />
          </div>
        </div>
      )}

      {type === 'email' && (
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Destinatario</label>
            <input type="email" value={content.email.to}
              onChange={(e) => set('email', { ...content.email, to: e.target.value })}
              placeholder="contacto@ejemplo.com" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Asunto</label>
            <input type="text" value={content.email.subject}
              onChange={(e) => set('email', { ...content.email, subject: e.target.value })}
              placeholder="Consulta" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Mensaje</label>
            <textarea value={content.email.body} rows={3}
              onChange={(e) => set('email', { ...content.email, body: e.target.value })}
              placeholder="Hola…" className={cn(inputCls, 'resize-y')} />
          </div>
        </div>
      )}

      {type === 'phone' && (
        <div className="flex flex-col gap-3">
          <div className="flex border-2 border-neutral-900 bg-neutral-100 self-start">
            <button
              onClick={() => set('phone', { ...content.phone, mode: 'call' })}
              className={cn('px-4 py-1.5 font-mono text-[10px] font-black uppercase tracking-widest transition-colors',
                content.phone.mode === 'call' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900')}
            >Llamada</button>
            <button
              onClick={() => set('phone', { ...content.phone, mode: 'sms' })}
              className={cn('px-4 py-1.5 font-mono text-[10px] font-black uppercase tracking-widest border-l-2 border-neutral-900 transition-colors',
                content.phone.mode === 'sms' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900')}
            >SMS</button>
          </div>
          <div>
            <label className={labelCls}>Número de teléfono</label>
            <input type="tel" value={content.phone.number}
              onChange={(e) => set('phone', { ...content.phone, number: e.target.value })}
              placeholder="+52 55 1234 5678" className={inputCls} />
          </div>
          {content.phone.mode === 'sms' && (
            <div>
              <label className={labelCls}>Mensaje SMS</label>
              <textarea value={content.phone.smsMessage} rows={2}
                onChange={(e) => set('phone', { ...content.phone, smsMessage: e.target.value })}
                placeholder="Texto del mensaje…" className={cn(inputCls, 'resize-y')} />
            </div>
          )}
        </div>
      )}

      {type === 'whatsapp' && (
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Número (con código de país)</label>
            <input type="tel" value={content.whatsapp.number}
              onChange={(e) => set('whatsapp', { ...content.whatsapp, number: e.target.value })}
              placeholder="+52 55 1234 5678" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Mensaje predefinido (opcional)</label>
            <textarea value={content.whatsapp.message} rows={2}
              onChange={(e) => set('whatsapp', { ...content.whatsapp, message: e.target.value })}
              placeholder="Hola, quiero más información…" className={cn(inputCls, 'resize-y')} />
          </div>
        </div>
      )}
    </section>
  );
}
