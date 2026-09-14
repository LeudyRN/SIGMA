# SIGMA · Diagramas entidad-relación

Modelo físico actualizado al **14 de septiembre de 2026**: **56 tablas, 525 atributos y 87 claves foráneas**. Se contrastaron los nombres de tablas y columnas y los extremos de todas las relaciones entre MySQL y `apps/api/prisma/schema.prisma`. Las cuatro vistas se documentan aparte; no se cuentan como tablas ni se les atribuyen claves foráneas.

Abre **[index.html](index.html)** para explorar los diagramas. No requiere servidor ni conexión a Internet.

## Entregables

| Archivo o carpeta | Contenido |
| --- | --- |
| [Atlas PDF](SIGMA_Diagramas_ER.pdf) | Portada con índice navegable y ocho láminas de detalle; texto y líneas vectoriales. |
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

El atlas usa formatos A2 y A1 según la densidad de cada lámina, con texto de al menos 8 puntos a tamaño real. Para imprimir, respeta el formato indicado en el encabezado; ajustar una lámina completa a A4 reduce su legibilidad. Para consultas en pantalla y presentaciones, usa SVG y amplía el área de interés. El mapa global está pensado para exploración con zoom; los detalles contienen el inventario completo de atributos.

Los DOT pueden editarse con Graphviz. Para cambios permanentes en el estilo o distribución, modifica `fuentes/generar-diagramas.py`; regenerar sobrescribe los DOT y los documentos generados.

## Regeneración

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

`fuentes/cobertura.json` registra el inventario y SHA-256 del esquema Prisma. `fuentes/validacion.json` registra la cobertura, el número de nodos y relaciones por lámina, la ausencia de solapamiento entre tablas y los tamaños mínimos de texto del PDF. Además, se revisaron visualmente las nueve páginas renderizadas y las salidas de imagen. Los diagramas UML anteriores se sustituyen por estos diagramas ER.
