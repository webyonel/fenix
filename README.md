# Fénix — Estudio Fotográfico

Migración gradual del sitio estático original a Astro con Supabase como backend.

## Organización

- `src/pages/`: rutas Astro.
- `src/components/`: componentes visuales reutilizables, organizados por sección de la página.
- `src/styles/site.css`: estilos del diseño original y ajustes para la estructura Astro.
- `src/lib/supabase/`: cliente y tipos de base de datos.
- `src/lib/repositories/`: acceso tipado al contenido y al almacenamiento de imágenes.
- `src/scripts/`: interacción del sitio público y del panel.
- `public/img/`: fotografías y recursos estáticos del sitio original.
- `supabase/migrations/`: esquema, políticas RLS y contenido inicial.

La portada carga su contenido desde Supabase. El panel `/admin/` usa Supabase Auth, Postgres y Storage; el correo administrador está limitado mediante una lista privada y RLS. El bucket `site-media` permite lectura pública de imágenes y limita escrituras al administrador.

## Variables de entorno

Copia `.env.example` a `.env` para desarrollo local y configura `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_PUBLISHABLE_KEY` también en el entorno de compilación/despliegue. No uses ni publiques una clave `service_role` en el navegador.

GitHub Pages se publica desde la rama `main` en `https://webyonel.github.io/tuyo-mio/`. El workflow usa el prefijo `/tuyo-mio` y la publishable key (nunca la `service_role`).

## Etapas de migración

- [x] Diseño de la portada y el panel de administración (interfaz visual sin conexión a backend).
- [x] Lectura pública desde Supabase: contenido del hero y presentación, categorías/planes, productos, galería y disponibilidad.
- [x] Servicios Extras por seis categorías fijas; portadas editables y productos administrables por categoría.
- [x] Tasa USD/CUP editable en Administración y usada en los precios públicos de planes/productos (valor inicial: 800).
- [x] Consulta de planes por categoría, calendario con domingos/días ocupados bloqueados y confirmación por WhatsApp.
- [x] Panel con autenticación, operaciones de contenido e imágenes conectado a Postgres/Storage y protegido con RLS.
- [ ] Crear el usuario administrador en Supabase Auth y probar los cambios autenticados de extremo a extremo.
- [ ] Completar/verificar navegación móvil y revisar accesibilidad y comportamiento responsive.
- [ ] Configurar las variables en el proveedor de despliegue y probar el sitio publicado.

La lista sirve como inventario de trabajo; no se debe retirar una capacidad del sitio original sin acordarlo primero.

Las portadas iniciales de Servicios Extras son provisionales y se pueden cambiar desde el panel. El antiguo producto “Pullovers personalizados” se conserva sin categoría para que no desaparezca ni se publique bajo un rubro incorrecto; se puede reasignar desde Administración.

## Comandos

| Comando | Acción |
| --- | --- |
| `pnpm install` | Instala las dependencias |
| `pnpm dev` | Inicia el servidor de desarrollo en `localhost:4321` |
| `pnpm build` | Genera el sitio en `dist/` |
| `pnpm preview` | Previsualiza el sitio generado |

La página principal está en `src/pages/index.astro`.
