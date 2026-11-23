# Administrar la tienda

Abre [el panel](http://localhost:3000/admin). El correo y la contraseña de desarrollo están en el archivo privado `.env.admin.local` de la raíz. No compartas ese archivo ni lo subas al repositorio.

## Crear un producto

1. Pulsa **Agregar producto**.
2. Elige **Producto individual** o **Lote completo**.
3. Escribe el nombre, descripción, categoría y precio en pesos.
4. Indica las unidades disponibles. Para lotes, escribe también cuántas piezas contiene cada uno.
5. Agrega fotografías desde tu equipo o teléfono. La primera será la portada.
6. Activa **Mostrar en la tienda** cuando esté listo y pulsa **Guardar producto**.

Un lote de 8 blusas con 1 lote disponible se vende completo por el precio indicado. No representa 8 unidades vendibles por separado.

Puedes guardar un borrador sin fotos. Para mostrarlo en la tienda debe tener por lo menos una. Se permiten hasta 6 fotos JPG, PNG o WebP de 4 MB cada una.

## Cambiar o retirar productos

**Editar** abre todos los datos. Los cambios se aplican al pulsar **Guardar cambios**.

**Ocultar** retira la publicación de la tienda y conserva sus datos. **Mostrar en tienda** la vuelve a publicar.

**Eliminar producto**, dentro de la edición, pide confirmación y borra la publicación definitivamente. Si tiene reservas, ventas o pedidos asociados, el panel pide ocultarla para conservar su historial.

Los productos con la casilla **Es un producto de prueba** muestran la etiqueta «Ejemplo». Los tres productos iniciales conservan esa identificación.

## Acceso y operación local

La sesión dura 12 horas. **Cerrar sesión** revoca el acceso en el servidor. No hay registro público de administradores.

Para preparar otra instalación local, aplica las migraciones, compila y ejecuta `npm.cmd run admin:create`. Se crea un acceso con contraseña aleatoria en `.env.admin.local`. Si el usuario ya existe, no cambia sus permisos ni contraseña. Opcionalmente acepta `ADMIN_SETUP_EMAIL` y `ADMIN_SETUP_PASSWORD` como variables de entorno; nunca imprime la contraseña.

Las fotos nuevas se guardan en `.data/uploads/`, fuera del repositorio. Conserva esa carpeta junto con PostgreSQL al hacer copias de seguridad. Se puede cambiar con `CATALOG_UPLOAD_DIR`, usando una ruta absoluta. Se normalizan a WebP, hasta 1600 × 1600, sin aumentar su tamaño. Quitar una foto de una publicación no borra el archivo físico; su limpieza y el almacenamiento de objetos quedan para la preparación del despliegue.

## Implementación y verificaciones

- Auth guarda contraseñas con scrypt y sesiones opacas cuyo token se persiste como hash.
- La cookie es HttpOnly, SameSite=Strict y Secure en producción. Next valida el origen de las operaciones de escritura.
- Catalog comprueba el rol ADMIN mediante Auth en cada petición privada, incluso al acceder directamente al servicio.
- Creación, edición y eliminación escriben un historial en ProductAudit en la misma transacción.
- La edición y eliminación comprueban updatedAt para detectar cambios desde otra pestaña.
- `npm.cmd run test:admin` comprueba permisos, CRUD, fotos, conflictos, historial, vencimiento y revocación con datos temporales en PostgreSQL. Requiere compilar y aplicar las migraciones.

El panel usa la estructura visual del frame Figma 6:58: barra lateral oscura de 247 px, cabecera blanca de 79 px, fondo #f6f6f4, tarjetas y formulario a dos columnas. La marca es texto nativo del diseño; no incorpora activos gráficos nuevos. El listado y el acceso extienden esos estilos. Los campos adicionales de productos individuales, existencias y visibilidad completan el CRUD solicitado. Se adapta a celular.

Se actualizaron dependencias HTTP compatibles y se fija temporalmente multer 2.5.0 bajo @nestjs/platform-express para incorporar su corrección de seguridad. La auditoría mantiene avisos moderados en herramientas de lint; no se forzaron cambios de versión principal de esas herramientas.

## Clientes

En **Clientes** puedes buscar cuentas por nombre o correo. **Desactivar** cierra sus sesiones e impide que ingresen hasta que pulses **Reactivar**; las sesiones anteriores no se restauran. Cada cambio de estado queda registrado.

## Operar pedidos

Abre **Pedidos** para filtrar por estado y consultar artículos, importe y destino. Puedes cancelar un pedido pendiente y liberar sus existencias. Para un pedido pagado, pulsa **Empezar preparación**. En recogida, marca el pedido listo y confirma cuando el cliente lo recoja. Para entrega a domicilio, marca listo para envío, en reparto y finalmente entregado. Los cambios quedan registrados y el cliente ve el estado en Mis pedidos. La acreditación del pago corresponde al proceso de cobro.
