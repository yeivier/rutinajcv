# Publicar FORJA en la App Store

FORJA es una PWA (React) con Supabase detrás. Para la App Store se empaqueta con **Capacitor** (la misma app web dentro de un contenedor nativo).

## Ya está listo en el repo
- `ios-wrapper/` — configuración de Capacitor (`appId com.forjabodybuilding.app`) y scripts (`npm run web`, `add:ios`, `sync`, `open`).
- `scripts/build-ios-web.sh` — arma `ios-wrapper/www` con la app compilada.
- **Eliminar cuenta desde la app** (requisito 5.1.1(v)): Más › Configuración › *Eliminar mi cuenta y mis datos* (perfiles con acceso).
- **Política de privacidad** actualizada con IA, bases de alimentos y proveedores: `https://forjabodybuilding.com/privacy`.
- Cámara/escáner, notificaciones web push, háptica y Face ID ya funcionan en la web; en nativo se pueden cambiar por plugins de Capacitor.

## Lo que solo puede hacer el dueño de la cuenta (no hay forma de automatizarlo sin sus credenciales)
1. **Apple Developer Program** (US$ 99/año) a nombre de Javier — requiere identidad y pago.
2. En **App Store Connect**: crear la app (bundle `com.forjabodybuilding.app`), subir capturas, descripción, categoría *Salud y bienestar*, cuestionario de privacidad (usar la política de arriba) y una cuenta de prueba para el revisor.
3. **Compilar y firmar** en un Mac con Xcode (`cd ios-wrapper && npm i && npm run add:ios && npm run sync && npm run open`) o en un servicio de CI con macOS (Codemagic, GitHub Actions macOS) cargando el certificado y el perfil de aprovisionamiento.
4. Enviar a **TestFlight** y luego a revisión.

## Servicios de la política que vimos (otra app) — qué conviene y qué no
| Servicio | ¿Lo necesitamos? |
|---|---|
| Supabase / Netlify | Ya los usamos (equivalen a Neon + Fly.io). |
| Anthropic / OpenRouter | Anthropic directo ya está soportado: falta la clave `ANTHROPIC_API_KEY` en Supabase. OpenRouter solo si se quiere una sola clave para varios modelos. |
| Sentry (errores) | Recomendado antes de publicar; necesita crear proyecto y pasar el DSN. |
| PostHog / AppsFlyer (analítica / atribución) | Opcional; AppsFlyer implica el permiso de seguimiento de Apple, mejor no usarlo por ahora. |
| RevenueCat / Superwall | Solo si los alumnos pagan suscripción **dentro de la app** con compra integrada. El cobro de coaching 1 a 1 puede tener reglas distintas: confirmar con Apple antes de integrarlo. |
| Expo push | No: usamos Web Push (ya existe `forja-push-sender`) y, en nativo, `@capacitor/push-notifications` + APNs. |
| fal (imágenes) | No hace falta; el análisis de fotos usa Gemini/Claude. |

## Riesgos de revisión que conviene conocer
- **Guideline 4.2** (mínima funcionalidad / sitio web empaquetado): se mitiga con funciones nativas reales (notificaciones push, Face ID, cámara/escáner, háptica).
- **Guideline 1.4.1 / salud**: los análisis de físico y la IA se presentan como orientativos; mantener el aviso visible.
- **Sustancias**: la IA no receta ni dosifica; mantener esa política.
