# Frontend basado en Figma

Fuente: [OK FAMILY WEB · UI UX Mockups & Design System](https://www.figma.com/design/lWfmOvO0a9ZQ4Wei5bFAij/OK-FAMILY-WEB?node-id=4-7).

## Pantallas implementadas

| Pantalla            | Desktop | Mobile     | Ruta              |
| ------------------- | ------- | ---------- | ----------------- |
| Inicio              | 4:7     | 5:7        | /                 |
| Catálogo            | 4:66    | 5:44       | /catalogo         |
| Detalle             | 4:166   | 5:115      | /productos/[slug] |
| Paleta y tipografía | 2:2     | compartida | globals.css       |

El diseño toma las capas finales del mockup, que cubren versiones anteriores presentes en el mismo frame. Se conservan el logo original rasterizado y los SVG originales del hero sin modificar sus dimensiones intrínsecas. Inter se sirve localmente mediante @fontsource-variable/inter.

## Integración con funciones existentes

Los datos, imágenes, precios, cantidades y estados siguen viniendo de la API. Los ejemplos del mockup no se insertan en PostgreSQL. Las publicaciones sin fotografía conservan un marcador explícito en lugar de recibir imágenes de otra mercancía.

El catálogo mantiene búsqueda, categoría, tipo de publicación, paginación y estados de error/vacío. Los enlaces anteriores /?q=..., /?type=... y /?page=... continúan funcionando. /catalogo ofrece la misma consulta con el layout del mockup.

Los filtros por temporada, talla y tamaño de lote del diseño todavía no existen en la API: se muestran los filtros operativos de búsqueda, categoría y tipo. Cuenta, carrito y compra están deshabilitados y señalados como próximos. El domicilio y horario existentes permanecen en el pie de página.

## Recursos estáticos

Los archivos de public/figma se descargaron desde get_design_context. No se utilizan URLs temporales de Figma durante la ejecución.

| Recurso               | Capa de origen              | Uso y geometría original                                                                                     |
| --------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| ok-family-logo.png    | I4:13;27:7 (componente 3:4) | Cabecera; 214.5 × 68.97 desktop / 195 × 62.7 mobile, proporción conservada. Reutilizado en footer existente. |
| hero-desktop-1..4.svg | 35:21, 35:24, 35:27, 35:30  | Siete posiciones del hero; cada SVG 59.5 × 322.74, repetición 1/2/3/4/1/2/3.                                 |
| hero-mobile-1..4.svg  | 37:19, 37:22, 37:25, 37:28  | Seis posiciones del hero; cada SVG 46.55 × 219.64, repetición 1/2/3/4/1/2.                                   |

Los elementos del hero son ilustración editorial, no existencias. La galería de detalle utiliza las imágenes que proporciona cada publicación. CSS adapta el tamaño del contenedor ilustrado a tabletas y móviles pequeños sin editar ni deformar los SVG.

## Administración del catálogo

El panel privado usa el frame 6:58 (Administración · Publicar lote mayoreo), consultado con get_design_context. Reutiliza Inter y los tokens existentes. Sidebar, cabecera, tarjetas y formulario respetan su estructura; los controles adicionales hacen operable el CRUD de productos individuales y lotes. No hay activos gráficos estáticos nuevos en ese frame. Consulta admin-guide.md para su operación.
