# SIGMA · Diagramas entidad-relación

Modelo físico actualizado al **14 de septiembre de 2026**: **56 tablas, 525 atributos y 87 claves foráneas**. Se contrastaron los nombres de tablas y columnas y los extremos de todas las relaciones entre MySQL y `apps/api/prisma/schema.prisma`. Las cuatro vistas se documentan aparte; no se cuentan como tablas ni se les atribuyen claves foráneas.

Abre **[index.html](index.html)** para explorar los diagramas. No requiere servidor ni conexión a Internet.

## Entregables

| Archivo o carpeta | Contenido |
| --- | --- |
| [Anexo PDF](SIGMA_Diagramas_ER.pdf) | Presentación e índice navegable y 43 hojas de diagramas en formato vertical, igual al monográfico, y escala de grises; texto y líneas vectoriales. |
| [Modelo global SVG](svg/00-modelo-global.svg) | Las 56 tablas y las 87 relaciones, mostrando solamente atributos PK/FK para facilitar la navegación. |
| [svg](svg/) | Nueve diagramas vectoriales para ampliar sin pérdida de calidad. |
| [png](png/) | Los mismos nueve diagramas en imágenes de alta resolución. |
| [Diccionario de datos](DICCIONARIO_DATOS.md) | Todos los atributos, tipos SQL completos, valores ENUM, claves únicas y catálogo R01-R87 con acciones referenciales. |
| [fuentes](fuentes/) | Archivos DOT editables, metadatos de esquema, generador y comprobaciones de cobertura. |

## Láminas de detalle

| Lámina | Dominio | Tablas propias | Relaciones |
| --- | --- | ---: | ---: |
| [01](svg/01-identidad-gobierno.svg) | Identidad y gobierno | 9 | 10 |
| [02](svg/02-estructura-academica.svg) | Estructura académica | 10 | 12 |
| [03](svg/03-expediente-estudiantil.svg) | Expediente estudiantil | 3 | 6 |
| [04](svg/04-oferta-ucotesis.svg) | Oferta UCOTESIS | 7 | 9 |
| [05](svg/05-inscripcion-documentos.svg) | Inscripción y documentos | 7 | 17 |
| [06](svg/06-pagos-conciliacion.svg) | Pagos y conciliación | 8 | 11 |
| [07](svg/07-proyectos-evaluacion.svg) | Proyectos y evaluación | 5 | 9 |
| [08](svg/08-coordinacion-academica.svg) | Coordinación académica | 7 | 13 |
| **Total** | | **56** | **87** |

Cada tabla tiene una lámina principal que muestra todos sus atributos. Las tablas de otro dominio aparecen en gris, con las claves necesarias y el número de lámina donde se encuentra su detalle. Cada relación se dibuja en la lámina de la tabla que contiene la FK; así no se duplica el conteo.

## Cómo leer los diagramas

- **PK**: clave primaria. Si aparece en varias filas de una tabla, la clave es compuesta.
- **FK Rxx**: atributo de una clave foránea. El identificador remite al catálogo del diccionario y a `fuentes/relaciones.json`. En claves compuestas, todos los atributos llevan el mismo Rxx, aunque la conexión se ancla en el primer atributo.
- **U1, U2…**: restricciones UNIQUE de cada tabla. Varias filas con el mismo número forman una única restricción compuesta; no son únicas individualmente.
- **1**: exactamente uno; **0..1**: ninguno o uno; **0..N**: ninguno o varios. La notación de pata de cuervo acompaña estas etiquetas. La obligatoriedad se deriva de NULL y la unicidad de las restricciones físicas, sin suponer mínimos de participación no impuestos por la base de datos.
- **Línea continua**: FK incluida en la PK de la tabla dependiente. **Línea discontinua**: relación no identificadora.
- **Nulo = Sí**: la columna acepta NULL. **U** en el tipo significa UNSIGNED. El tipo abreviado ENUM se desarrolla en el diccionario.

Los campos de seguimiento que no tienen una FK física no generan líneas por inferencia; el diccionario los identifica. Las tablas existentes se conservan en el modelo aunque su pantalla esté oculta o su funcionalidad sea de simulación.

## Impresión y edición

El PDF usa **hojas verticales de 596 × 842 puntos**, las dimensiones exactas
del PDF del monográfico de referencia (A4, aproximadamente 210 × 297 mm),
con márgenes de **2,5 cm** y únicamente blanco, negro y tonos grises. Incluye
la presentación **Anexo D: Diagramas entidad-relación**, un índice y 43 hojas
de diagramas. Los párrafos e identificadores de diagramas usan Arial de 11 puntos;
la numeración está en la esquina superior derecha, como en el monográfico.
Las ocho láminas originales se distribuyen en varias hojas para conservar todos
los atributos y relaciones. Las cajas de referencia se simplifican a nombre,
dominio y claves para respetar el ancho vertical. Los nombres, tipos y claves
siguen siendo vectoriales; el menor texto del diagrama supera los 7 puntos.
Imprime a tamaño real, al 100 %. El índice y los marcadores permiten navegar por dominio.
Los SVG y PNG originales siguen disponibles para explorar cada dominio completo
con zoom; su estilo es independiente de esta edición del PDF.

Los DOT pueden editarse con Graphviz. Para cambios permanentes en el estilo o distribución, modifica `fuentes/generar-diagramas.py`; regenerar sobrescribe los DOT y los documentos generados.

## Regeneración

Para regenerar el anexo vertical en grises a partir de los metadatos del atlas:

```powershell
python db/Diagramas/fuentes/generar-a4.py
```

Usa las mismas dependencias de Python y Graphviz WASM indicadas abajo. Produce
`output/pdf/SIGMA_Diagramas_ER_Anexo_Grises.pdf` y actualiza el PDF de esta carpeta.
Conserva la fecha de la captura del modelo; el cambio de diseño no actualiza el
esquema ni consulta la base. Verifica cobertura de tablas, atributos y relaciones,
ausencia de solapamientos entre tablas, tamaño de hoja, escala de grises y contenido
dentro de los márgenes. Los renders y el informe quedan en
`tmp/pdfs/sigma-anexo/`. La numeración independiente empieza en 1. Para continuar
la numeración al integrarlo, añade `--start-page NUMERO`; el índice también
se ajusta a ese número.

Desde la raíz del repositorio, con Node.js 22 o posterior y Python 3.10 o posterior:

```powershell
python -m pip install reportlab svglib pymupdf
npm install --prefix .tmp/er-tools --no-save --ignore-scripts @viz-js/viz@3.30.0
python db/Diagramas/fuentes/generar-diagramas.py
```

La regeneración normal usa `fuentes/modelo-fisico.json` y **no se conecta a la base de datos**. Requiere que el esquema Prisma coincida con esa captura. Se puede indicar otra instalación de Graphviz WASM con `--viz-module RUTA_A_VIZ_JS`, o generar solo DOT, diccionario y cobertura con `--only-sources`.

Para actualizar primero la captura, instala las dependencias del proyecto con pnpm y configura `DATABASE_URL` o el archivo local `apps/api/.env`:

```powershell
node db/Diagramas/fuentes/capturar-modelo.mjs
python db/Diagramas/fuentes/generar-diagramas.py
```

La captura solo consulta `information_schema`: no lee filas de negocio ni modifica la base de datos. No guarda credenciales. Si se agregan tablas, actualiza también la asignación de dominios del generador y este índice. La fecha y las cifras visibles en esta documentación corresponden a la entrega actual.

## Verificación de esta entrega

`fuentes/cobertura.json` registra el inventario y SHA-256 del esquema Prisma.
`fuentes/validacion.json` registra la cobertura y distribución de las láminas originales.
La edición vertical tiene su informe de cobertura y formato en
`tmp/pdfs/sigma-anexo/validation.json`. Se revisaron visualmente las 44 páginas
renderizadas, incluida la hoja más densa y la presentación renderizada con Poppler.
Los diagramas UML anteriores se sustituyen por estos diagramas ER.
