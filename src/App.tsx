import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Download, Trash2, Image as ImageIcon, AlertTriangle, History, X,
  Bookmark, BookmarkCheck, Copy, Check, MonitorDown, ShieldCheck, RotateCcw,
} from 'lucide-react';
import { cn } from './lib/utils';
import {
  renderQRCanvas, renderQRSvg, checkScannability, isValidHex,
  type QRDesign, type ModuleStyle, type GradientDirection, type LogoPosition, type ECLevel,
} from './lib/qr';
import { buildPayload, DEFAULT_CONTENT, type ContentType, type ContentState } from './lib/payloads';
import ContentForm from './components/ContentForm';

interface HistoryItem {
  id: string;
  date: string;
  payload: string;
  thumbnail: string;
  contentType: ContentType;
  content: ContentState;
  design: Omit<QRDesign, 'content'>;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const HISTORY_KEY = 'qr-history-v2';
const MAX_HISTORY = 30;
const EXPORT_SIZES = [512, 1024, 2048, 4096] as const;

const btnCls =
  'px-5 py-3 md:py-2 text-sm md:text-base font-bold border-2 border-neutral-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase flex items-center justify-center gap-2 transition-transform active:translate-y-1 active:shadow-none hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:shadow-none disabled:translate-y-1 disabled:cursor-not-allowed';

function loadHistory(): HistoryItem[] {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export default function App() {
  // Content
  const [contentType, setContentType] = useState<ContentType>('url');
  const [content, setContent] = useState<ContentState>(DEFAULT_CONTENT);

  // Design
  const [moduleStyle, setModuleStyle] = useState<ModuleStyle>('square');
  const [colorStart, setColorStart] = useState('#000000');
  const [colorEnd, setColorEnd] = useState('#3b82f6');
  const [useGradient, setUseGradient] = useState(false);
  const [gradientDirection, setGradientDirection] = useState<GradientDirection>('diagonal');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [bgTransparent, setBgTransparent] = useState(false);
  const [ecLevel, setEcLevel] = useState<ECLevel>('H');
  const [margin, setMargin] = useState(2);

  // Logo
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [logoPosition, setLogoPosition] = useState<LogoPosition>('center');
  const [logoSizePct, setLogoSizePct] = useState(20);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview / export
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'png' | 'svg' | 'jpeg'>('png');
  const [exportSize, setExportSize] = useState<number>(1024);
  const [copied, setCopied] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [hasSavedCurrent, setHasSavedCurrent] = useState(false);

  // PWA install
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const payload = useMemo(() => buildPayload(contentType, content), [contentType, content]);

  const design = useMemo<QRDesign>(() => ({
    content: payload,
    ecLevel,
    margin,
    moduleStyle,
    colorStart: isValidHex(colorStart) ? colorStart : '#000000',
    colorEnd: isValidHex(colorEnd) ? colorEnd : '#3b82f6',
    useGradient,
    gradientDirection,
    bgColor: isValidHex(bgColor) ? bgColor : '#ffffff',
    bgTransparent,
    logoSrc,
    logoPosition,
    logoSizePct,
  }), [payload, ecLevel, margin, moduleStyle, colorStart, colorEnd, useGradient, gradientDirection, bgColor, bgTransparent, logoSrc, logoPosition, logoSizePct]);

  const scan = useMemo(() => checkScannability(design), [design]);

  useEffect(() => {
    setHasSavedCurrent(false);
  }, [design]);

  useEffect(() => {
    if (!payload) {
      setQrDataUrl(null);
      setRenderError(null);
      setIsGenerating(false);
      return;
    }
    let cancelled = false;
    setIsGenerating(true);
    const timer = setTimeout(async () => {
      try {
        const canvas = await renderQRCanvas(design, 800);
        if (!cancelled) {
          setQrDataUrl(canvas.toDataURL('image/png'));
          setRenderError(null);
        }
      } catch (err) {
        console.error('Error generating QR code', err);
        if (!cancelled) setRenderError('El contenido es demasiado largo para un código QR. Acórtalo o baja el nivel de corrección.');
      } finally {
        if (!cancelled) setIsGenerating(false);
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [design, payload]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setLogoSrc(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload = useCallback(async () => {
    if (!payload || renderError) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const base = `qr-${contentType}-${stamp}`;
    try {
      if (exportFormat === 'svg') {
        const svg = renderQRSvg(design, exportSize);
        downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${base}.svg`);
        return;
      }
      // JPEG has no alpha channel: flatten onto the background color
      const d = exportFormat === 'jpeg' && design.bgTransparent
        ? { ...design, bgTransparent: false }
        : design;
      const canvas = await renderQRCanvas(d, exportSize);
      const mime = exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
      canvas.toBlob(
        (blob) => blob && downloadBlob(blob, `${base}.${exportFormat}`),
        mime,
        exportFormat === 'jpeg' ? 0.92 : undefined,
      );
    } catch (err) {
      console.error('Error exporting QR code', err);
    }
  }, [payload, renderError, design, exportFormat, exportSize, contentType]);

  const handleCopy = useCallback(async () => {
    if (!payload || renderError) return;
    try {
      const canvas = await renderQRCanvas(design, 1024);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying QR code', err);
    }
  }, [payload, renderError, design]);

  const persistHistory = (items: HistoryItem[]) => {
    setHistory(items);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('No se pudo guardar el historial (almacenamiento lleno)', err);
    }
  };

  const handleSaveToHistory = async () => {
    if (!payload || hasSavedCurrent || renderError) return;
    try {
      const thumbCanvas = await renderQRCanvas(design, 240);
      const { content: _content, ...designRest } = design;
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString(),
        payload,
        thumbnail: thumbCanvas.toDataURL('image/png'),
        contentType,
        content,
        design: designRest,
      };
      persistHistory([newItem, ...history].slice(0, MAX_HISTORY));
      setHasSavedCurrent(true);
    } catch (err) {
      console.error('Error saving to history', err);
    }
  };

  const restoreHistoryItem = (item: HistoryItem) => {
    setContentType(item.contentType);
    setContent(item.content);
    setModuleStyle(item.design.moduleStyle);
    setColorStart(item.design.colorStart);
    setColorEnd(item.design.colorEnd);
    setUseGradient(item.design.useGradient);
    setGradientDirection(item.design.gradientDirection);
    setBgColor(item.design.bgColor);
    setBgTransparent(item.design.bgTransparent);
    setEcLevel(item.design.ecLevel);
    setMargin(item.design.margin);
    setLogoSrc(item.design.logoSrc);
    setLogoPosition(item.design.logoPosition);
    setLogoSizePct(item.design.logoSizePct);
    setShowHistory(false);
  };

  const removeHistoryItem = (id: string) => {
    persistHistory(history.filter((item) => item.id !== id));
  };

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  };

  return (
    <div className="min-h-screen bg-neutral-50 md:p-8 p-4 font-sans text-neutral-900 flex flex-col">
      <div className="mx-auto w-full max-w-[1240px] flex flex-col gap-6 flex-1 bg-neutral-50 border-[6px] md:border-8 border-neutral-200 p-6 md:p-8 rounded-sm relative">
        <div className="absolute top-0 right-0 w-16 h-16 border-l-8 border-b-8 border-neutral-200 hidden md:block"></div>
        <div className="absolute bottom-0 left-0 w-16 h-16 border-r-8 border-t-8 border-neutral-200 hidden md:block"></div>

        <header className="flex flex-col sm:flex-row justify-between sm:items-end border-b-2 border-neutral-900 pb-5 shrink-0 z-10 relative">
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase">PixelCode <span className="text-blue-600">QR</span></h1>
            <p className="text-neutral-500 font-bold mt-1 tracking-tight">Generador profesional de códigos QR estáticos</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 mt-6 sm:mt-0">
            {installPrompt && (
              <button onClick={handleInstall} className={cn(btnCls, 'bg-neutral-900 text-white w-full sm:w-auto')}>
                <MonitorDown className="h-5 w-5 md:h-4 md:w-4" /> Instalar App
              </button>
            )}
            <button onClick={() => setShowHistory(true)} className={cn(btnCls, 'bg-neutral-100 text-neutral-900 w-full sm:w-auto')}>
              <History className="h-5 w-5 md:h-4 md:w-4" /> Historial
            </button>
          </div>
        </header>

        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 z-10 relative">

          {/* Left column: content + design controls */}
          <div className="lg:col-span-5 flex flex-col gap-6">

            <ContentForm
              type={contentType}
              content={content}
              onTypeChange={setContentType}
              onContentChange={setContent}
            />

            {/* Style Card */}
            <section className="bg-white border-2 border-neutral-900 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-blue-600 rounded-full shrink-0"></div>
                <h2 className="text-xs font-black uppercase tracking-widest">Estilo de módulos</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['square', 'Cuadrado'],
                  ['rounded', 'Redondeado'],
                  ['dots', 'Puntos'],
                ] as [ModuleStyle, string][]).map(([style, label]) => (
                  <button
                    key={style}
                    onClick={() => setModuleStyle(style)}
                    className={cn(
                      'py-2 font-mono text-[10px] font-black uppercase tracking-widest border-2 transition-colors flex flex-col items-center gap-2',
                      moduleStyle === style ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-900 bg-white text-neutral-500 hover:bg-neutral-50',
                    )}
                  >
                    <span className="flex gap-1 mt-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className={cn(
                            'w-2.5 h-2.5 block',
                            moduleStyle === style ? 'bg-white' : 'bg-neutral-400',
                            style === 'dots' && 'rounded-full',
                            style === 'rounded' && 'rounded-[3px]',
                          )}
                        />
                      ))}
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {/* Color Card */}
            <section className="bg-white border-2 border-neutral-900 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-600 rounded-full shrink-0"></div>
                  <h2 className="text-xs font-black uppercase tracking-widest">Color del QR</h2>
                </div>
                <div className="flex border-2 border-neutral-900 bg-neutral-100">
                  <button
                    onClick={() => setUseGradient(false)}
                    className={cn('px-3 py-1 font-mono text-[10px] font-black uppercase transition-colors tracking-widest', !useGradient ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900')}
                  >Sólido</button>
                  <button
                    onClick={() => setUseGradient(true)}
                    className={cn('px-3 py-1 font-mono text-[10px] font-black uppercase transition-colors border-l-2 border-neutral-900 tracking-widest', useGradient ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900')}
                  >Degradado</button>
                </div>
              </div>

              {!useGradient ? (
                <div className="flex gap-4 items-center">
                  <input type="color" value={colorStart} onChange={(e) => setColorStart(e.target.value)}
                    className="w-12 h-12 p-0 border-2 border-neutral-900 bg-neutral-50 cursor-pointer block shrink-0" />
                  <input type="text" value={colorStart} onChange={(e) => setColorStart(e.target.value)}
                    placeholder="#000000"
                    className="flex-1 border-2 border-neutral-900 p-3 font-mono text-sm focus:outline-none bg-neutral-50 focus:bg-white uppercase w-full" />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-3 items-center">
                    <span className="text-[10px] font-black text-neutral-400 uppercase w-12 shrink-0 tracking-widest">Inicio</span>
                    <input type="color" value={colorStart} onChange={(e) => setColorStart(e.target.value)}
                      className="w-12 h-12 p-0 border-2 border-neutral-900 shrink-0 cursor-pointer" />
                    <input type="text" value={colorStart} onChange={(e) => setColorStart(e.target.value)}
                      className="flex-1 border-2 border-neutral-900 p-3 font-mono text-sm focus:outline-none bg-neutral-50 focus:bg-white uppercase w-full" />
                  </div>
                  <div className="flex gap-3 items-center">
                    <span className="text-[10px] font-black text-neutral-400 uppercase w-12 shrink-0 tracking-widest">Fin</span>
                    <input type="color" value={colorEnd} onChange={(e) => setColorEnd(e.target.value)}
                      className="w-12 h-12 p-0 border-2 border-neutral-900 shrink-0 cursor-pointer" />
                    <input type="text" value={colorEnd} onChange={(e) => setColorEnd(e.target.value)}
                      className="flex-1 border-2 border-neutral-900 p-3 font-mono text-sm focus:outline-none bg-neutral-50 focus:bg-white uppercase w-full" />
                  </div>
                  <div className="flex gap-2 w-full mt-1">
                    {([['vertical', 'Vertical'], ['horizontal', 'Horizontal'], ['diagonal', 'Diagonal']] as [GradientDirection, string][]).map(([dir, label]) => (
                      <button key={dir} onClick={() => setGradientDirection(dir)}
                        className={cn('flex-1 py-1.5 font-mono text-[9px] font-black uppercase transition-colors border-2', gradientDirection === dir ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-900 bg-white text-neutral-500 hover:bg-neutral-50')}
                      >{label}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Background */}
              <div className="mt-5 pt-5 border-t-2 border-neutral-100">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Fondo</label>
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-600 cursor-pointer">
                    <input type="checkbox" checked={bgTransparent} onChange={(e) => setBgTransparent(e.target.checked)}
                      className="w-4 h-4 accent-neutral-900" />
                    Transparente
                  </label>
                </div>
                {!bgTransparent && (
                  <div className="flex gap-4 items-center">
                    <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
                      className="w-12 h-12 p-0 border-2 border-neutral-900 bg-neutral-50 cursor-pointer block shrink-0" />
                    <input type="text" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
                      placeholder="#FFFFFF"
                      className="flex-1 border-2 border-neutral-900 p-3 font-mono text-sm focus:outline-none bg-neutral-50 focus:bg-white uppercase w-full" />
                  </div>
                )}
              </div>

              {!scan.ok && payload && (
                <div className="mt-4 flex items-start gap-2 bg-amber-50 border-2 border-amber-600 p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-amber-800">
                    {scan.inverted
                      ? 'El color del QR es más claro que el fondo. Muchos lectores no escanean códigos invertidos.'
                      : 'Poco contraste entre el QR y el fondo. Puede que algunos lectores no lo escaneen.'}
                  </p>
                </div>
              )}
            </section>

            {/* Logo Card */}
            <section className="bg-blue-50/50 border-2 border-neutral-900 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-neutral-900 rounded-full shrink-0"></div>
                <h2 className="text-xs font-black uppercase tracking-widest">Logo (Opcional)</h2>
              </div>

              {!logoSrc ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-900/50 h-28 flex flex-col items-center justify-center bg-white cursor-pointer hover:bg-neutral-50 hover:border-neutral-900 transition-colors group"
                >
                  <p className="text-xs font-black uppercase mb-1 group-hover:text-blue-600 transition-colors">Subir Imagen (PNG/JPEG/SVG)</p>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Haz clic para buscar</p>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-4 border-2 border-neutral-900 bg-white p-3">
                    <div className="h-20 w-20 shrink-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZjNmNGY2Ij48L3JlY3Q+CjxyZWN0IHg9IjQiIHk9IjQiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmM2Y0ZjYiPjwvcmVjdD4KPC9zdmc+')] border-2 border-neutral-200 p-2 flex items-center justify-center">
                      <img src={logoSrc} alt="Logo" className="h-full w-full object-contain" />
                    </div>
                    <div className="flex flex-col justify-center text-center sm:text-left flex-1 w-full">
                      <p className="text-sm font-black uppercase tracking-tight text-neutral-900">Logo Cargado</p>
                      <button
                        onClick={removeLogo}
                        className="mt-2 text-[10px] uppercase font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 transition-colors self-center sm:self-start tracking-widest"
                      >
                        Remover Imagen
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 mb-2 uppercase tracking-widest">Posición</label>
                    <div className="grid grid-cols-3 gap-2 w-full max-w-[220px]">
                      {([
                        ['top-left', 'justify-start items-start'],
                        [null, ''],
                        ['top-right', 'justify-end items-start'],
                        [null, ''],
                        ['center', 'justify-center items-center'],
                        [null, ''],
                        ['bottom-left', 'justify-start items-end'],
                        [null, ''],
                        ['bottom-right', 'justify-end items-end'],
                      ] as [LogoPosition | null, string][]).map(([pos, align], i) =>
                        pos ? (
                          <button
                            key={pos}
                            onClick={() => setLogoPosition(pos)}
                            className={cn('aspect-square border-2 hover:border-neutral-900 flex p-1.5 transition-colors', align, logoPosition === pos ? 'border-blue-600 bg-blue-50' : 'border-neutral-200 bg-white')}
                          >
                            <span className={cn('w-3 h-3 block shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]', logoPosition === pos ? 'bg-blue-600' : 'bg-neutral-300')} />
                          </button>
                        ) : (
                          <div key={`empty-${i}`} className="aspect-square" />
                        ),
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Escala</label>
                      <span className="text-[10px] font-black text-neutral-900 bg-neutral-100 px-2 py-1 border-2 border-neutral-900">{logoSizePct}%</span>
                    </div>
                    <input
                      type="range" min="10" max="30" value={logoSizePct}
                      onChange={(e) => setLogoSizePct(parseInt(e.target.value))}
                      className="w-full accent-neutral-900 h-2 bg-neutral-200 rounded-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-neutral-900"
                    />
                    {logoPosition === 'center' && logoSizePct > 24 && (
                      <p className="mt-2 text-[10px] font-bold text-amber-700 uppercase tracking-wide">Un logo grande puede dificultar el escaneo</p>
                    )}
                    {logoPosition !== 'center' && logoSizePct > 15 && (
                      <p className="mt-2 text-[10px] font-bold text-amber-700 uppercase tracking-wide">En esquinas, un logo mayor al 15% puede tapar patrones del QR e impedir el escaneo. Verifica escaneando antes de imprimir.</p>
                    )}
                  </div>

                  {ecLevel !== 'H' && (
                    <div className="flex items-start gap-2 bg-amber-50 border-2 border-amber-600 p-3">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs font-bold text-amber-800">
                        Con logo se recomienda corrección de errores nivel H.{' '}
                        <button onClick={() => setEcLevel('H')} className="underline">Activar</button>
                      </p>
                    </div>
                  )}
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handleFileChange}
                accept="image/png, image/jpeg, image/svg+xml" className="hidden" />
            </section>

            {/* Advanced Card */}
            <section className="bg-white border-2 border-neutral-900 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-blue-600 rounded-full shrink-0"></div>
                <h2 className="text-xs font-black uppercase tracking-widest">Avanzado</h2>
              </div>
              <div className="mb-5">
                <label className="block text-[10px] font-black text-neutral-400 mb-2 uppercase tracking-widest">Corrección de errores</label>
                <div className="grid grid-cols-4 gap-2">
                  {([['L', '7%'], ['M', '15%'], ['Q', '25%'], ['H', '30%']] as [ECLevel, string][]).map(([level, pct]) => (
                    <button
                      key={level}
                      onClick={() => setEcLevel(level)}
                      className={cn('py-2 font-mono text-[10px] font-black uppercase border-2 transition-colors flex flex-col items-center', ecLevel === level ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-900 bg-white text-neutral-500 hover:bg-neutral-50')}
                    >
                      <span className="text-sm">{level}</span>
                      <span className="opacity-60">{pct}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Mayor nivel = más resistente a daños, pero más denso</p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Margen (zona blanca)</label>
                  <span className="text-[10px] font-black text-neutral-900 bg-neutral-100 px-2 py-1 border-2 border-neutral-900">{margin}</span>
                </div>
                <input
                  type="range" min="0" max="8" value={margin}
                  onChange={(e) => setMargin(parseInt(e.target.value))}
                  className="w-full accent-neutral-900 h-2 bg-neutral-200 rounded-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-neutral-900"
                />
              </div>
            </section>
          </div>

          {/* Right column: preview + export */}
          <section className="lg:col-span-7 bg-white border-2 border-neutral-900 flex flex-col items-center p-6 md:p-10 relative shadow-[6px_6px_0px_0px_rgba(37,99,235,0.2)]">
            <div className="absolute top-4 left-4">
              <span className="text-[10px] font-black uppercase tracking-widest bg-neutral-900 text-white px-2 py-1">Vista Previa en Vivo</span>
            </div>

            <div className="w-[280px] h-[280px] sm:w-[350px] sm:h-[350px] md:w-[400px] md:h-[400px] bg-neutral-900 p-5 mt-10 md:mt-6 flex items-center justify-center relative shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]">
              {qrDataUrl && !renderError ? (
                <div className="bg-white w-full h-full flex items-center justify-center p-1 relative z-10">
                  <img
                    src={qrDataUrl}
                    alt="Código QR Generado"
                    className={cn('w-full h-full object-contain transition-opacity duration-200', isGenerating ? 'opacity-50' : 'opacity-100')}
                  />
                  {isGenerating && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative z-10 flex flex-col gap-3 h-full w-full bg-white/5 items-center justify-center border-2 border-dashed border-white/20 p-6 text-center">
                  {renderError ? (
                    <>
                      <AlertTriangle className="h-10 w-10 text-amber-400" />
                      <p className="text-xs font-bold text-white/70 uppercase tracking-wide">{renderError}</p>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-10 w-10 text-white/20" />
                      <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Completa el contenido para generar</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Static guarantee */}
            <div className="mt-6 w-full max-w-md flex items-start gap-3 bg-green-50 border-2 border-green-700 p-3">
              <ShieldCheck className="h-5 w-5 text-green-700 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-green-900">
                <span className="uppercase tracking-widest">100% Estático.</span>{' '}
                El contenido queda grabado dentro del código para siempre: sin servidores, sin redirecciones, sin caducidad. Funciona incluso sin internet.
              </p>
            </div>

            {/* Export panel */}
            <div className="mt-6 w-full max-w-md border-2 border-neutral-900 bg-neutral-50 p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Formato</label>
                <div className="flex border-2 border-neutral-900 bg-white">
                  {(['png', 'svg', 'jpeg'] as const).map((fmt, i) => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={cn('px-3 py-1 font-mono text-[10px] font-black uppercase tracking-widest transition-colors', i > 0 && 'border-l-2 border-neutral-900', exportFormat === fmt ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900')}
                    >{fmt}</button>
                  ))}
                </div>
              </div>
              <div className={cn('flex items-center justify-between mb-4 transition-opacity', exportFormat === 'svg' && 'opacity-40 pointer-events-none')}>
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Tamaño</label>
                <div className="flex border-2 border-neutral-900 bg-white">
                  {EXPORT_SIZES.map((size, i) => (
                    <button
                      key={size}
                      onClick={() => setExportSize(size)}
                      className={cn('px-2.5 py-1 font-mono text-[10px] font-black tracking-tight transition-colors', i > 0 && 'border-l-2 border-neutral-900', exportSize === size ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900')}
                    >{size}</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleDownload}
                  disabled={!qrDataUrl || isGenerating || !!renderError}
                  className={cn(btnCls, 'bg-blue-600 text-white flex-1')}
                >
                  <Download className="h-4 w-4" /> Descargar {exportFormat.toUpperCase()}
                </button>
                <button
                  onClick={handleCopy}
                  disabled={!qrDataUrl || isGenerating || !!renderError}
                  className={cn(btnCls, 'bg-white text-neutral-900')}
                  title="Copiar PNG al portapapeles"
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="mt-4 mb-2 w-full max-w-md flex">
              <button
                onClick={handleSaveToHistory}
                disabled={!qrDataUrl || hasSavedCurrent || isGenerating || !!renderError}
                className={cn(
                  'w-full px-5 py-3 text-sm font-bold border-2 border-neutral-900 flex items-center justify-center gap-2 transition-all uppercase',
                  hasSavedCurrent
                    ? 'bg-green-100 text-green-800 border-green-900 opacity-80 cursor-not-allowed'
                    : 'bg-white text-neutral-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:shadow-none disabled:active:translate-y-0',
                )}
              >
                {hasSavedCurrent ? (
                  <><BookmarkCheck className="h-5 w-5" /> Guardado en Historial</>
                ) : (
                  <><Bookmark className="h-5 w-5" /> Guardar en Historial</>
                )}
              </button>
            </div>

            <div className="mt-4 flex gap-6 md:gap-10 flex-wrap justify-center w-full max-w-md">
              <div className="text-center flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 border-b border-neutral-200 pb-1 mb-2">Contenido</p>
                <p className="font-bold text-neutral-900 text-sm">{payload.length} caracteres</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 border-b border-neutral-200 pb-1 mb-2">Corrección</p>
                <p className="font-bold text-blue-600 text-sm">Nivel {ecLevel}</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 border-b border-neutral-200 pb-1 mb-2">Tipo</p>
                <p className="font-bold text-neutral-900 text-sm uppercase">{contentType}</p>
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-2 md:mt-4 border-t-2 border-neutral-900 pt-5 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest shrink-0 z-10 relative">
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>Funciona sin conexión</span>
          <span>Códigos QR estáticos · Sin rastreo</span>
          <span>© 2026 PixelCode QR</span>
        </footer>
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm">
          <div className="bg-white border-4 border-neutral-900 w-full max-w-3xl max-h-[85vh] flex flex-col shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex border-b-4 border-neutral-900 items-center justify-between p-4 bg-neutral-100 shrink-0">
              <div className="flex items-center gap-3">
                <History className="h-6 w-6 text-neutral-900" />
                <h2 className="text-xl font-black uppercase tracking-tighter">Mis Códigos QR</h2>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 bg-white border-2 border-neutral-900 hover:bg-neutral-900 hover:text-white transition-colors"
                title="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-neutral-50/50">
              {history.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-center opacity-60">
                  <Bookmark className="h-12 w-12 mb-3 text-neutral-400" />
                  <p className="font-bold text-neutral-500 uppercase tracking-widest text-sm">No hay códigos guardados</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {history.map((item) => (
                    <div key={item.id} className="bg-white border-2 border-neutral-900 p-4 flex flex-col group shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-shadow">
                      <div className="bg-neutral-100 border-2 border-neutral-200 aspect-square flex items-center justify-center mb-4 p-2 relative overflow-hidden group-hover:border-neutral-900 transition-colors">
                        <img src={item.thumbnail} alt="QR guardado" className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-neutral-400 uppercase mb-1">{item.date} · {item.contentType}</p>
                        <p className="text-sm font-bold text-neutral-900 truncate" title={item.payload}>{item.payload}</p>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => restoreHistoryItem(item)}
                          className="flex-1 flex items-center justify-center gap-2 p-2 border-2 border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white text-xs font-bold uppercase transition-colors"
                        >
                          <RotateCcw className="h-4 w-4" /> Cargar
                        </button>
                        <button
                          onClick={() => removeHistoryItem(item.id)}
                          className="flex items-center justify-center gap-2 p-2 border-2 border-transparent text-red-600 hover:border-red-600 hover:bg-red-50 text-xs font-bold uppercase transition-all"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t-2 border-neutral-900 bg-neutral-100 text-[10px] font-black uppercase text-neutral-400 text-center tracking-widest shrink-0">
              {history.length} {history.length === 1 ? 'código almacenado' : 'códigos almacenados'} en este dispositivo
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
