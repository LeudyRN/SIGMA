"""Genera diagramas ER desde metadatos MySQL, sin leer filas ni modificar la BD."""
from pathlib import Path
from collections import defaultdict
from html import escape as esc
import json,re,hashlib,subprocess,argparse
import xml.etree.ElementTree as ET
HERE=Path(__file__).resolve().parent
OUT=HERE.parent
ROOT=HERE.parents[2]
STAGE=ROOT/'.tmp/er-stage'
DOMAINS=[
('01','Identidad y gobierno','identidad-gobierno','#173954','usuarios roles permisos usuario_roles rol_permisos sesiones notificaciones auditoria configuraciones'),
('02','Estructura académica','estructura-academica','#246884','facultades escuelas carreras recintos recinto_carreras planes_estudio recinto_carrera_planes asignaturas plan_estudio_asignaturas asignatura_relaciones'),
('03','Expediente estudiantil','expediente-estudiantil','#167868','estudiantes estudiante_carreras historial_academico'),
('04','Oferta UCOTESIS','oferta-ucotesis','#29629B','modalidades areas_investigacion periodos_academicos ofertas oferta_areas requisitos oferta_requisitos'),
('05','Inscripción y documentos','inscripcion-documentos','#68558B','inscripciones inscripcion_estudiantes estados_inscripcion historial_estados_inscripcion validaciones_requisitos solicitudes_documentos documentos_inscripcion'),
('06','Pagos y conciliación','pagos-conciliacion','#96682B','metodos_pago cuentas_bancarias pagos transacciones_pago facturas conciliaciones_pago conciliacion_detalles comprobantes_transferencia'),
('07','Proyectos y evaluación','proyectos-evaluacion','#AA545C','docentes tipos_participacion proyectos_grado proyecto_docentes notas_monografico'),
('08','Coordinación académica','coordinacion-academica','#496C3A','perfiles_academicos designaciones_academicas hitos_academicos entregas_academicas solicitudes_docentes documentos_docentes alertas_academicas')]
DOMAINS=[dict(num=n,title=t,stem=n+'-'+s,color=c,tables=ts.split()) for n,t,s,c,ts in DOMAINS]
cat=json.loads((HERE/'modelo-fisico.json').read_text(encoding='utf-8-sig'))
from datetime import date
capture_date=date.fromisoformat(cat['date'])
month_names=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
date_label=f'{capture_date.day} {month_names[capture_date.month-1]} {capture_date.year}'
date_stamp=f'{capture_date.day:02} {month_names[capture_date.month-1][:3].upper()} {capture_date.year}'
columns=defaultdict(list);keys=defaultdict(list)
for col in cat['columns']:columns[col['TABLE_NAME']].append(col)
for key in cat['keys']:keys[(key['TABLE_NAME'],key['CONSTRAINT_NAME'])].append(key)
tables={t['TABLE_NAME'] for t in cat['tables'] if t['TABLE_TYPE']=='BASE TABLE'}
views={t['TABLE_NAME'] for t in cat['tables'] if t['TABLE_TYPE']=='VIEW'}
pk={t:[] for t in tables};uq=defaultdict(list);fks=[]
for (table,name),ks in sorted(keys.items()):
 cs=[k['COLUMN_NAME'] for k in ks];kind=ks[0]['CONSTRAINT_TYPE']
 if kind=='PRIMARY KEY':pk[table]=cs
 elif kind=='UNIQUE':uq[table].append(cs)
 elif kind=='FOREIGN KEY':fks.append(dict(id=f'R{len(fks)+1:02}',child=table,parent=ks[0]['REFERENCED_TABLE_NAME'],columns=cs,targets=[k['REFERENCED_COLUMN_NAME'] for k in ks],constraint=name,delete=ks[0]['DELETE_RULE'],update=ks[0]['UPDATE_RULE']))
for f in fks:
 f['parentCard']='0..1' if any(c['IS_NULLABLE']=='YES' for c in columns[f['child']] if c['COLUMN_NAME'] in f['columns']) else '1'
 f['childCard']='0..1' if any(set(u)<=set(f['columns']) for u in [pk[f['child']],*uq[f['child']]]) else '0..N'
 f['identifying']=set(f['columns'])<=set(pk[f['child']])
home={t:d for d in DOMAINS for t in d['tables']}
assert set(home)==tables
assert sum(len(d['tables']) for d in DOMAINS)==len(tables)
schema=(ROOT/'apps/api/prisma/schema.prisma').read_text(encoding='utf-8')
models=set(re.findall(r'^model (\w+)',schema,re.M));assert models==tables
relations=set()
for model,body in re.findall(r'model (\w+) \{(.*?)\n\}',schema,re.S):
 fields=[]
 for line in body.splitlines():
  field=re.match(r'\s*(\w+)\s+(\w+)([?\[\]]*)',line)
  if field and field[2] not in models:fields.append(field[1])
  rel=re.search(r'^\s*\w+\s+(\w+)\??\s+@relation\(.*?fields:\s*\[(.*?)\],\s*references:\s*\[(.*?)\]',line)
  if rel:relations.add((model,tuple(x.strip() for x in rel[2].split(',')),rel[1],tuple(x.strip() for x in rel[3].split(','))))
 assert set(fields)=={c['COLUMN_NAME'] for c in columns[model]},model
assert relations=={(f['child'],tuple(f['columns']),f['parent'],tuple(f['targets'])) for f in fks}

def marks(t,n):
 return ' / '.join((['PK'] if n in pk[t] else [])+['FK '+f['id'] for f in fks if f['child']==t and n in f['columns']]+['U'+str(i) for i,u in enumerate(uq[t],1) if n in u])
def sqltype(c):
 return 'ENUM' if c['DATA_TYPE']=='enum' else c['COLUMN_TYPE'].upper().replace(' UNSIGNED',' U')
def node(t,external=False,compact=False,needed=None):
 color='#788B9C' if external else home[t]['color']
 show=[c for c in columns[t] if not compact or c['COLUMN_NAME'] in pk[t] or any(f['child']==t and c['COLUMN_NAME'] in f['columns'] for f in fks)]
 if external:show=[c for c in columns[t] if c['COLUMN_NAME'] in needed]
 rows=[f'<TR><TD COLSPAN="4" BGCOLOR="{color}" CELLPADDING="10"><FONT COLOR="white" POINT-SIZE="12"><B>{esc(t)}</B></FONT></TD></TR>']
 if external:rows+=[f'<TR><TD COLSPAN="4" BGCOLOR="#EDF2F5"><FONT POINT-SIZE="9" COLOR="#526575">REFERENCIA / detalle en lámina {home[t]["num"]}</FONT></TD></TR>']
 rows+=['<TR>'+''.join(f'<TD BGCOLOR="#EAF0F5"><B>{x}</B></TD>' for x in ['Clave','Atributo','Tipo SQL','Nulo'])+'</TR>']
 for i,c in enumerate(show):
  name=c['COLUMN_NAME'];bg='#FFFFFF' if i%2==0 else '#F4F7FA';key=marks(t,name) or "-"
  rows+=[f'<TR><TD PORT="{name}_in" ALIGN="LEFT" BGCOLOR="{bg}"><FONT COLOR="{color}" POINT-SIZE="9">{esc(key)}</FONT></TD><TD ALIGN="LEFT" BGCOLOR="{bg}">{esc(name)}</TD><TD ALIGN="LEFT" BGCOLOR="{bg}"><FONT COLOR="#54687A" POINT-SIZE="10">{esc(sqltype(c))}</FONT></TD><TD PORT="{name}_out" BGCOLOR="{bg}">{"Sí" if c["IS_NULLABLE"]=="YES" else "No"}</TD></TR>']
 return f'"{t}" [id="entity-{t}",label=<<TABLE BORDER="1" COLOR="#CAD6E1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5">'+''.join(rows)+'</TABLE>>];'
def graph_header():
 return ['digraph ER {','graph [rankdir=LR,bgcolor="white",pad="0.3",nodesep="0.55",ranksep="1.15",splines=spline,outputorder=edgesfirst,newrank=true];','node [shape=plain,fontname="Arial",fontsize=11];','edge [fontname="Arial",fontsize=9,color="#70879A",fontcolor="#3A556B",penwidth=1.0,dir=both,arrowsize=0.65,labeldistance=2.1,labelangle=25];']
def edge(f,overview=False):
 tail='teeodot' if f['parentCard']=='0..1' else 'teetee';head='teeodot' if f['childCard']=='0..1' else 'crowodot'
 ends=f'"{f["parent"]}" -> "{f["child"]}"' if overview else f'"{f["parent"]}":{f["targets"][0]}_out:e -> "{f["child"]}":{f["columns"][0]}_in:w'
 labels='' if overview else f',label="{f["id"]}",taillabel="{f["parentCard"]}",headlabel="{f["childCard"]}"'
 return ends+f' [id="relation-{f["id"]}",tooltip="{f["id"]}: {f["constraint"]}",arrowtail={tail},arrowhead={head},style={"solid" if f["identifying"] else "dashed"}{labels}];'
def sources():
 for d in DOMAINS:
  fs=[f for f in fks if f['child'] in d['tables']];refs=sorted({f['parent'] for f in fs}-set(d['tables']));needed=defaultdict(set)
  for f in fs:needed[f['parent']].update(f['targets'])
  d['refs']=refs;d['relations']=[f['id'] for f in fs]
  dot=graph_header()+[node(t) for t in d['tables']]+[node(t,True,needed=needed[t]) for t in refs]+[edge(f) for f in fs]+['}']
  (HERE/(d['stem']+'.dot')).write_text('\n'.join(dot),encoding='utf-8')
 dot=graph_header()
 for d in DOMAINS:
  dot+=[f'subgraph cluster_{d["num"]} {{label="{d["num"]} / {d["title"]}";fontname="Arial";fontsize=18;fontcolor="{d["color"]}";color="#DFE7EE";style=rounded;margin=22;']+[node(t,compact=True) for t in d['tables']]+['}']
 dot += [edge(f,True) for f in fks]+['}'];(HERE/'00-modelo-global.dot').write_text('\n'.join(dot),encoding='utf-8')
 (HERE/'relaciones.json').write_text(json.dumps(fks,ensure_ascii=False,indent=2),encoding='utf-8')

def dictionary():
 lines=['# SIGMA · Diccionario de datos','',f'Corte: {cat["date"]}. Metadatos físicos de MySQL contrastados con Prisma. Sin filas ni datos personales.','','## Convenciones','','PK: clave primaria. FK Rxx: relación física. U1, U2: claves UNIQUE locales a cada tabla (compuestas si comparten la marca). Nulo: admite NULL. En dibujos, U significa UNSIGNED; ENUM se desarrolla aquí.','', '1: padre obligatorio; 0..1: padre opcional o hijo único; 0..N: cero o más hijos. Nunca se supone un hijo obligatorio. Línea continua: FK incluida en la PK de la hija; discontinua: relación no identificadora.','']
 for d in DOMAINS:
  lines+=['## '+d['num']+' · '+d['title'],'']
  for t in d['tables']:
   lines+=['### '+t,'','| Atributo | Tipo MySQL | Nulo | Claves | Default / extra |','|---|---|---|---|---|']
   for c in columns[t]:
    default=str(c['COLUMN_DEFAULT']) if c['COLUMN_DEFAULT'] is not None else '(sin valor explícito / NULL)'
    vals=[c['COLUMN_NAME'],c['COLUMN_TYPE'],'Sí' if c['IS_NULLABLE']=='YES' else 'No',marks(t,c['COLUMN_NAME']) or '-',default+' / '+(c['EXTRA'] or '-')]
    lines+=['| '+' | '.join(v.replace('|','\\|') for v in vals)+' |']
   lines+=['','PK: `'+', '.join(pk[t])+'`.']+['- U'+str(i)+': `'+', '.join(u)+'`.' for i,u in enumerate(uq[t],1)]+['']
 lines+=['## Relaciones físicas','','| ID | Tabla hija / columnas FK | Tabla padre / columnas clave | Padre por hijo | Hijos por padre | DELETE | UPDATE |','|---|---|---|---|---|---|---|']
 for f in fks:lines+=[f'| {f["id"]} | {f["child"]} ({", ".join(f["columns"])}) | {f["parent"]} ({", ".join(f["targets"])}) | {f["parentCard"]} | {f["childCard"]} | {f["delete"]} | {f["update"]} |']
 lines+=['','## Trazabilidad sin FK declarada','','Se conservan como atributos. No se dibuja una relación que MySQL no garantiza.','']
 for t in sorted(tables):
  ns=[c['COLUMN_NAME'] for c in columns[t] if c['COLUMN_NAME'].endswith('_por') and not any(f['child']==t and c['COLUMN_NAME'] in f['columns'] for f in fks)]
  if ns:lines+=['- `'+t+'`: '+', '.join('`'+n+'`' for n in ns)+'.']
 lines+=['','## Vistas de consulta','','No son tablas persistentes ni tienen claves foráneas propias. Se excluyen del ER físico.','']
 for t in sorted(views):lines+=['### '+t,'','| Columna | Tipo MySQL |','|---|---|']+[f'| {c["COLUMN_NAME"]} | {c["COLUMN_TYPE"]} |' for c in columns[t]]+['']
 (OUT/'DICCIONARIO_DATOS.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')

def render(args):
 import pymupdf as fitz
 from reportlab.pdfgen import canvas
 from reportlab.lib.colors import HexColor
 from reportlab.lib.pagesizes import A4,A3,A2,A1,A0,landscape
 from reportlab.graphics import renderPDF
 from svglib.svglib import svg2rlg
 from reportlab.pdfbase import pdfmetrics
 from reportlab.pdfbase.ttfonts import TTFont
 fontroot=Path('C:/Windows/Fonts');regular='Helvetica';bold='Helvetica-Bold'
 if (fontroot/'arial.ttf').exists():
  pdfmetrics.registerFont(TTFont('Arial',str(fontroot/'arial.ttf')));pdfmetrics.registerFont(TTFont('Arial-Bold',str(fontroot/'arialbd.ttf')));regular='Arial';bold='Arial-Bold'
 for folder in ['svg','png']:(OUT/folder).mkdir(exist_ok=True)
 STAGE.mkdir(parents=True,exist_ok=True)
 subprocess.run(['node',str(HERE/'render-er.mjs'),args.viz_module,str(HERE),str(STAGE)],check=True)
 pdf=OUT/'SIGMA_Diagramas_ER.pdf';c=canvas.Canvas(str(pdf),pagesize=landscape(A4));c.setTitle('SIGMA | Atlas de diagramas entidad-relación');c.setAuthor('SIGMA - UCOTESIS')
 W,H=landscape(A4)
 def txt(x,y,text,size=10,color='#526575',weight=False):
  c.setFont(bold if weight else regular,size);c.setFillColor(HexColor(color));c.drawString(x,y,text)
 c.setFillColor(HexColor('#102C46'));c.rect(0,0,W,H,fill=1,stroke=0)
 txt(48,H-55,'SIGMA / UCOTESIS',12,'#66C3D4',True)
 txt(48,H-117,'Modelo de datos',32,'#FFFFFF',True);txt(48,H-158,'Diagramas entidad-relación',32,'#FFFFFF',True)
 txt(50,H-195,'UASD · Recinto Santiago | Modelo físico contrastado con MySQL y Prisma',13,'#CBDBE8')
 for i,(v,label) in enumerate([(len(tables),'TABLAS'),(len(fks),'RELACIONES FK'),(sum(len(columns[t]) for t in tables),'ATRIBUTOS'),(8,'LÁMINAS DE DETALLE')]):
  txt(50+i*192,H-261,str(v),30,'#FFFFFF',True);txt(50+i*192,H-282,label,9,'#9FB9CD',True)
 txt(50,235,'ÍNDICE DEL ATLAS',10,'#66C3D4',True)
 for i,d in enumerate(DOMAINS):
  x=50+(i//4)*385;y=208-(i%4)*26;txt(x,y,d['num']+'  '+d['title'],11,'#FFFFFF');c.linkRect('',d['stem'],(x,y-3,x+350,y+14),relative=0,thickness=0)
 txt(50,63,f'Corte: {date_label}. No contiene datos de usuarios.',9,'#B7CBDB')
 txt(50,46,'PDF vectorial · SVG y PNG individuales · Fuentes DOT editables · Diccionario y validación',9,'#B7CBDB')
 c.bookmarkPage('portada');c.addOutlineEntry('Portada e índice','portada');c.showPage();qa=[]
 for i,d in enumerate(DOMAINS):
  lay=json.loads((STAGE/(d['stem']+'.layout.json')).read_text());nodes=[n for n in lay['objects'] if 'pos' in n];boxes=[]
  assert len(nodes)==len(d['tables'])+len(d['refs']);assert len(lay.get('edges',[]))==len(d['relations'])
  for n in nodes:
   x,y=map(float,n['pos'].split(','));w=float(n['width'])*72;h=float(n['height'])*72
   for name,a,b,cc,dd in boxes:assert x+w/2<a or x-w/2>cc or y+h/2<b or y-h/2>dd,(d['stem'],'overlap',n['name'],name)
   boxes.append((n['name'],x-w/2,y-h/2,x+w/2,y+h/2))
  drawing=svg2rlg(str(STAGE/(d['stem']+'.svg')));dw,dh=drawing.width,drawing.height;choices=[]
  for name,size in [('A3',A3),('A2',A2),('A1',A1),('A0',A0)]:
   for w,h in [size,landscape(size)]:
    scale=min((w-88)/dw,(h-180)/dh)
    if scale>=0.88:choices.append((w*h,w,h,scale,name))
  if choices:_,w,h,scale,paper=min(choices)
  else:w,h,scale,paper=dw+88,dh+180,1,'Formato vectorial extendido'
  c.setPageSize((w,h));c.bookmarkPage(d['stem']);c.addOutlineEntry(d['num']+' · '+d['title'],d['stem'])
  c.setFillColor(HexColor(d['color']));c.rect(0,h-12,w,12,fill=1,stroke=0)
  txt(44,h-53,d['num']+' / '+d['title'],24,'#102C46',True)
  txt(44,h-76,f'SIGMA · UCOTESIS | {len(d["tables"])} tablas propias · {len(d["refs"])} referencias externas · {len(d["relations"])} relaciones | {paper}',10,'#61788B')
  c.saveState();c.translate((w-dw*scale)/2,90+(h-180-dh*scale)/2);c.scale(scale,scale);renderPDF.draw(drawing,c,0,0);c.restoreState()
  txt(44,48,'PK: primaria   FK Rxx: relación física   U1/U2: UNIQUE (compuestas si se repite)   U: UNSIGNED   Nulo: permite NULL',9)
  txt(44,32,'1: obligatorio   0..1: opcional/único   0..N: varios   Continua: FK incluida en PK; discontinua: no identificadora.',9)
  txt(44,17,f'{date_stamp} | {i+2:02} / 09 | Referencias grises: detalle en otra lámina',8)
  c.showPage();qa.append(dict(sheet=d['stem'],nodes=len(nodes),relations=len(d['relations']),nodeOverlaps=0,paper=paper,scale=round(scale,3),minimumTextPt=round(9*scale,2)))
 c.save()
 global_spec=dict(stem='00-modelo-global',num='00',title='Modelo global · Claves y relaciones',color='#102C46',tables=list(tables),relations=list(fks))
 for d in [global_spec,*DOMAINS]:
  original=(STAGE/(d['stem']+'.svg')).read_text(encoding='utf-8');root=ET.fromstring(original);_,_,vw,vh=map(float,root.attrib['viewBox'].split());width=max(vw,960)
  inside=re.sub(r'^.*?<svg\b[^>]*>','',original,flags=re.S);inside=re.sub(r'</svg>\s*$','',inside)
  note='Vista global: solo PK/FK. Los ocho detalles incluyen todos los atributos.' if d['num']=='00' else 'Cada Rxx corresponde a una FK física; el catálogo identifica todas las columnas de las claves compuestas.'
  svg=f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{width}pt" height="{vh+160}pt" viewBox="0 0 {width} {vh+160}"><title>SIGMA ER - {esc(d["title"])}</title><rect width="100%" height="100%" fill="white"/><rect width="{width}" height="10" fill="{d["color"]}"/><text x="28" y="48" font-family="Arial" font-size="23" font-weight="bold" fill="#102C46">{d["num"]} / {esc(d["title"])}</text><text x="28" y="72" font-family="Arial" font-size="11" fill="#61788B">SIGMA · UCOTESIS | MySQL + Prisma | {date_label} | {len(d["tables"])} tablas · {len(d["relations"])} relaciones físicas</text><g transform="translate({(width-vw)/2},96)">{inside}</g><text x="28" y="{vh+129}" font-family="Arial" font-size="10" fill="#526575">PK primaria · FK Rxx relación física · U1/U2 UNIQUE · U UNSIGNED · Nulo permite NULL · Referencias externas en gris</text><text x="28" y="{vh+146}" font-family="Arial" font-size="10" fill="#526575">{note}</text></svg>'
  (OUT/'svg'/(d['stem']+'.svg')).write_text(svg,encoding='utf-8')
  doc=fitz.open(stream=svg.encode(),filetype='svg');page=doc[0];zoom=min(2,4800/max(page.rect.width,page.rect.height));page.get_pixmap(matrix=fitz.Matrix(zoom,zoom),alpha=False).save(str(OUT/'png'/(d['stem']+'.png')))
 book=fitz.open(pdf);assert len(book)==9
 for i,p in enumerate(book):
  zoom=min(1.4,2200/max(p.rect.width,p.rect.height));p.get_pixmap(matrix=fitz.Matrix(zoom,zoom),alpha=False).save(str(STAGE/f'pdf-{i+1:02}.png'));assert p.get_text().strip()
 (HERE/'validacion.json').write_text(json.dumps(dict(schemaMatchesMysql=True,allTablesCovered=True,allColumnsCovered=True,allForeignKeysCovered=True,diagrams=qa,pdfPages=9),indent=2,ensure_ascii=False),encoding='utf-8')

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--viz-module',default=str(ROOT/'.tmp/er-tools/node_modules/@viz-js/viz/dist/viz.js'));ap.add_argument('--only-sources',action='store_true');args=ap.parse_args();sources();dictionary()
 summary=dict(date=cat['date'],tables=len(tables),columns=sum(len(columns[t]) for t in tables),foreignKeys=len(fks),views=len(views),schemaSha256=hashlib.sha256(schema.encode()).hexdigest(),domains=DOMAINS)
 (HERE/'cobertura.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
 if not args.only_sources:render(args)
 print(json.dumps({k:v for k,v in summary.items() if k!='domains'},ensure_ascii=False))
