"""Recompone la captura del atlas como anexo vertical en escala de grises.

No consulta filas ni actualiza la captura del modelo. Cada tabla aparece completa
en una hoja principal; las claves de tablas externas se repiten como referencia.
"""
from collections import defaultdict, Counter
from pathlib import Path
from html import escape
import argparse
import json
import re
import subprocess
import shutil

import pymupdf as fitz
from reportlab.pdfgen import canvas
from reportlab.graphics import renderPDF
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from svglib.svglib import svg2rlg

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / 'output/pdf'
STAGE = ROOT / 'tmp/pdfs/sigma-anexo'
DOMAINS = [
    ('01', 'Identidad y gobierno'), ('02', 'Estructura académica'),
    ('03', 'Expediente estudiantil'), ('04', 'Oferta UCOTESIS'),
    ('05', 'Inscripción y documentos'), ('06', 'Pagos y conciliación'),
    ('07', 'Proyectos y evaluación'), ('08', 'Coordinación académica'),
]
# Dimensiones y márgenes medidos en el PDF del monográfico facilitado.
W, H = 596, 842
MARGIN = 70.866142
MIN_SCALE = .96
AREA_W, AREA_H = W - 2 * MARGIN, 610


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--viz-module', default=str(ROOT / '.tmp/er-tools/node_modules/@viz-js/viz/dist/viz.js'))
    parser.add_argument('--start-page', type=int, default=1, help='Primera página del anexo en el documento integrado.')
    args = parser.parse_args()
    if args.start_page < 1:
        parser.error('--start-page debe ser mayor que cero')
    capture = json.loads((HERE / 'modelo-fisico.json').read_text(encoding='utf-8-sig'))
    coverage = json.loads((HERE / 'cobertura.json').read_text(encoding='utf-8-sig'))
    relationships = json.loads((HERE / 'relaciones.json').read_text(encoding='utf-8-sig'))
    columns = defaultdict(list)
    for column in capture['columns']:
        columns[column['TABLE_NAME']].append(column)
    pk, unique = defaultdict(list), defaultdict(list)
    keys = defaultdict(list)
    for key in capture['keys']:
        keys[(key['TABLE_NAME'], key['CONSTRAINT_NAME'])].append(key)
    for (table, _), values in keys.items():
        if values[0]['CONSTRAINT_TYPE'] == 'PRIMARY KEY':
            pk[table] = [value['COLUMN_NAME'] for value in values]
        elif values[0]['CONSTRAINT_TYPE'] == 'UNIQUE':
            unique[table].append([value['COLUMN_NAME'] for value in values])
    domains = {domain['num']: domain['tables'] for domain in coverage['domains']}
    home = {table: domain for domain, tables in domains.items() for table in tables}
    assert len(home) == coverage['tables']
    STAGE.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    source_pdf = HERE.parent / 'SIGMA_Diagramas_ER.pdf'
    backup_pdf = STAGE / 'SIGMA_Diagramas_ER_original.pdf'
    if source_pdf.exists() and not backup_pdf.exists():
        shutil.copy2(source_pdf, backup_pdf)

    def wrapped(text, limit=25):
        words = re.split(r'(?<=_)', text)
        lines, line = [], ''
        for word in words:
            if line and len(line + word) > limit:
                lines.append(line)
                line = ''
            line += word
        lines.append(line)
        return '<BR ALIGN="LEFT"/>'.join(escape(part) for part in lines)

    def node(table, reference=False, needed=None):
        selected = [column for column in columns[table] if not reference or column['COLUMN_NAME'] in needed]
        if reference:
            labels = '<BR ALIGN="LEFT"/>'.join(escape(column['COLUMN_NAME']) for column in selected)
            return (f'"{table}" [id="entity-{table}",label=<<TABLE BORDER="1" COLOR="#555555" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4">'
                    f'<TR><TD BGCOLOR="#eeeeee"><B>{wrapped(table, 22)}</B></TD></TR>'
                    f'<TR><TD><FONT POINT-SIZE="8">Referencia: dominio {home[table]}</FONT></TD></TR>'
                    f'<TR><TD ALIGN="LEFT">{labels}</TD></TR></TABLE>>];')
        background = '#f0f0f0' if reference else '#d9d9d9'
        rows = [f'<TR><TD COLSPAN="4" BGCOLOR="{background}" CELLPADDING="5"><FONT POINT-SIZE="11"><B>{escape(table)}</B></FONT></TD></TR>']
        rows.append('<TR>' + ''.join(f'<TD BGCOLOR="#eeeeee"><FONT POINT-SIZE="8"><B>{label}</B></FONT></TD>' for label in ['Clave', 'Atributo', 'Tipo SQL', 'Nulo']) + '</TR>')
        for index, column in enumerate(selected):
            name = column['COLUMN_NAME']
            marks = (['PK'] if name in pk[table] else []) + ['FK ' + rel['id'] for rel in relationships if rel['child'] == table and name in rel['columns']] + ['U' + str(i) for i, constraint in enumerate(unique[table], 1) if name in constraint]
            kind = 'ENUM' if column['DATA_TYPE'] == 'enum' else column['COLUMN_TYPE'].upper().replace(' UNSIGNED', ' U')
            shade = '#ffffff' if index % 2 == 0 else '#f7f7f7'
            rows.append(f'<TR><TD PORT="{name}_in" ALIGN="LEFT" BGCOLOR="{shade}"><FONT POINT-SIZE="8.5">{escape(" / ".join(marks) or "-")}</FONT></TD><TD ALIGN="LEFT" BGCOLOR="{shade}">{wrapped(name)}</TD><TD ALIGN="LEFT" BGCOLOR="{shade}"><FONT POINT-SIZE="8.5">{escape(kind)}</FONT></TD><TD PORT="{name}_out" BGCOLOR="{shade}">{"Sí" if column["IS_NULLABLE"] == "YES" else "No"}</TD></TR>')
        return f'"{table}" [id="entity-{table}",label=<<TABLE BORDER="1" COLOR="#555555" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3">' + ''.join(rows) + '</TABLE>>];'

    def graph(tables):
        rels = [rel for rel in relationships if rel['child'] in tables]
        refs = sorted({rel['parent'] for rel in rels} - set(tables))
        needed = defaultdict(set)
        for rel in rels:
            needed[rel['parent']].update(rel['targets'])
        lines = ['digraph ER {', 'graph [rankdir=TB,bgcolor="white",pad="0.08",nodesep="0.3",ranksep="0.5",splines=spline,outputorder=edgesfirst,newrank=true];', 'node [shape=plain,fontname="Arial",fontsize=9];', 'edge [fontname="Arial",fontsize=8.5,color="#333333",fontcolor="#111111",penwidth=0.85,dir=both,arrowsize=0.65,labeldistance=1.8,labelangle=25];']
        lines += [node(table) for table in tables] + [node(table, True, needed[table]) for table in refs]
        # Referencias en filas de dos para respetar el ancho de una hoja vertical.
        if len(tables) == 1 and refs:
            for start in range(0, len(refs), 2):
                pair = refs[start:start + 2]
                lines.append('{ rank=same; ' + '; '.join('"' + item + '"' for item in pair) + '; }')
                if len(pair) == 2:
                    lines.append(f'"{pair[0]}" -> "{pair[1]}" [style=invis,dir=none,weight=20];')
                next_table = refs[start + 2] if start + 2 < len(refs) else tables[0]
                lines.append(f'"{pair[0]}" -> "{next_table}" [style=invis,dir=none,weight=20];')
        for rel in rels:
            tail = 'teeodot' if rel['parentCard'] == '0..1' else 'teetee'
            head = 'teeodot' if rel['childCard'] == '0..1' else 'crowodot'
            style = 'solid' if rel['identifying'] else 'dashed'
            parent = f'"{rel["parent"]}"' if rel['parent'] in refs else f'"{rel["parent"]}":{rel["targets"][0]}_out:e'
            constraint = 'false' if len(tables) == 1 and refs else 'true'
            lines.append(f'{parent} -> "{rel["child"]}":{rel["columns"][0]}_in:w [id="relation-{rel["id"]}",constraint={constraint},arrowtail={tail},arrowhead={head},style={style},label="{rel["id"]}",taillabel="{rel["parentCard"]}",headlabel="{rel["childCard"]}"];')
        return '\n'.join(lines + ['}']), rels, refs

    # Divide un dominio solo cuando no cabe en el área útil del anexo.
    pending = [(num, title, domains[num]) for num, title in DOMAINS]
    final = []
    batch = 0
    while pending:
        batch += 1
        folder = STAGE / f'batch-{batch}'
        folder.mkdir(exist_ok=True)
        specs = []
        needs_render = False
        for index, (num, title, tables) in enumerate(pending):
            dot, rels, refs = graph(tables)
            stem = f'candidate-{index:03}'
            dot_path = folder / (stem + '.dot')
            if not dot_path.exists() or dot_path.read_text(encoding='utf-8') != dot or not (folder / (stem + '.svg')).exists():
                needs_render = True
                dot_path.write_text(dot, encoding='utf-8')
            specs.append((num, title, tables, rels, refs, stem))
        if needs_render:
            subprocess.run(['node', str(HERE / 'render-er.mjs'), args.viz_module, str(folder), str(folder)], check=True)
        pending = []
        for num, title, tables, rels, refs, stem in specs:
            svg_path = folder / (stem + '.svg')
            drawing = svg2rlg(str(svg_path))
            scale = min(AREA_W / drawing.width, AREA_H / drawing.height, 1)
            if scale < MIN_SCALE and len(tables) > 1:
                middle = len(tables) // 2
                pending.extend([(num, title, tables[:middle]), (num, title, tables[middle:])])
            else:
                if scale < .87:
                    raise ValueError(f'{tables}: tabla individual necesita revisión de distribución vertical ({scale:.3f})')
                layout = json.loads((folder / (stem + '.layout.json')).read_text(encoding='utf-8'))
                assert len([edge for edge in layout.get('edges', []) if edge.get('id', '').startswith('relation-')]) == len(rels)
                assert len([node for node in layout['objects'] if 'pos' in node]) == len(tables) + len(refs)
                boxes = []
                for entity in (entity for entity in layout['objects'] if 'pos' in entity):
                    x, y = map(float, entity['pos'].split(','))
                    width, height = float(entity['width']) * 72, float(entity['height']) * 72
                    for left, bottom, right, top in boxes:
                        assert x + width / 2 <= left or x - width / 2 >= right or y + height / 2 <= bottom or y - height / 2 >= top
                    boxes.append((x - width / 2, y - height / 2, x + width / 2, y + height / 2))
                final.append(dict(num=num, title=title, tables=tables, refs=refs, rels=rels, drawing=drawing, scale=scale))
    final.sort(key=lambda sheet: (sheet['num'], domains[sheet['num']].index(sheet['tables'][0])))
    assert Counter(table for sheet in final for table in sheet['tables']) == Counter(home.keys())
    assert Counter(rel['id'] for sheet in final for rel in sheet['rels']) == Counter(rel['id'] for rel in relationships)
    assert sum(len(columns[table]) for sheet in final for table in sheet['tables']) == coverage['columns']

    font_dir = Path('C:/Windows/Fonts')
    pdfmetrics.registerFont(TTFont('SigmaArial', str(font_dir / 'arial.ttf')))
    pdfmetrics.registerFont(TTFont('SigmaArialBold', str(font_dir / 'arialbd.ttf')))
    pdfmetrics.registerFont(TTFont('SigmaTimes', str(font_dir / 'times.ttf')))
    pdf_path = OUT / 'SIGMA_Diagramas_ER_Anexo_Grises.pdf'
    pdf = canvas.Canvas(str(pdf_path), pagesize=(W, H), pageCompression=1)
    pdf.setTitle('Anexo D: Diagramas entidad-relación - SIGMA')
    pdf.setAuthor('SIGMA - UCOTESIS')

    def text(x, y, value, size=9, bold=False, gray=0):
        pdf.setFillGray(gray)
        pdf.setFont('SigmaArialBold' if bold else 'SigmaArial', size)
        pdf.drawString(x, y, value)

    def page_number(number):
        pdf.setFillGray(0)
        pdf.setFont('SigmaTimes', 12)
        pdf.drawRightString(W - MARGIN, H - 77, str(args.start_page + number - 1))

    def body_line(y, value, indent=False):
        text(MARGIN + (36 if indent else 0), H - y, value, 11)

    page_number(1)
    text(MARGIN, H - 96, 'Anexo D: Diagramas entidad-relación', 14, True)
    body_line(131, 'Este anexo presenta el modelo físico de datos de SIGMA para', True)
    body_line(156, f'UCOTESIS, UASD Recinto Santiago. La captura del {capture["date"]}')
    body_line(181, f'comprende {coverage["tables"]} tablas, {coverage["columns"]} atributos y {len(relationships)} relaciones físicas.')
    body_line(216, 'Los diagramas se organizan por dominio. Cada tabla conserva', True)
    body_line(241, 'todos sus atributos en su hoja principal. Las cajas de referencia muestran')
    body_line(266, 'las claves de tablas cuyo detalle se encuentra en otra hoja.')
    text(MARGIN, H - 306, 'Índice de diagramas', 11, True)
    for index, (num, title) in enumerate(DOMAINS):
        start = next(i + 2 for i, sheet in enumerate(final) if sheet['num'] == num) + args.start_page - 1
        total = sum(sheet['num'] == num for sheet in final)
        y = H - 337 - index * 25
        text(MARGIN, y, f'{num}. {title}', 11)
        pdf.setFont('SigmaArial', 11)
        pdf.drawRightString(W - MARGIN, y, f'{start}-{start + total - 1}')
        pdf.linkRect('', f'domain-{num}', (MARGIN, y - 5, W - MARGIN, y + 12), thickness=0)
    text(MARGIN, H - 566, 'Convenciones', 11, True)
    for index, value in enumerate([
        'PK: clave primaria. FK Rxx: clave foránea e identificador de relación.',
        'U1, U2: restricciones UNIQUE. U en el tipo SQL: UNSIGNED.',
        'Nulo: el atributo admite NULL. ENUM: valores en el diccionario de datos.',
        '1: exactamente uno. 0..1: ninguno o uno. 0..N: ninguno o varios.',
        'Línea continua: FK incluida en la PK de la tabla dependiente.',
        'Línea discontinua: relación no identificadora.',
    ]):
        body_line(596 + index * 25, value)
    pdf.bookmarkPage('cover')
    pdf.addOutlineEntry('Anexo D: presentación e índice', 'cover')
    pdf.showPage()

    seen = set()
    validation = []
    for index, sheet in enumerate(final):
        number = index + 2
        num = sheet['num']
        if num not in seen:
            pdf.bookmarkPage(f'domain-{num}')
            pdf.addOutlineEntry(f'{num} - {sheet["title"]}', f'domain-{num}')
            seen.add(num)
        section = [item for item in final if item['num'] == num]
        part = section.index(sheet) + 1
        page_number(number)
        text(MARGIN, H - 96, f'{num}. {sheet["title"]}', 11, True)
        text(MARGIN, H - 121, f'Diagrama {index + 1}. Parte {part} de {len(section)}.', 11)
        drawing = sheet['drawing']
        scale = sheet['scale']
        pdf.saveState()
        pdf.translate((W - drawing.width * scale) / 2, H - 142 - drawing.height * scale)
        pdf.scale(scale, scale)
        renderPDF.draw(drawing, pdf, 0, 0)
        pdf.restoreState()
        pdf.showPage()
        validation.append({key: sheet[key] for key in ['num', 'tables', 'refs', 'scale']})
    pdf.save()
    document = fitz.open(pdf_path)
    assert len(document) == len(final) + 1
    for number, page in enumerate(document, 1):
        assert abs(page.rect.width - W) < .1 and abs(page.rect.height - H) < .1
        assert page.get_text().strip()
        printable = fitz.Rect(MARGIN - .5, 65, W - MARGIN + 1.5, H - MARGIN + .5)
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                for span in line['spans']:
                    assert printable.contains(fitz.Rect(span['bbox'])), (number, span['text'], span['bbox'])
                    color = span['color']
                    assert (color >> 16) == ((color >> 8) & 255) == (color & 255)
        for drawing in page.get_drawings():
            for color in [drawing['fill'], drawing['color']]:
                assert color is None or max(color) - min(color) < .001
        page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).save(STAGE / f'page-{number:02}.png')
    report = dict(pages=len(document), tables=coverage['tables'], columns=coverage['columns'], relations=len(relationships),
                  pageSizePt=[W, H], portrait=True, marginPt=MARGIN, grayscale=True,
                  minimumDiagramTextPt=min(sheet['scale'] * 8 for sheet in final), sheets=validation)
    (STAGE / 'validation.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    shutil.copy2(pdf_path, source_pdf)
    print(json.dumps({key: value for key, value in report.items() if key != 'sheets'}, ensure_ascii=False))
    print(pdf_path)


if __name__ == '__main__':
    main()
