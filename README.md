# MoonPache QR generator

Generador profesional de códigos QR **100% estáticos**, instalable como PWA y funcional sin conexión.

## ¿Por qué estáticos?

El contenido se codifica directamente dentro de la matriz del QR. No hay servidores intermedios, acortadores ni redirecciones: lo que diseñas queda grabado en el código **para siempre**. Un QR impreso hoy seguirá funcionando dentro de 20 años, sin depender de ningún servicio.

## Características

- **Tipos de contenido**: URL, texto libre, WiFi, contacto (vCard 3.0), email, teléfono/SMS y WhatsApp.
- **Diseño**: módulos cuadrados, redondeados o de puntos; color sólido o degradado (vertical/horizontal/diagonal); fondo personalizable o transparente.
- **Logo**: incrustado con posición y escala configurables, con fondo de protección automático.
- **Control técnico**: nivel de corrección de errores (L/M/Q/H) y margen (zona de silencio) ajustables.
- **Exportación**: PNG, SVG (vectorial) y JPEG en 512–4096 px; copiar al portapapeles.
- **Avisos de escaneabilidad**: contraste insuficiente, colores invertidos, logo demasiado grande.
- **Historial local**: guarda diseños completos y restáuralos con un clic (localStorage, nada sale del dispositivo).
- **PWA**: instalable en Windows, Android, iOS y macOS; funciona completamente offline gracias al service worker.

## Desarrollo

```bash
npm install
npm run dev       # servidor de desarrollo en :3000
npm run build     # build de producción + service worker (dist/)
npm run preview   # sirve el build para probar la PWA
npm run lint      # typecheck
npm run icons     # regenera los iconos PWA desde public/icon.svg
npx tsx scripts/verify-qr.mts  # verifica que todos los estilos decodifican correctamente
```

## Despliegue

Es un sitio estático: sube `dist/` a cualquier hosting (Netlify, Vercel, GitHub Pages, Cloudflare Pages). La PWA requiere **HTTPS** para instalarse (localhost está exento).

## Stack

React 19 · Vite 6 · Tailwind CSS 4 · [qrcode](https://github.com/soldair/node-qrcode) · vite-plugin-pwa (Workbox)
