# VAKU Estudio · Tienda online

Página de VAKU, collares de cerámica unisex hechos a mano en Córdoba.

Es una página estática (HTML, CSS y JavaScript, sin instalaciones). El catálogo se lee de una **planilla de Google**, así que productos, precios, ofertas, códigos de descuento y fotos se cambian desde ahí, sin tocar código.

## Cómo se edita la tienda (para Lorenzo)

Todo se hace en la planilla **“VAKU – Catálogo de la tienda”** de Google Drive. Los cambios aparecen en la página en uno o dos minutos (recargando la página).

| Pestaña | Para qué sirve |
|---|---|
| **Instrucciones** | Guía paso a paso. |
| **Productos** | Un collar por fila: nombre, descripción, precio, precio oferta, elemento, estado y hasta 10 fotos. Cada pieza se vende tal cual se ve: el cliente solo elige el color de hilo. |
| **Codigos** | Códigos de descuento: porcentaje o monto fijo, compra mínima y vencimiento. |
| **Galeria** | Fotos de la sección "Mirá cómo queda VAKU": link de la foto (carpeta de Drive "VAKU – Galería"), descripción y orden. |
| **Ajustes** | WhatsApp que recibe pedidos, Instagram, texto de la barra de arriba, elemento de la semana y su descuento, colores de hilo e hilos agotados, texto de envíos. |

**Fotos:** subilas a la carpeta de Drive **“VAKU – Fotos de la tienda”**, copiá el vínculo (clic derecho > Compartir > Copiar vínculo) y pegalo en *Foto 1* a *Foto 10* (Foto 1 es la principal). La carpeta y la planilla tienen que seguir compartidas como “Cualquier persona con el vínculo puede ver”, porque así la página puede leerlas.

**No cambies** los nombres de las pestañas ni la primera fila (los encabezados): la página los usa para encontrar los datos.

## Cómo funciona el pedido

El cliente arma el carrito, elige color de hilo, aplica un código, puede pedir una foto de cómo queda con ese hilo y toca **Enviar pedido por WhatsApp**. Se abre WhatsApp con el pedido escrito (productos, total, nombre, entrega) dirigido al número de la pestaña *Ajustes*. El pago y el envío se coordinan por ahí.

## Publicar con GitHub Pages (una sola vez)

1. En GitHub, entrá al repositorio > **Settings** > **Pages**.
2. En *Build and deployment* elegí **Deploy from a branch**, rama **main**, carpeta **/ (root)** y guardá.
3. En uno o dos minutos la página queda en `https://nicolopez2706.github.io/VAKU/`.

GitHub Pages es gratis para repositorios públicos.

## Estructura

```
index.html          página
assets/styles.css   estilos y animaciones
assets/app.js       catálogo, carrito, códigos y pedido por WhatsApp
config.js           ID de la planilla de Google
data/*.csv          copia de respaldo del catálogo (se usa si la planilla no responde)
img/                fotos y logo
```

Para usar otra planilla, cambiá `sheetId` en `config.js`. Para probar en tu compu: `python3 -m http.server` dentro de la carpeta y abrí `http://localhost:8000`.
