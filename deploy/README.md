# Despliegue con Docker Compose

La tienda usa una imagen para los cinco procesos y otra para ejecutar las migraciones de Prisma. Nginx es la única entrada desde el host. Envía las páginas y las API de la tienda a Next.js, y la ruta exacta `/api/payments/stripe/webhook` a Commerce con el cuerpo y la firma originales.

## Ensayo local en Windows

Desde la raíz del repositorio, copia la plantilla y abre `.env.deploy`. Pon una contraseña propia en `POSTGRES_PASSWORD` y usa la misma en `DATABASE_URL`. Si contiene caracteres reservados en URLs, codifica la contraseña en `DATABASE_URL`.

```powershell
Copy-Item deploy/deploy.env.example .env.deploy
```

Construye las imágenes y crea un certificado local si todavía no tienes uno. El último comando genera archivos nuevos en la carpeta indicada. Usa un certificado de confianza en un dominio público.

```powershell
docker compose --env-file .env.deploy -f compose.deploy.yml build frontend migrate
New-Item -ItemType Directory -Force .data/deploy-tls
$tlsDir = (Resolve-Path .data/deploy-tls).Path
docker run --rm --user root --mount "type=bind,source=$tlsDir,target=/tls" --entrypoint openssl ok-family-app:local req -x509 -newkey rsa:2048 -nodes -days 30 -subj /CN=localhost -addext "subjectAltName=DNS:localhost" -keyout /tls/privkey.pem -out /tls/fullchain.pem
```

Arranca el conjunto con PostgreSQL de ensayo. Compose espera a que la base esté lista, aplica las migraciones y después inicia los servicios. La base del ensayo arranca vacía y queda separada de la que usa `npm run dev`.

```powershell
$compose = @('--env-file', '.env.deploy', '-f', 'compose.deploy.yml', '-f', 'compose.deploy.local.yml')
docker compose @compose up -d --no-build --wait
docker compose @compose ps -a
curl.exe -k -I https://localhost:8443/
```

Abre `https://localhost:8443`. El navegador mostrará un aviso si no confía en tu certificado local. Si falla el arranque, consulta `docker compose @compose logs migrate catalog gateway nginx`. Para detener el conjunto, usa `docker compose @compose down`. Los volúmenes de la base y las fotos se conservan.


## Usar la base de desarrollo en el ensayo remoto

Con este modo, los cambios que hagas en la tienda remota también se guardan en tu base original. Haz un respaldo antes de activarlo y usa solo datos que puedas mostrar desde la URL pública.

1. Mantén PostgreSQL de desarrollo en ejecución con `npm.cmd run infra:up`.
2. En `.env.deploy`, usa las credenciales y el nombre de base de tu `.env` de desarrollo. En la URL cambia el host y puerto a `ok-family-postgres-1:5432`. Si tienes `MIGRATION_DATABASE_URL` configurada, debe apuntar a esa misma base. Para localizar las fotos, define `ORIGINAL_UPLOAD_DIR` si están fuera de `.data/uploads`.
3. Desde la raíz, arranca Compose con la configuración de base compartida.

   ```powershell
   docker compose --env-file .env.deploy -f compose.deploy.yml -f compose.deploy.shared.yml up -d --no-build --wait
   ```

La configuración compartida mantiene Stripe desactivado. Para volver a la base de ensayo separada, usa tu copia privada de la configuración anterior con `compose.deploy.local.yml` en lugar de `compose.deploy.shared.yml`.

## VM con PostgreSQL externo

Usa solo `compose.deploy.yml` en la VM. Ajusta `DATABASE_URL` para apuntar al PostgreSQL accesible desde los contenedores. Si usas Cloud SQL Auth Proxy instalado en la VM, su puerto debe escuchar en una dirección accesible desde la red de Docker, con acceso restringido a esa red. En ese caso los contenedores pueden usar `host.docker.internal`. Si el usuario que aplica las migraciones es distinto del usuario de la aplicación, configura también `MIGRATION_DATABASE_URL`.

Para publicar Nginx directamente por HTTPS, configura `WEB_ORIGIN=https://tu-dominio`, `DEPLOY_BIND_IP=0.0.0.0` y `DEPLOY_HTTPS_PORT=443`. Pon el certificado y la clave, llamados `fullchain.pem` y `privkey.pem`, en `DEPLOY_TLS_DIR`. Configura la emisión y renovación del certificado en el host y recarga Nginx al renovar. Conserva un respaldo del volumen `catalog_uploads`, además del respaldo de PostgreSQL.

Asigna a `DEPLOY_TAG` la versión que vas a publicar. Compila ambas imágenes y arranca el conjunto.

```bash
docker compose --env-file .env.deploy -f compose.deploy.yml build frontend migrate
docker compose --env-file .env.deploy -f compose.deploy.yml up -d --no-build --wait
```

Commerce recibe los secretos de Stripe al arrancar. Configura el webhook en Workbench con la URL pública y sigue la [guía de Stripe](../stripe-guide.md#despliegue-con-stripe) para validar primero contra la sandbox. Mantén los secretos en un archivo privado de despliegue o inyéctalos desde el gestor de secretos de Google Cloud.
