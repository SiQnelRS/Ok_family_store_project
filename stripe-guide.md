# Pagos con Stripe

El cliente crea su pedido y elige **Pagar con Stripe (prueba)** en **Mi cuenta → Mis pedidos**. Checkout abre una página alojada por Stripe para introducir la tarjeta. El servidor toma el total del pedido, incluido el envío, en centavos de MXN.

## Preparar el entorno local

El modo local predeterminado es `test`.

1. En tu sandbox de Stripe, habilita los pagos con tarjeta y crea una [clave restringida de prueba](https://docs.stripe.com/keys/restricted-api-keys) (`rk_test_…`) con escritura en Checkout Sessions y Refunds y lectura en Payment Intents. Guarda la clave en `STRIPE_SECRET_KEY` del archivo privado `.env` de la raíz.
2. Con la [CLI de Stripe](https://docs.stripe.com/stripe-cli) instalada, ejecuta `stripe.cmd login` y abre el listener en otra terminal:

   ```powershell
   stripe.cmd listen --events checkout.session.completed,checkout.session.expired,payment_intent.payment_failed --forward-to http://127.0.0.1:4003/api/payments/stripe/webhook
   ```

3. Copia el secreto `whsec_…` que imprime ese listener en `STRIPE_WEBHOOK_SECRET` del mismo archivo. Usa `WEB_ORIGIN=http://localhost:3000` para el retorno a la tienda. Mantén abierta la terminal del listener.
4. Desde la raíz ejecuta `npm.cmd run db:deploy`, luego inicia o reinicia la aplicación con `npm.cmd run dev`. El botón se habilita con ambas claves configuradas y una reserva pendiente y vigente.
5. Inicia sesión como cliente, crea un pedido con recogida en tienda y paga en **Mis pedidos**. Usa la tarjeta de prueba `4242 4242 4242 4242`, una fecha futura y un CVC de tres dígitos. Al volver, Mis pedidos actualiza el estado cada 15 segundos. En **Administración → Pedidos** el pedido pagado ya se puede preparar.

Para ensayar un rechazo usa `4000 0000 0000 0002` en otro pedido. Para ensayar abandono, cierra Checkout y deja vencer la reserva de 15 minutos. Consulta [las tarjetas de prueba](https://docs.stripe.com/testing) y [la guía de confirmación de Checkout](https://docs.stripe.com/checkout/fulfillment).

Para comprobar que Radar bloquea un pago, crea otro pedido y usa la tarjeta de prueba `4100 0000 0000 0019`. Confirma en el Dashboard de la sandbox que Stripe bloqueó el cargo y que el panel de OK Family no permite preparar el pedido. Consulta [las pruebas de Radar](https://docs.stripe.com/radar/testing).

## Confirmación y recuperación

Commerce verifica la firma de Stripe sobre los bytes originales y consulta la sesión y el PaymentIntent. Para confirmar comprueba la referencia, el modo de Stripe del pedido, el importe y la moneda. Guarda el evento, acredita el pago, actualiza el pedido y confirma las existencias dentro de una transacción. Un reintento de apertura reutiliza la sesión del pedido.

Commerce revisa periódicamente los pagos pendientes y cierra las sesiones abiertas cuando vence o se cancela la reserva. Si reconoce un cobro válido después de perder la reserva, solicita un reembolso íntegro y consulta su resultado. El cliente puede ver **Reembolso en proceso** y **Reembolsado**. Un importe o una referencia inconsistentes quedan **En revisión**. El dueño puede localizar la referencia en **Administración → Pedidos** y contrastarla con el Dashboard de la misma sandbox antes de resolver el caso.

La prueba automática se ejecuta tras compilar con `npm.cmd run test:payments`. Usa PostgreSQL y respuestas simuladas de Stripe para reproducir errores y notificaciones repetidas.

## Despliegue con Stripe

### Preparar y validar preproducción

1. Usa PostgreSQL independiente para preproducción y para producción. En producción crea una base limpia o importa únicamente los datos que correspondan a la tienda real. Configura `DATABASE_URL`, una copia de seguridad con restauración comprobada y un volumen persistente para `CATALOG_UPLOAD_DIR`.
2. Desde la raíz, instala las dependencias con `npm ci`, genera Prisma con `npm run db:generate` y compila con `npm run build`. Aplica las migraciones con `npm run db:deploy` antes de iniciar la nueva versión. La migración `20261123030000_stripe_payment_mode` identifica los pagos existentes como datos de prueba.
3. Inicia cada aplicación en un proceso supervisado con `npm run start -w @ok-family/<aplicación>`. Los procesos son `auth-service`, `catalog-service`, `commerce-service`, `api-gateway` y `frontend`. Configura `NODE_ENV=production`, `WEB_ORIGIN` con la URL HTTPS de la tienda y las URL internas de la plantilla según el host. Comprueba `GET /api/ready` en el gateway interno.
4. En el proxy HTTPS publica la tienda y dirige **solo** `/api/payments/stripe/webhook` directamente a Commerce. Conserva el cuerpo original y la cabecera `Stripe-Signature`. Añade esta ubicación dentro del servidor HTTPS de Nginx si los procesos comparten host. Si están en una red privada, sustituye el upstream por la dirección interna de Commerce.

   ```nginx
   location = /api/payments/stripe/webhook {
       client_max_body_size 1m;
       proxy_pass http://127.0.0.1:4003;
       proxy_set_header Stripe-Signature $http_stripe_signature;
       proxy_cache off;
   }
   ```

5. En [Stripe Workbench](https://dashboard.stripe.com/webhooks), elige la sandbox **Ok Family Store sandbox** y registra la URL HTTPS del paso anterior. Selecciona eventos **Snapshot** de la propia cuenta y usa la versión de API del SDK instalado en Commerce. Suscríbete a `checkout.session.completed`, `checkout.session.expired` y `payment_intent.payment_failed`. Consulta [cómo registrar un destino](https://docs.stripe.com/webhooks).
6. En Commerce configura `STRIPE_MODE=test`, la clave restringida de esa sandbox en `STRIPE_SECRET_KEY` y el secreto **del destino HTTPS** en `STRIPE_WEBHOOK_SECRET`. Con el listener local apagado para esta prueba, realiza un pedido y comprueba en Workbench que el evento del pago recibió un **200**. Contrasta el importe en MXN, el estado del pedido y las existencias en el panel. Repite con un rechazo y un evento reenviado.

### Activar cobros reales

- Completa la activación de la cuenta de OK Family Store y revisa que el catálogo publicado y las existencias sean reales. Si habilitas entrega local, carga las tarifas y los códigos postales acordados.
- Registra el destino HTTPS en el **modo real** de Workbench con los mismos eventos. Crea una [clave restringida real](https://docs.stripe.com/keys/restricted-api-keys) para la cuenta de OK Family Store con escritura en Checkout Sessions y Refunds y lectura en Payment Intents.
- Guarda ambos secretos en el gestor de secretos de Commerce. Configura `STRIPE_MODE=live`, `STRIPE_CHECKOUT_ENABLED=false`, `WEB_ORIGIN=https://tu-dominio` y reinicia Commerce. Verifica el arranque y el destino HTTPS. En modo real, Checkout requiere activación explícita. Al aprobar la apertura de la tienda, cambia `STRIPE_CHECKOUT_ENABLED=true` y reinicia Commerce. Consulta la [lista de Stripe para salir a producción](https://docs.stripe.com/get-started/checklist/go-live).

### Operar y recuperar pagos

- Configura una alerta en el hosting para respuestas `5xx` o `429` del webhook, errores repetidos de conciliación y pagos que pasan a revisión. Usa el identificador del pago en los registros de Commerce y la referencia visible en **Administración → Pedidos** para localizar el caso.
- Si necesitas pausar nuevos Checkouts, cambia `STRIPE_CHECKOUT_ENABLED=false` y reinicia Commerce conservando el modo, las claves y el webhook. Las sesiones ya abiertas pueden completarse. Commerce seguirá confirmándolas o reembolsándolas según el estado de la reserva.
- Ante una entrega fallida, consulta el evento en Workbench, corrige la causa y reenvíalo desde allí. Si aparece un pago **En revisión** o un reembolso se queda pendiente, compara la referencia, el importe y el estado con Stripe antes de entregar mercancía o emitir un reembolso manual. Si activas reglas de revisión manual en Radar, revisa y resuelve cada alerta en Stripe antes de preparar el pedido.
