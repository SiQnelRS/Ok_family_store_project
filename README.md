# Ok Family Store

Base de desarrollo para la tienda de productos y lotes de disponibilidad limitada descrita en [el plan original](ok-family-plan-arquitectura.md).

Incluye un catálogo de lectura conectado a PostgreSQL, una interfaz Next.js, un gateway y tres servicios NestJS separados. Auth gestiona el acceso privado del administrador; Commerce gestiona el carrito, las direcciones y la consulta de cobertura local.

## Alcance

- Monorepo con npm workspaces, TypeScript y Node.js 24.
- Frontend Next.js, gateway HTTP y servicios Auth, Catalog y Commerce.
- Catálogo publicado con búsqueda, filtros, paginación y consulta por slug.
- Panel privado para crear, editar, publicar, ocultar y eliminar productos, con carga de fotografías e historial.
- PostgreSQL 17, Prisma 7, migraciones y tres publicaciones de demostración.
- Modelos iniciales para usuarios, direcciones, productos, reservas, pedidos, pagos y eventos.
- Validación de parámetros, cabeceras de seguridad, CORS y límite de solicitudes.
- Compilación, comprobación de tipos, análisis estático y pruebas automatizadas.

**Ya hay registro e inicio de sesión de clientes con correo y contraseña. Todavía no hay recuperación de contraseña, cobro ni webhooks. La creación de pedidos aparta las existencias en PostgreSQL.** Esta base no está lista para recibir compras reales.

## Requisitos

- Node.js 24 y npm.
- Docker con Docker Compose, o PostgreSQL 17 instalado por separado.
- Puertos locales 3000, 4000 a 4003 y 55432 disponibles.

Docker Compose inicia únicamente PostgreSQL. Las aplicaciones se ejecutan en el equipo con npm. El puerto 55432 del equipo corresponde al 5432 del contenedor.

## Arranque local

Desde la raíz del proyecto, en PowerShell:

```powershell
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run infra:up
npm.cmd run db:generate
npm.cmd run db:deploy
npm.cmd run db:seed
npm.cmd run build
npm.cmd run admin:create
npm.cmd run dev
```

El archivo `package-lock.json` fija las versiones. En PowerShell se usa `npm.cmd` para evitar el bloqueo de `npm.ps1`; en otras terminales puedes usar `npm`. Copia `.env.example` solamente en la primera configuración para conservar cualquier ajuste posterior de `.env`.

PostgreSQL debe estar disponible antes de aplicar la migración. Consulta su estado con `docker compose ps`; si todavía está iniciando, espera a que esté saludable y repite `npm.cmd run db:deploy`.

Abre [http://localhost:3000](http://localhost:3000). El comando de desarrollo genera el cliente Prisma, compila las dependencias y los servicios, e inicia los procesos con seguimiento de cambios. Detén la sesión con `Ctrl+C`.

Las tres publicaciones cargadas por `db:seed` son ejemplos, marcados con `isDemo`; no representan existencias reales. Ejecutar la carga nuevamente conserva los datos y la disponibilidad de publicaciones existentes. Las fotos de referencia de `images/` se sirven desde `apps/frontend/public/images/`. La carga agrega la foto correspondiente a los ejemplos que todavía no tienen imágenes, sin duplicarlas ni reemplazar las existentes. La carga se rechaza cuando `NODE_ENV=production`.

| Componente | Dirección local | Función actual |
| --- | --- | --- |
| Frontend | `http://localhost:3000` | Interfaz del catálogo |
| API Gateway | `http://127.0.0.1:4000` | Entrada HTTP y acceso al catálogo |
| Auth | `http://127.0.0.1:4001` | Acceso y sesiones de administración |
| Catalog | `http://127.0.0.1:4002` | Lectura de publicaciones desde PostgreSQL |
| Commerce | `http://127.0.0.1:4003` | Carrito, direcciones y cobertura local |
| PostgreSQL | `127.0.0.1:55432` | Persistencia de desarrollo |

## Cuenta de clientes

En /cuenta los clientes pueden registrarse, iniciar sesión y cerrarla. La contraseña requiere al menos 12 caracteres; la sesión dura 12 horas y se revoca al cerrar sesión. Desde su cuenta, cada cliente puede actualizar su nombre y cambiar su contraseña proporcionando la actual; al cambiarla se cierran todas sus sesiones. Las cuentas de clientes no pueden acceder a administración. La recuperación de contraseña y el inicio con Google se incorporarán después.

## Carrito, entrega local y recogida en tienda

En /carrito, los clientes pueden elegir entre entrega a domicilio y recoger en tienda. Para recoger, el sitio muestra la dirección del local —Boulevard de las Rosas 233, Jardines de Durango, Durango— y su horario publicado, de 12:00 p. m. a 8:30 p. m. Esta opción no añade costo de envío.

El carrito consulta los precios y existencias actuales del catálogo y calcula los importes en el servidor. Al pulsar **Crear pedido y reservar**, Commerce guarda los precios, el destino y las cantidades, aparta las unidades durante 15 minutos y vacía el carrito en una transacción. En /cuenta/pedidos puedes ver y cancelar el pedido. Commerce libera las reservas vencidas al iniciar y cada 15 segundos. El cobro sigue pendiente.

La cobertura y las tarifas de entrega local están pendientes de definir. Cuando el negocio facilite sus zonas y tarifas, configura LOCAL_DELIVERY_RATES_JSON en el entorno de Commerce con un objeto que relacione códigos postales de cinco dígitos con importes en centavos, por ejemplo: LOCAL_DELIVERY_RATES_JSON={"34000":8000}. Ese valor es únicamente un ejemplo técnico, no una tarifa vigente. Reinicia Commerce tras cambiar la configuración. Una configuración vacía muestra cobertura pendiente; un código ausente en una configuración no vacía se considera fuera de cobertura.
## Panel del dueño

Abre [http://localhost:3000/admin](http://localhost:3000/admin). El acceso temporal está en el archivo privado `.env.admin.local`, generado por `npm.cmd run admin:create`. Si el usuario ya existe, el comando conserva su contraseña y permisos.

El panel permite subir fotografías, administrar existencias, crear productos individuales o lotes, y mostrar, ocultar o eliminar publicaciones con confirmación. Consulta [la guía de administración](apps/frontend/admin-guide.md). Las fotos nuevas se guardan en `.data/uploads/`; conserva esta carpeta junto con la base de datos al hacer copias de seguridad.

## API disponible

Las rutas usan el prefijo `/api`. El gateway es el punto de entrada del frontend.

| Método y ruta del gateway | Resultado |
| --- | --- |
| `GET /api/health` | El proceso del gateway está respondiendo |
| `GET /api/ready` | Estado de sus dependencias |
| `GET /api/products` | Publicaciones visibles con paginación |
| `GET /api/products/:slug` | Una publicación visible; `404` si no existe |
| `POST /api/auth/admin/login` | Acceso administrativo |
| `GET /api/admin/products` | Lista privada con borradores |
| `POST /api/admin/products` | Crear un producto |
| `PATCH /api/admin/products/:id` | Editar con control de versión |
| `DELETE /api/admin/products/:id` | Eliminar con control de versión |
| `POST /api/admin/images` | Cargar una fotografía validada |

```powershell
Invoke-RestMethod 'http://127.0.0.1:4000/api/products?type=LOTE&page=1&pageSize=12'
```

Filtros admitidos: `q`, `category` y `type` (`PRODUCTO` o `LOTE`). `page` comienza en 1; `pageSize` permite de 1 a 48 y vale 12 por defecto. Los parámetros desconocidos o inválidos se rechazan.

Todos los servicios exponen `/api/health`. Catalog también expone `/api/ready` para comprobar PostgreSQL. La salud de Auth o Commerce solo confirma que el proceso está activo; no implica que sus futuras funciones estén disponibles.

## Comandos de trabajo

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:database
npm.cmd run test:admin
```

Compila antes de ejecutar las pruebas: utilizan módulos compilados. `test:database` requiere PostgreSQL disponible y las migraciones aplicadas; ejecútalo sobre la base local de desarrollo o una base dedicada a pruebas. Verifica el recorrido de catálogo y gateway con PostgreSQL. Las pruebas actuales no verifican reservas, pagos ni doble venta.

| Comando | Uso |
| --- | --- |
| `npm.cmd run db:generate` | Regenerar el cliente tras cambiar el esquema Prisma |
| `npm.cmd run db:validate` | Validar el esquema Prisma |
| `npm.cmd run db:migrate -- --name descripcion` | Crear y aplicar una migración durante desarrollo |
| `npm.cmd run db:deploy` | Aplicar migraciones ya versionadas |
| `npm.cmd run db:seed` | Cargar los tres ejemplos |
| `npm.cmd run db:studio` | Inspeccionar datos de desarrollo |
| `npm.cmd run infra:down` | Detener PostgreSQL conservando su volumen |

## Estructura

```text
apps/
  frontend/           Interfaz Next.js
  api-gateway/        Entrada HTTP
  auth-service/       Base para identidad y permisos
  catalog-service/    Catálogo y futura autoridad de reservas
  commerce-service/   Base para direcciones, pedidos y pagos
packages/
  shared/             Contratos y funciones compartidas
  database/           Esquema, migraciones, cliente y ejemplos
  service-kit/        Configuración HTTP, validación y salud
scripts/              Tareas del monorepo
tests/                Pruebas de la base
docs/                 Decisiones y próximos pasos
```

## Configuración y límites

`.env.example` contiene la configuración local. Las credenciales de Docker Compose son exclusivamente de desarrollo. `.env` y los secretos no se versionan.

Los servicios escuchan en `127.0.0.1` por defecto. `WEB_ORIGIN` configura el origen permitido por CORS; no sustituye la autenticación. El límite de solicitudes se mantiene en memoria por proceso. Antes de desplegar habrá que implementar autorización, gestión de secretos, HTTPS y los controles del entorno.

Las variables de JWT, Stripe, Google y almacenamiento de objetos son espacios reservados para etapas futuras. No necesitas proporcionar esas credenciales para explorar el catálogo.

Aunque los servicios se ejecutan por separado, comparten provisionalmente un cliente Prisma y un esquema físico. Los límites de propiedad están documentados, pero aún no existe aislamiento de persistencia entre servicios.

Consulta [las decisiones de arquitectura](docs/architecture.md) y [los siguientes hitos](docs/roadmap.md).
