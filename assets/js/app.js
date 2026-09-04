document.querySelectorAll('.tab').forEach(t=>{
  t.setAttribute('role','tab');
  t.setAttribute('aria-controls','panel-'+t.dataset.tab);
  t.setAttribute('aria-selected',t.classList.contains('active') ? 'true' : 'false');
  t.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(x=>{
      x.classList.remove('active');
      x.setAttribute('aria-selected','false');
    });
    document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    t.setAttribute('aria-selected','true');
    document.getElementById('panel-'+t.dataset.tab).classList.add('active');
  });
});
document.querySelector('.tabs').setAttribute('role','tablist');
document.querySelectorAll('.panel').forEach(panel=>panel.setAttribute('role','tabpanel'));
document.querySelectorAll('.status').forEach(status=>{
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
});
document.querySelectorAll('.field').forEach(field=>{
  const label = field.querySelector('label');
  const control = field.querySelector('input[id], select[id]');
  if(label && control && !label.htmlFor) label.htmlFor = control.id;
});

let appBusy = false;

function safeHtml(value){
  return String(value ?? '').replace(/[&<>'"]/g, char=>({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  })[char]);
}

function fileKey(file){
  return [file.name, file.size, file.lastModified].join('::');
}

function appendUniqueFiles(actuales, nuevos){
  const existentes = new Set(actuales.map(fileKey));
  return actuales.concat(nuevos.filter(file=>{
    const key = fileKey(file);
    if(existentes.has(key)) return false;
    existentes.add(key);
    return true;
  }));
}

function yieldToBrowser(){
  return new Promise(resolve=>setTimeout(resolve, 0));
}

function sanitizeFileName(name, fallback = 'archivo'){
  const limpio = String(name || fallback)
    .replace(/[\\/\0-\x1f\x7f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();
  return limpio || fallback;
}

function uniqueFileName(name, usedNames){
  const limpio = sanitizeFileName(name);
  const dot = limpio.lastIndexOf('.');
  const base = dot > 0 ? limpio.slice(0, dot) : limpio;
  const extension = dot > 0 ? limpio.slice(dot) : '';
  let candidato = limpio;
  let numero = 2;
  while(usedNames.has(candidato.toLocaleLowerCase())){
    candidato = `${base}_${numero}${extension}`;
    numero++;
  }
  usedNames.add(candidato.toLocaleLowerCase());
  return candidato;
}

function beginTask(button){
  if(appBusy) return false;
  appBusy = true;
  document.body.classList.add('busy');
  button.dataset.originalText = button.textContent;
  button.textContent = 'Procesando...';
  button.disabled = true;
  return true;
}

function endTask(button){
  appBusy = false;
  document.body.classList.remove('busy');
  button.textContent = button.dataset.originalText || button.textContent;
  delete button.dataset.originalText;
  button.disabled = false;
}

async function runAction(button, status, task){
  if(!beginTask(button)) return;
  try{
    await task();
  }catch(error){
    console.error(error);
    status.textContent = 'Ocurrió un error: ' + ((error && error.message) ? error.message : String(error));
    setProgress(status.id.replace(/-status$/, ''), null);
  }finally{
    endTask(button);
  }
}

function attachRemoveButtons(container, files, render, revokePreview = false){
  container.querySelectorAll('[data-remove]').forEach(button=>{
    button.addEventListener('click', event=>{
      event.stopPropagation();
      if(appBusy) return;
      const index = Number(button.dataset.remove);
      const [removed] = files.splice(index, 1);
      if(revokePreview && removed && removed._url) URL.revokeObjectURL(removed._url);
      render();
    });
  });
}

function naturalSort(a,b){
  return a.name.localeCompare(b.name, undefined, {numeric:true, sensitivity:'base'});
}

function extLower(name){
  const i = name.lastIndexOf('.');
  return i>=0 ? name.slice(i+1).toLowerCase() : '';
}

function extOf(name){
  const i = name.lastIndexOf('.');
  return i>=0 ? name.slice(i) : '';
}

function setupDrop(dropId, inputId, onFiles){
  const drop = document.getElementById(dropId);
  const input = document.getElementById(inputId);
  drop.tabIndex = 0;
  drop.setAttribute('role', 'button');
  drop.setAttribute('aria-label', 'Seleccionar archivos');
  drop.addEventListener('click', ()=>input.click());
  drop.addEventListener('keydown', event=>{
    if(event.key==='Enter' || event.key===' '){
      event.preventDefault();
      input.click();
    }
  });
  input.addEventListener('change', e=>{
    onFiles(Array.from(e.target.files));
    input.value = '';
  });
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag');}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag');}));
  drop.addEventListener('drop', e=>{
    const files = Array.from(e.dataTransfer.files);
    onFiles(files);
  });
}

function enableDragReorder(container, arr, onDrop){
  container.querySelectorAll('[data-idx]').forEach(el=>{
    el.draggable = true;
    el.addEventListener('dragstart', e=>{
      e.dataTransfer.setData('text/plain', el.dataset.idx);
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', ()=> el.classList.remove('dragging'));
    el.addEventListener('dragover', e=> e.preventDefault());
    el.addEventListener('drop', e=>{
      e.preventDefault();
      e.stopPropagation();
      const from = parseInt(e.dataTransfer.getData('text/plain'));
      const to = parseInt(el.dataset.idx);
      if(isNaN(from) || from===to) return;
      const moved = arr.splice(from,1)[0];
      arr.splice(to,0,moved);
      onDrop();
    });
  });
}

function loadImage(file){
  return new Promise((resolve,reject)=>{
    const img = new Image();
    const temporaryUrl = file._url ? null : URL.createObjectURL(file);
    img.onload = ()=>{
      if(temporaryUrl) URL.revokeObjectURL(temporaryUrl);
      resolve(img);
    };
    img.onerror = error=>{
      if(temporaryUrl) URL.revokeObjectURL(temporaryUrl);
      reject(error);
    };
    img.src = file._url || temporaryUrl;
  });
}

function blobToCanvas(blob){
  return new Promise((resolve,reject)=>{
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = ()=>{
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img,0,0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = ()=>{ URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

async function decodeToCanvas(file){
  const ext = extLower(file.name);
  if(ext==='heic' || ext==='heif'){
    if (typeof window.heicTo !== 'function'){
      throw new Error('La librería de HEIC todavía está cargando, espera unos segundos.');
    }
    const pngBlob = await window.heicTo({ blob: file, type: 'image/png', quality: 1 });
    return blobToCanvas(pngBlob);
  }
  if(ext==='tif' || ext==='tiff'){
    const buf = await file.arrayBuffer();
    const ifds = UTIF.decode(buf);
    UTIF.decodeImage(buf, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    const canvas = document.createElement('canvas');
    canvas.width = ifds[0].width;
    canvas.height = ifds[0].height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(ifds[0].width, ifds[0].height);
    imgData.data.set(rgba);
    ctx.putImageData(imgData,0,0);
    return canvas;
  }
  return blobToCanvas(file);
}

function canvasToBMPBlob(canvas){
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0,0,w,h).data;
  const rowSize = Math.floor((24*w+31)/32)*4;
  const pixelArraySize = rowSize*h;
  const fileSize = 54 + pixelArraySize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  view.setUint8(0,0x42); view.setUint8(1,0x4D);
  view.setUint32(2,fileSize,true);
  view.setUint32(6,0,true);
  view.setUint32(10,54,true);
  view.setUint32(14,40,true);
  view.setInt32(18,w,true);
  view.setInt32(22,h,true);
  view.setUint16(26,1,true);
  view.setUint16(28,24,true);
  view.setUint32(30,0,true);
  view.setUint32(34,pixelArraySize,true);
  view.setInt32(38,2835,true);
  view.setInt32(42,2835,true);
  view.setUint32(46,0,true);
  view.setUint32(50,0,true);
  let offset = 54;
  for(let y=h-1;y>=0;y--){
    for(let x=0;x<w;x++){
      const i = (y*w+x)*4;
      view.setUint8(offset++, imgData[i+2]);
      view.setUint8(offset++, imgData[i+1]);
      view.setUint8(offset++, imgData[i]);
    }
    const pad = rowSize - w*3;
    for(let p=0;p<pad;p++) view.setUint8(offset++,0);
  }
  return new Blob([buffer], {type:'image/bmp'});
}

function canvasToBlob(canvas, formato, calidad){
  if(formato==='bmp'){
    return Promise.resolve(canvasToBMPBlob(canvas));
  }
  const mime = {jpg:'image/jpeg', png:'image/png', webp:'image/webp'}[formato];
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>{
    if(blob) resolve(blob);
    else reject(new Error('El navegador no pudo crear el archivo de salida.'));
  }, mime, calidad));
}

function blobToImageEl(blob){
  return new Promise((resolve,reject)=>{
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = ()=>{ resolve({img, url}); };
    img.onerror = (e)=>{ URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen para recortar')); };
    img.src = url;
  });
}

async function trimTransparentPixels(imageBlob, options = {}){
  const alphaThreshold = options.alphaThreshold ?? 10;
  const padding = options.padding ?? 5;

  const { img, url } = await blobToImageEl(imageBlob);
  const width = img.naturalWidth;
  const height = img.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);

  const { data } = ctx.getImageData(0, 0, width, height);

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for(let y=0; y<height; y++){
    const filaBase = y*width*4;
    for(let x=0; x<width; x++){
      const alpha = data[filaBase + x*4 + 3];
      if(alpha > alphaThreshold){
        if(x < minX) minX = x;
        if(x > maxX) maxX = x;
        if(y < minY) minY = y;
        if(y > maxY) maxY = y;
      }
    }
  }

  // Si no se detectó ningún pixel visible (todo transparente), devolver el original sin cambios
  if(maxX < minX || maxY < minY){
    return imageBlob;
  }

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = cropW;
  outCanvas.height = cropH;
  const outCtx = outCanvas.getContext('2d');
  outCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

  return new Promise((resolve,reject) => outCanvas.toBlob(blob=>{
    if(blob) resolve(blob);
    else reject(new Error('No se pudo crear la imagen recortada.'));
  }, 'image/png'));
}

function rotateImageCanvas(img, deg){
  const canvas = document.createElement('canvas');
  const rad = deg*Math.PI/180;
  if(deg===90 || deg===270){
    canvas.width = img.naturalHeight || img.height;
    canvas.height = img.naturalWidth || img.width;
  } else {
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
  }
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width/2, canvas.height/2);
  ctx.rotate(rad);
  ctx.drawImage(img, -(img.naturalWidth||img.width)/2, -(img.naturalHeight||img.height)/2);
  return canvas;
}

function setProgress(prefijo, pct){
  const wrap = document.getElementById(prefijo+'-progress');
  const fill = document.getElementById(prefijo+'-progress-fill');
  if(!wrap || !fill) return;
  wrap.setAttribute('role','progressbar');
  wrap.setAttribute('aria-label','Progreso');
  if(pct === null){
    wrap.style.display = 'none';
    fill.style.width = '0%';
    wrap.removeAttribute('aria-valuenow');
    return;
  }
  wrap.style.display = 'block';
  const valor = Math.max(0, Math.min(100, pct));
  fill.style.width = valor + '%';
  wrap.setAttribute('aria-valuenow', String(Math.round(valor)));
}

function download(blob, nombre){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeFileName(nombre);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 60000);
}

async function descargarLote(items, nombreZip, statusEl, prefijo){
  if(items.length === 0) return;
  if(items.length === 1){
    download(items[0].blob, items[0].nombre);
    if(prefijo) setProgress(prefijo, 100);
    return;
  }
  if(statusEl) statusEl.textContent = 'Empaquetando en ZIP...';
  const zip = new JSZip();
  const nombresUsados = new Set();
  items.forEach(it => zip.file(uniqueFileName(it.nombre, nombresUsados), it.blob));
  const contenido = await zip.generateAsync({ type: 'blob' }, (meta)=>{
    if(prefijo) setProgress(prefijo, meta.percent);
  });
  download(contenido, nombreZip);
  if(prefijo) setProgress(prefijo, 100);
}

document.getElementById('reset-app').addEventListener('click', ()=>{
  if(appBusy) return;
  ['r-limpiar','p-limpiar','h-limpiar','c-limpiar','u-limpiar','ap-limpiar','s-limpiar','f-limpiar','e-limpiar']
    .forEach(id=>document.getElementById(id).click());
  document.querySelectorAll('input:not([type="file"])').forEach(input=>{
    if(input.type==='checkbox') input.checked = input.defaultChecked;
    else input.value = input.defaultValue;
    input.dispatchEvent(new Event('input', {bubbles:true}));
  });
  document.querySelectorAll('select').forEach(select=>{
    const defaultIndex = Array.from(select.options).findIndex(option=>option.defaultSelected);
    select.selectedIndex = defaultIndex >= 0 ? defaultIndex : 0;
  });
  document.querySelector('.modeswitch button[data-mode="secuencial"]').click();
  document.querySelector('.tab[data-tab="rename"]').click();
  ['r','p','h','c','u','ap','s','f','e'].forEach(prefix=>setProgress(prefix, null));
  window.scrollTo({top:0, behavior:'smooth'});
});

window.addEventListener('beforeunload', ()=>{
  [renameFiles, pdfFiles, fondoFiles, escanearFiles].forEach(lista=>{
    lista.forEach(file=>{ if(file._url) URL.revokeObjectURL(file._url); });
  });
});

/* ---------- RENOMBRAR ---------- */
let renameFiles = [];
let renameMode = 'secuencial';

document.querySelectorAll('.modeswitch button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.modeswitch button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    renameMode = btn.dataset.mode;
    document.getElementById('r-fields-secuencial').classList.toggle('is-hidden', renameMode!=='secuencial');
    document.getElementById('r-fields-buscar').classList.toggle('is-hidden', renameMode!=='buscar');
    renderRename();
  });
});

function renderRename(){
  const list = document.getElementById('r-list');
  const btn = document.getElementById('r-descargar');
  if(renameFiles.length===0){
    list.innerHTML = '<div class="empty">Todavía no hay archivos cargados.</div>';
    btn.disabled = true;
    return;
  }
  const sorted = [...renameFiles].sort(naturalSort);
  let html='';

  if(renameMode==='secuencial'){
    const prefijo = document.getElementById('r-prefijo').value || '';
    const inicio = parseInt(document.getElementById('r-inicio').value)||0;
    const paso = parseInt(document.getElementById('r-paso').value)||1;
    const digitos = parseInt(document.getElementById('r-digitos').value)||2;
    let n = inicio;
    sorted.forEach(f=>{
      const numTxt = String(n).padStart(digitos,'0');
      const nuevo = prefijo+numTxt+extOf(f.name);
      f._nuevoNombre = nuevo;
      const isImg = f.type && f.type.startsWith('image/');
      const idx = renameFiles.indexOf(f);
      html += `<div class="item">${isImg?`<img src="${f._url}" alt="">`:''}<span class="old" title="${safeHtml(f.name)}">${safeHtml(f.name)}</span><span class="arrow">&rarr;</span><span class="new" title="${safeHtml(nuevo)}">${safeHtml(nuevo)}</span><button class="btn small remove-item" type="button" data-remove="${idx}" aria-label="Quitar ${safeHtml(f.name)}">Quitar</button></div>`;
      n += paso;
    });
  } else {
    const buscar = document.getElementById('r-buscar').value;
    const reemplazar = document.getElementById('r-reemplazar').value;
    sorted.forEach(f=>{
      const nuevo = buscar ? f.name.split(buscar).join(reemplazar) : f.name;
      f._nuevoNombre = nuevo;
      const isImg = f.type && f.type.startsWith('image/');
      const idx = renameFiles.indexOf(f);
      html += `<div class="item">${isImg?`<img src="${f._url}" alt="">`:''}<span class="old" title="${safeHtml(f.name)}">${safeHtml(f.name)}</span><span class="arrow">&rarr;</span><span class="new" title="${safeHtml(nuevo)}">${safeHtml(nuevo)}</span><button class="btn small remove-item" type="button" data-remove="${idx}" aria-label="Quitar ${safeHtml(f.name)}">Quitar</button></div>`;
    });
  }
  list.innerHTML = html;
  btn.disabled = appBusy;
  attachRemoveButtons(list, renameFiles, renderRename, true);
}

setupDrop('drop-rename','file-rename', files=>{
  const nuevos = appendUniqueFiles(renameFiles, files).slice(renameFiles.length);
  nuevos.forEach(f=>{ if(f.type && f.type.startsWith('image/')) f._url = URL.createObjectURL(f); });
  renameFiles = renameFiles.concat(nuevos);
  renderRename();
});

['r-prefijo','r-inicio','r-paso','r-digitos','r-buscar','r-reemplazar'].forEach(id=>{
  document.getElementById(id).addEventListener('input', renderRename);
});

document.getElementById('r-limpiar').addEventListener('click', ()=>{
  renameFiles.forEach(f=>{ if(f._url) URL.revokeObjectURL(f._url); });
  renameFiles = [];
  document.getElementById('file-rename').value = '';
  document.getElementById('r-status').textContent = '';
  renderRename();
});

document.getElementById('r-descargar').addEventListener('click', async event=>{
  const status = document.getElementById('r-status');
  await runAction(event.currentTarget, status, async ()=>{
  setProgress('r', 0);
  const sorted = [...renameFiles].sort(naturalSort);
  const items = sorted.map(f=>({ blob: f, nombre: f._nuevoNombre }));
  status.textContent = items.length>1 ? `Empaquetando ${items.length} archivos...` : 'Descargando...';
  await descargarLote(items, 'renombrados.zip', status, 'r');
  status.textContent = `Listo, ${items.length} archivo(s) descargado(s).`;
  setTimeout(()=>setProgress('r', null), 1200);
  });
});

/* ---------- UNIR IMAGENES EN PDF ---------- */
let pdfFiles = [];

function renderPdfGroups(){
  const list = document.getElementById('p-list');
  const btn = document.getElementById('p-generar');
  const hint = document.getElementById('p-hint');
  if(pdfFiles.length===0){
    list.innerHTML = '<div class="empty">Todavía no hay imágenes cargadas.</div>';
    btn.disabled = true;
    hint.classList.add('is-hidden');
    return;
  }
  hint.classList.remove('is-hidden');
  const prefijo = document.getElementById('p-prefijo').value || 'documento_';
  const porGrupo = Math.max(1, parseInt(document.getElementById('p-porgrupo').value)||8);
  const inicio = parseInt(document.getElementById('p-inicio').value)||0;
  const digitos = parseInt(document.getElementById('p-digitos').value)||2;

  let html='';
  let n = inicio;
  for(let i=0;i<pdfFiles.length;i+=porGrupo){
    const grupo = pdfFiles.slice(i, Math.min(i+porGrupo, pdfFiles.length));
    const numTxt = String(n).padStart(digitos,'0');
    const nombreSalida = `${prefijo}${numTxt}.pdf`;
    html += `<div class="group-tag">${safeHtml(nombreSalida)} &middot; ${grupo.length} imágenes</div>`;
    grupo.forEach((f, gi)=>{
      const idxGlobal = i+gi;
      html += `<div class="item" data-idx="${idxGlobal}" style="cursor:grab;">
        <img src="${f._url}" alt="" style="transform:rotate(${f._rot||0}deg);">
        <span class="old" title="${safeHtml(f.name)}">${safeHtml(f.name)}</span>
        <button class="btn small" data-rotbtn="${idxGlobal}">${f._rot||0}&deg;</button>
        <button class="btn small remove-item" type="button" data-remove="${idxGlobal}" aria-label="Quitar ${safeHtml(f.name)}">Quitar</button>
      </div>`;
    });
    n++;
  }
  list.innerHTML = html;
  btn.disabled = appBusy;
  enableDragReorder(list, pdfFiles, renderPdfGroups);
  attachRemoveButtons(list, pdfFiles, renderPdfGroups, true);
  list.querySelectorAll('[data-rotbtn]').forEach(b=>{
    b.addEventListener('click', e=>{
      e.stopPropagation();
      const idx = parseInt(b.dataset.rotbtn);
      pdfFiles[idx]._rot = ((pdfFiles[idx]._rot||0)+90)%360;
      renderPdfGroups();
    });
  });
}

setupDrop('drop-pdf','file-pdf', files=>{
  const imgs = files.filter(f=>f.type && f.type.startsWith('image/'));
  const nuevos = appendUniqueFiles(pdfFiles, imgs).slice(pdfFiles.length);
  nuevos.forEach(f=>{ f._url = URL.createObjectURL(f); f._rot = 0; });
  nuevos.sort(naturalSort);
  pdfFiles = pdfFiles.concat(nuevos);
  renderPdfGroups();
});

['p-prefijo','p-porgrupo','p-inicio','p-digitos'].forEach(id=>{
  document.getElementById(id).addEventListener('input', renderPdfGroups);
});

document.getElementById('p-limpiar').addEventListener('click', ()=>{
  pdfFiles.forEach(f=>{ if(f._url) URL.revokeObjectURL(f._url); });
  pdfFiles = [];
  document.getElementById('file-pdf').value = '';
  document.getElementById('p-status').textContent = '';
  renderPdfGroups();
});

document.getElementById('p-generar').addEventListener('click', async event=>{
  const status = document.getElementById('p-status');
  await runAction(event.currentTarget, status, async ()=>{
  setProgress('p', 0);
  const { jsPDF } = window.jspdf;
  const prefijo = document.getElementById('p-prefijo').value || 'documento_';
  const porGrupo = Math.max(1, parseInt(document.getElementById('p-porgrupo').value)||8);
  const inicio = parseInt(document.getElementById('p-inicio').value)||0;
  const digitos = parseInt(document.getElementById('p-digitos').value)||2;

  const totalGrupos = Math.ceil(pdfFiles.length/porGrupo);
  let n = inicio;
  let gi = 0;
  const items = [];

  for(let i=0;i<pdfFiles.length;i+=porGrupo){
    gi++;
    const grupo = pdfFiles.slice(i, Math.min(i+porGrupo, pdfFiles.length));
    status.textContent = `Generando PDF ${gi} de ${totalGrupos}...`;
    setProgress('p', ((gi-1)/totalGrupos)*90);
    const pdf = new jsPDF({unit:'pt', format:'a4'});
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    for(let k=0;k<grupo.length;k++){
      await yieldToBrowser();
      const f = grupo[k];
      const img = await loadImage(f);
      let fuente = img;
      let w = img.naturalWidth, h = img.naturalHeight;
      if(f._rot && f._rot!==0){
        fuente = rotateImageCanvas(img, f._rot);
        w = fuente.width; h = fuente.height;
      }
      if(k>0) pdf.addPage();
      const margin = 24;
      const maxW = pageW - margin*2;
      const maxH = pageH - margin*2;
      const ratio = Math.min(maxW/w, maxH/h);
      const drawW = w*ratio;
      const drawH = h*ratio;
      const x = (pageW-drawW)/2;
      const y = (pageH-drawH)/2;
      pdf.addImage(fuente, 'JPEG', x, y, drawW, drawH);
    }

    const numTxt = String(n).padStart(digitos,'0');
    const nombrePdf = `${prefijo}${numTxt}.pdf`;
    const blobPdf = pdf.output('blob');
    items.push({ blob: blobPdf, nombre: nombrePdf });
    n++;
  }

  status.textContent = items.length>1 ? `Empaquetando ${items.length} PDFs...` : 'Descargando...';
  await descargarLote(items, 'pdfs.zip', status, 'p');
  status.textContent = `Listo, se generaron ${totalGrupos} PDFs.`;
  setTimeout(()=>setProgress('p', null), 1200);
  });
});

/* ---------- CONVERTIR IMAGENES (multi-formato) ---------- */
let heicFiles = [];

function renderHeic(){
  const list = document.getElementById('h-list');
  const btn = document.getElementById('h-convertir');
  if(heicFiles.length===0){
    list.innerHTML = '<div class="empty">Todavía no hay archivos cargados.</div>';
    btn.disabled = true;
    return;
  }
  let html='';
  heicFiles.forEach((f,i)=>{
    const ext = extLower(f.name);
    html += `<div class="item"><span class="old" title="${safeHtml(f.name)}">${safeHtml(f.name)}</span><span class="group-tag" style="margin:0;">${safeHtml(ext)}</span><button class="btn small remove-item" type="button" data-remove="${i}" aria-label="Quitar ${safeHtml(f.name)}">Quitar</button></div>`;
  });
  list.innerHTML = html;
  btn.disabled = appBusy;
  attachRemoveButtons(list, heicFiles, renderHeic);
}

setupDrop('drop-heic','file-heic', files=>{
  const validas = ['png','jpg','jpeg','gif','bmp','tif','tiff','heic','heif','webp'];
  heicFiles = appendUniqueFiles(heicFiles, files.filter(f=> validas.includes(extLower(f.name))));
  renderHeic();
});

document.getElementById('h-limpiar').addEventListener('click', ()=>{
  heicFiles = [];
  document.getElementById('file-heic').value = '';
  document.getElementById('h-status').textContent = '';
  renderHeic();
});

document.getElementById('h-convertir').addEventListener('click', async event=>{
  const status = document.getElementById('h-status');
  await runAction(event.currentTarget, status, async ()=>{
  setProgress('h', 0);
  const formato = document.getElementById('h-formato').value;
  const calidad = (parseInt(document.getElementById('h-calidad').value)||95)/100;
  const extNueva = '.'+formato;
  const fallidos = [];
  const items = [];

  for(let i=0;i<heicFiles.length;i++){
    await yieldToBrowser();
    const f = heicFiles[i];
    status.textContent = `Convirtiendo ${i+1} de ${heicFiles.length}: ${f.name}...`;
    setProgress('h', (i/heicFiles.length)*90);
    try{
      const canvas = await decodeToCanvas(f);
      const blob = await canvasToBlob(canvas, formato, calidad);
      const nombreNuevo = f.name.replace(/\.[^.]+$/, extNueva);
      items.push({ blob, nombre: nombreNuevo });
    }catch(err){
      fallidos.push({nombre: f.name, error: (err && err.message) ? err.message : String(err)});
    }
  }

  status.textContent = items.length>1 ? `Empaquetando ${items.length} archivos...` : 'Descargando...';
  await descargarLote(items, 'convertidos.zip', status, 'h');

  const exitosos = items.length;
  if(fallidos.length===0){
    status.textContent = `Listo, ${exitosos} archivos convertidos.`;
  } else {
    status.textContent = `Convertidos: ${exitosos}. Fallaron ${fallidos.length}. Primer error: ${fallidos[0].error}. Archivos: ${fallidos.map(x=>x.nombre).join(', ')}`;
  }
  setTimeout(()=>setProgress('h', null), 1200);
  });
});

/* ---------- COMPRIMIR ---------- */
let compFiles = [];

function tamanoLegible(bytes){
  if(bytes < 1024) return bytes+' B';
  if(bytes < 1024*1024) return (bytes/1024).toFixed(1)+' KB';
  return (bytes/(1024*1024)).toFixed(2)+' MB';
}

function renderComp(){
  const list = document.getElementById('c-list');
  const btn = document.getElementById('c-comprimir');
  if(compFiles.length===0){
    list.innerHTML = '<div class="empty">Todavía no hay archivos cargados.</div>';
    btn.disabled = true;
    return;
  }
  let html='';
  compFiles.forEach((f,i)=>{
    html += `<div class="item"><span class="old" title="${safeHtml(f.name)}">${safeHtml(f.name)}</span><span style="color:var(--text-secondary);font-size:12px;">${tamanoLegible(f.size)}</span><button class="btn small remove-item" type="button" data-remove="${i}" aria-label="Quitar ${safeHtml(f.name)}">Quitar</button></div>`;
  });
  list.innerHTML = html;
  btn.disabled = appBusy;
  attachRemoveButtons(list, compFiles, renderComp);
}

setupDrop('drop-comp','file-comp', files=>{
  compFiles = appendUniqueFiles(compFiles, files);
  renderComp();
});

document.getElementById('c-limpiar').addEventListener('click', ()=>{
  compFiles = [];
  document.getElementById('file-comp').value = '';
  document.getElementById('c-status').textContent = '';
  renderComp();
});

document.getElementById('c-comprimir').addEventListener('click', async event=>{
  const status = document.getElementById('c-status');
  await runAction(event.currentTarget, status, async ()=>{
  setProgress('c', 0);
  const anchoMaxRaw = document.getElementById('c-ancho').value;
  const anchoMax = anchoMaxRaw ? parseInt(anchoMaxRaw) : null;
  const calidad = (parseInt(document.getElementById('c-calidad').value)||80)/100;
  const formato = document.getElementById('c-formato').value;
  const fallidos = [];
  const items = [];
  let pesoOriginal = 0, pesoNuevo = 0;

  for(let i=0;i<compFiles.length;i++){
    await yieldToBrowser();
    const f = compFiles[i];
    status.textContent = `Comprimiendo ${i+1} de ${compFiles.length}: ${f.name}...`;
    setProgress('c', (i/compFiles.length)*90);
    try{
      let canvas = await decodeToCanvas(f);
      if(anchoMax && canvas.width > anchoMax){
        const ratio = anchoMax/canvas.width;
        const nuevo = document.createElement('canvas');
        nuevo.width = anchoMax;
        nuevo.height = Math.round(canvas.height*ratio);
        nuevo.getContext('2d').drawImage(canvas,0,0,nuevo.width,nuevo.height);
        canvas = nuevo;
      }
      const blob = await canvasToBlob(canvas, formato, calidad);
      pesoOriginal += f.size;
      pesoNuevo += blob.size;
      const nombreNuevo = f.name.replace(/\.[^.]+$/, '') + '_comp.' + formato;
      items.push({ blob, nombre: nombreNuevo });
    }catch(err){
      fallidos.push({nombre: f.name, error: (err && err.message) ? err.message : String(err)});
    }
  }

  status.textContent = items.length>1 ? `Empaquetando ${items.length} archivos...` : 'Descargando...';
  await descargarLote(items, 'comprimidos.zip', status, 'c');

  const exitosos = items.length;
  if(fallidos.length===0){
    const ahorro = pesoOriginal>0 ? Math.round((1-pesoNuevo/pesoOriginal)*100) : 0;
    status.textContent = `Listo, ${exitosos} archivos comprimidos. Peso: ${tamanoLegible(pesoOriginal)} -> ${tamanoLegible(pesoNuevo)} (${ahorro}% menos).`;
  } else {
    status.textContent = `Comprimidos: ${exitosos}. Fallaron ${fallidos.length}: ` + fallidos.map(x=>x.nombre).join(', ');
  }
  setTimeout(()=>setProgress('c', null), 1200);
  });
});

/* ---------- UNIR PDFS EXISTENTES ---------- */
let pdfMergeFiles = [];

function renderUnirList(){
  const list = document.getElementById('u-list');
  const btn = document.getElementById('u-unir');
  if(pdfMergeFiles.length===0){
    list.innerHTML = '<div class="empty">Todavía no hay PDFs cargados.</div>';
    btn.disabled = true;
    return;
  }
  let html='';
  pdfMergeFiles.forEach((f,i)=>{
    html += `<div class="item" data-idx="${i}" style="cursor:grab;"><span style="color:var(--text-secondary);font-size:12px;min-width:18px;">${i+1}.</span><span class="old" title="${safeHtml(f.name)}">${safeHtml(f.name)}</span><button class="btn small remove-item" type="button" data-remove="${i}" aria-label="Quitar ${safeHtml(f.name)}">Quitar</button></div>`;
  });
  list.innerHTML = html;
  btn.disabled = appBusy;
  enableDragReorder(list, pdfMergeFiles, renderUnirList);
  attachRemoveButtons(list, pdfMergeFiles, renderUnirList);
}

setupDrop('drop-unirpdf','file-unirpdf', files=>{
  const nuevos = files.filter(f=> f.type==='application/pdf' || /\.pdf$/i.test(f.name));
  pdfMergeFiles = appendUniqueFiles(pdfMergeFiles, nuevos);
  renderUnirList();
});

document.getElementById('u-limpiar').addEventListener('click', ()=>{
  pdfMergeFiles = [];
  document.getElementById('file-unirpdf').value = '';
  document.getElementById('u-status').textContent = '';
  renderUnirList();
});

document.getElementById('u-unir').addEventListener('click', async event=>{
  const status = document.getElementById('u-status');
  await runAction(event.currentTarget, status, async ()=>{
  setProgress('u', 0);
  let nombreSalida = document.getElementById('u-nombre').value || 'unido.pdf';
  if(!/\.pdf$/i.test(nombreSalida)) nombreSalida += '.pdf';

  try{
    const { PDFDocument } = PDFLib;
    const mergedPdf = await PDFDocument.create();
    for(let i=0;i<pdfMergeFiles.length;i++){
      await yieldToBrowser();
      status.textContent = `Procesando ${i+1} de ${pdfMergeFiles.length}: ${pdfMergeFiles[i].name}...`;
      setProgress('u', (i/pdfMergeFiles.length)*90);
      const bytes = await pdfMergeFiles[i].arrayBuffer();
      const donorPdf = await PDFDocument.load(bytes);
      const pages = await mergedPdf.copyPages(donorPdf, donorPdf.getPageIndices());
      pages.forEach(p=>mergedPdf.addPage(p));
    }
    const mergedBytes = await mergedPdf.save();
    const blob = new Blob([mergedBytes], {type:'application/pdf'});
    download(blob, nombreSalida);
    setProgress('u', 100);
    status.textContent = 'Listo! PDF combinado descargado.';
  }catch(err){
    status.textContent = 'Error al unir: ' + ((err && err.message) ? err.message : String(err));
  }
  setTimeout(()=>setProgress('u', null), 1200);
  });
});

/* ---------- APLANAR PDF ---------- */
let aplanarFiles = [];

function renderAplanar(){
  const list = document.getElementById('ap-list');
  const btn = document.getElementById('ap-aplanar');
  if(aplanarFiles.length===0){
    list.innerHTML = '<div class="empty">Todavía no hay PDFs cargados.</div>';
    btn.disabled = true;
    return;
  }
  let html='';
  aplanarFiles.forEach((f,i)=>{
    html += `<div class="item" data-idx="${i}" style="cursor:grab;"><span style="color:var(--text-secondary);font-size:12px;min-width:18px;">${i+1}.</span><span class="old" title="${safeHtml(f.name)}">${safeHtml(f.name)}</span><button class="btn small remove-item" type="button" data-remove="${i}" aria-label="Quitar ${safeHtml(f.name)}">Quitar</button></div>`;
  });
  list.innerHTML = html;
  btn.disabled = appBusy;
  enableDragReorder(list, aplanarFiles, renderAplanar);
  attachRemoveButtons(list, aplanarFiles, renderAplanar);
}

setupDrop('drop-aplanar','file-aplanar', files=>{
  const nuevos = files.filter(f=> f.type==='application/pdf' || /\.pdf$/i.test(f.name));
  aplanarFiles = appendUniqueFiles(aplanarFiles, nuevos);
  renderAplanar();
});

document.getElementById('ap-limpiar').addEventListener('click', ()=>{
  aplanarFiles = [];
  document.getElementById('file-aplanar').value = '';
  document.getElementById('ap-status').textContent = '';
  renderAplanar();
});

document.getElementById('ap-aplanar').addEventListener('click', async event=>{
  const status = document.getElementById('ap-status');
  await runAction(event.currentTarget, status, async ()=>{
  setProgress('ap', 0);
  const { PDFDocument } = PDFLib;
  const items = [];
  const fallidos = [];
  let sinFormulario = 0;

  for(let i=0;i<aplanarFiles.length;i++){
    await yieldToBrowser();
    const f = aplanarFiles[i];
    status.textContent = `Aplanando ${i+1} de ${aplanarFiles.length}: ${f.name}...`;
    setProgress('ap', (i/aplanarFiles.length)*90);
    try{
      const bytes = await f.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      try{
        const form = pdfDoc.getForm();
        const campos = form.getFields();
        if(campos.length > 0){
          form.flatten();
        } else {
          sinFormulario++;
        }
      }catch(errForm){
        sinFormulario++;
      }
      const nuevoBytes = await pdfDoc.save();
      const blob = new Blob([nuevoBytes], {type:'application/pdf'});
      const nombreNuevo = f.name.replace(/\.pdf$/i, '') + '_aplanado.pdf';
      items.push({ blob, nombre: nombreNuevo });
    }catch(err){
      fallidos.push({ nombre: f.name, error: (err && err.message) ? err.message : String(err) });
    }
  }

  status.textContent = items.length>1 ? `Empaquetando ${items.length} archivos...` : 'Descargando...';
  await descargarLote(items, 'aplanados.zip', status, 'ap');

  let mensaje = `Listo, ${items.length} archivo(s) procesado(s).`;
  if(sinFormulario>0) mensaje += ` (${sinFormulario} no tenían campos de formulario, se descargaron sin cambios).`;
  if(fallidos.length>0) mensaje += ` Fallaron ${fallidos.length}: ` + fallidos.map(x=>x.nombre).join(', ');
  status.textContent = mensaje;
  setTimeout(()=>setProgress('ap', null), 1200);
  });
});

/* ---------- SEPARAR PDF ---------- */
let separarFile = null;

function renderSeparar(){
  const list = document.getElementById('s-list');
  const btn = document.getElementById('s-separar');
  if(!separarFile){
    list.innerHTML = '<div class="empty">Todavía no hay PDF cargado.</div>';
    btn.disabled = true;
    return;
  }
  list.innerHTML = `<div class="item"><span class="old" title="${safeHtml(separarFile.name)}">${safeHtml(separarFile.name)}</span><button class="btn small remove-item" type="button" id="s-remove">Quitar</button></div>`;
  btn.disabled = appBusy;
  document.getElementById('s-remove').addEventListener('click', ()=>document.getElementById('s-limpiar').click());
}

setupDrop('drop-separar','file-separar', files=>{
  const pdfs = files.filter(f=> f.type==='application/pdf' || /\.pdf$/i.test(f.name));
  separarFile = pdfs.length>0 ? pdfs[0] : null;
  renderSeparar();
});

document.getElementById('s-limpiar').addEventListener('click', ()=>{
  separarFile = null;
  document.getElementById('file-separar').value = '';
  document.getElementById('s-status').textContent = '';
  renderSeparar();
});

document.getElementById('s-separar').addEventListener('click', async event=>{
  const status = document.getElementById('s-status');
  if(!separarFile) return;
  await runAction(event.currentTarget, status, async ()=>{
  setProgress('s', 0);
  const { PDFDocument } = PDFLib;
  const prefijo = document.getElementById('s-prefijo').value || 'parte_';
  const porGrupo = Math.max(1, parseInt(document.getElementById('s-porgrupo').value)||8);
  const inicio = parseInt(document.getElementById('s-inicio').value)||0;
  const digitos = parseInt(document.getElementById('s-digitos').value)||2;

  try{
    status.textContent = 'Leyendo el PDF...';
    const bytes = await separarFile.arrayBuffer();
    const sourcePdf = await PDFDocument.load(bytes);
    const totalPaginas = sourcePdf.getPageCount();
    const totalGrupos = Math.ceil(totalPaginas / porGrupo);
    const items = [];
    let n = inicio;

    for(let i=0;i<totalPaginas;i+=porGrupo){
      await yieldToBrowser();
      const gi = Math.floor(i/porGrupo)+1;
      status.textContent = `Generando PDF ${gi} de ${totalGrupos}...`;
      setProgress('s', ((gi-1)/totalGrupos)*90);
      const indices = [];
      for(let p=i; p<Math.min(i+porGrupo, totalPaginas); p++) indices.push(p);

      const nuevoPdf = await PDFDocument.create();
      const paginasCopiadas = await nuevoPdf.copyPages(sourcePdf, indices);
      paginasCopiadas.forEach(p=>nuevoPdf.addPage(p));
      const nuevoBytes = await nuevoPdf.save();
      const blob = new Blob([nuevoBytes], {type:'application/pdf'});
      const numTxt = String(n).padStart(digitos,'0');
      items.push({ blob, nombre: `${prefijo}${numTxt}.pdf` });
      n++;
    }

    status.textContent = items.length>1 ? `Empaquetando ${items.length} PDFs...` : 'Descargando...';
    await descargarLote(items, 'separados.zip', status, 's');
    status.textContent = `Listo, se generaron ${totalGrupos} PDFs a partir de ${totalPaginas} páginas.`;
  }catch(err){
    status.textContent = 'Error al separar: ' + ((err && err.message) ? err.message : String(err));
  }
  setTimeout(()=>setProgress('s', null), 1200);
  });
});

/* ---------- QUITAR FONDO ---------- */
let fondoFiles = [];

const ETIQUETAS_ESTADO_FONDO = {
  pendiente: { texto: 'Pendiente', color: 'var(--text-secondary)' },
  procesando: { texto: 'Procesando...', color: '#7dabff' },
  recortando: { texto: 'Recortando...', color: '#7dabff' },
  listo: { texto: 'Listo', color: '#22c55e' },
  error: { texto: 'Error', color: 'var(--danger)' }
};

function renderFondo(){
  const list = document.getElementById('f-list');
  const btn = document.getElementById('f-quitar');
  if(fondoFiles.length===0){
    list.innerHTML = '<div class="empty">Todavía no hay archivos cargados.</div>';
    btn.disabled = true;
    return;
  }
  let html='';
  fondoFiles.forEach((f,i)=>{
    const estado = ETIQUETAS_ESTADO_FONDO[f._estado || 'pendiente'];
    const pct = f._pct || 0;
    html += `<div class="item">${f._url?`<img src="${f._url}" alt="">`:''}<span class="old" title="${safeHtml(f.name)}">${safeHtml(f.name)}</span><div class="mini-progress-wrap"><div class="mini-progress-fill" style="width:${pct}%;"></div></div><span style="font-size:12px;font-weight:600;color:${estado.color};white-space:nowrap;">${estado.texto}</span><button class="btn small remove-item" type="button" data-remove="${i}" aria-label="Quitar ${safeHtml(f.name)}">Quitar</button></div>`;
  });
  list.innerHTML = html;
  btn.disabled = appBusy;
  attachRemoveButtons(list, fondoFiles, renderFondo, true);
}

let fondoRenderProgramado = false;
function programarRenderFondo(){
  if(fondoRenderProgramado) return;
  fondoRenderProgramado = true;
  requestAnimationFrame(()=>{
    fondoRenderProgramado = false;
    renderFondo();
  });
}

setupDrop('drop-fondo','file-fondo', files=>{
  const imágenes = files.filter(f=> f.type && f.type.startsWith('image/'));
  const nuevos = appendUniqueFiles(fondoFiles, imágenes).slice(fondoFiles.length);
  nuevos.forEach(f=>{ f._url = URL.createObjectURL(f); f._estado = 'pendiente'; });
  fondoFiles = fondoFiles.concat(nuevos);
  renderFondo();
});

document.getElementById('f-limpiar').addEventListener('click', ()=>{
  fondoFiles.forEach(f=>{ if(f._url) URL.revokeObjectURL(f._url); });
  fondoFiles = [];
  document.getElementById('file-fondo').value = '';
  document.getElementById('f-status').textContent = '';
  renderFondo();
});

document.getElementById('f-quitar').addEventListener('click', async event=>{
  const status = document.getElementById('f-status');
  await runAction(event.currentTarget, status, async ()=>{
  setProgress('f', 0);

  if (typeof window.removeBackground !== 'function'){
    status.textContent = 'La librería todavía está cargando, espera unos segundos e intenta de nuevo.';
    setProgress('f', null);
    return;
  }

  const items = [];
  const fallidos = [];
  const recortarActivo = document.getElementById('f-recortar').checked;
  const padding = parseInt(document.getElementById('f-padding').value) || 0;
  const modeloCalidad = document.getElementById('f-calidad-modelo').value;

  fondoFiles.forEach(f=>{ f._estado = 'pendiente'; f._pct = 0; });
  renderFondo();

  for(let i=0;i<fondoFiles.length;i++){
    await yieldToBrowser();
    const f = fondoFiles[i];
    const baseProgress = (i/fondoFiles.length)*90;
    f._estado = 'procesando';
    f._pct = 0;
    renderFondo();
    status.textContent = `Procesando ${i+1} de ${fondoFiles.length}: ${f.name} (la primera vez descarga el modelo de IA, puede tardar)...`;
    setProgress('f', baseProgress);
    try{
      let blob = await window.removeBackground(f, {
        model: modeloCalidad,
        progress: (key, current, total) => {
          status.textContent = `${f.name}: ${key} (${current}/${total})`;
          if(total>0){
            const pasoActual = baseProgress + (current/total)*(80/fondoFiles.length);
            setProgress('f', pasoActual);
            f._pct = recortarActivo ? Math.round((current/total)*80) : Math.round((current/total)*100);
            programarRenderFondo();
          }
        }
      });
      if(recortarActivo){
        f._estado = 'recortando';
        f._pct = 85;
        renderFondo();
        status.textContent = `Recortando espacio transparente: ${f.name}...`;
        blob = await trimTransparentPixels(blob, { alphaThreshold: 10, padding });
      }
      const nombreNuevo = f.name.replace(/\.[^.]+$/, '') + '_sinfondo.png';
      items.push({ blob, nombre: nombreNuevo });
      f._estado = 'listo';
      f._pct = 100;
    }catch(err){
      fallidos.push({ nombre: f.name, error: (err && err.message) ? err.message : String(err) });
      f._estado = 'error';
    }
    renderFondo();
  }

  status.textContent = items.length>1 ? `Empaquetando ${items.length} archivos...` : 'Descargando...';
  await descargarLote(items, 'sin_fondo.zip', status, 'f');

  const exitosos = items.length;
  if(fallidos.length===0){
    status.textContent = `Listo, ${exitosos} imagen(es) procesada(s).`;
  } else {
    status.textContent = `Procesadas: ${exitosos}. Fallaron ${fallidos.length}: ` + fallidos.map(x=>x.nombre).join(', ');
  }
  setTimeout(()=>setProgress('f', null), 1200);
  });
});

/* ---------- ESCANEAR DOCUMENTO (detección de bordes con OpenCV.js) ---------- */
let escanearFiles = [];

window.cvReady = false;
const _cvCheckInterval = setInterval(()=>{
  if(typeof cv !== 'undefined' && cv.Mat){
    window.cvReady = true;
    clearInterval(_cvCheckInterval);
  }
}, 300);

const ETIQUETAS_ESTADO_ESCANEAR = {
  pendiente: { texto: 'Pendiente', color: 'var(--text-secondary)' },
  procesando: { texto: 'Detectando bordes...', color: '#7dabff' },
  listo: { texto: 'Escaneado', color: '#22c55e' },
  sinbordes: { texto: 'Sin bordes detectados (original)', color: '#fbbf24' },
  error: { texto: 'Error', color: 'var(--danger)' }
};

function renderEscanear(){
  const list = document.getElementById('e-list');
  const btn = document.getElementById('e-escanear');
  if(escanearFiles.length===0){
    list.innerHTML = '<div class="empty">Todavía no hay archivos cargados.</div>';
    btn.disabled = true;
    return;
  }
  let html='';
  escanearFiles.forEach((f,i)=>{
    const estado = ETIQUETAS_ESTADO_ESCANEAR[f._estado || 'pendiente'];
    html += `<div class="item">${f._url?`<img src="${f._url}" alt="">`:''}<span class="old" title="${safeHtml(f.name)}">${safeHtml(f.name)}</span><span style="font-size:12px;font-weight:600;color:${estado.color};white-space:nowrap;">${estado.texto}</span><button class="btn small remove-item" type="button" data-remove="${i}" aria-label="Quitar ${safeHtml(f.name)}">Quitar</button></div>`;
  });
  list.innerHTML = html;
  btn.disabled = appBusy;
  attachRemoveButtons(list, escanearFiles, renderEscanear, true);
}

setupDrop('drop-escanear','file-escanear', files=>{
  const imágenes = files.filter(f=> f.type && f.type.startsWith('image/'));
  const nuevos = appendUniqueFiles(escanearFiles, imágenes).slice(escanearFiles.length);
  nuevos.forEach(f=>{ f._url = URL.createObjectURL(f); f._estado = 'pendiente'; });
  escanearFiles = escanearFiles.concat(nuevos);
  renderEscanear();
});

document.getElementById('e-limpiar').addEventListener('click', ()=>{
  escanearFiles.forEach(f=>{ if(f._url) URL.revokeObjectURL(f._url); });
  escanearFiles = [];
  document.getElementById('file-escanear').value = '';
  document.getElementById('e-status').textContent = '';
  renderEscanear();
});

function ordenarPuntosDocumento(pts){
  const suma = pts.map(p => p.x + p.y);
  const resta = pts.map(p => p.x - p.y);
  const tl = pts[suma.indexOf(Math.min(...suma))];
  const br = pts[suma.indexOf(Math.max(...suma))];
  const tr = pts[resta.indexOf(Math.max(...resta))];
  const bl = pts[resta.indexOf(Math.min(...resta))];
  return { tl, tr, br, bl };
}

function puntosDeRectanguloRotado(rect){
  const anguloRad = rect.angle * Math.PI / 180;
  const cos = Math.cos(anguloRad);
  const sin = Math.sin(anguloRad);
  const w = rect.size.width / 2;
  const h = rect.size.height / 2;
  const cx = rect.center.x;
  const cy = rect.center.y;
  const esquinasLocales = [ {x:-w,y:-h}, {x:w,y:-h}, {x:w,y:h}, {x:-w,y:h} ];
  return esquinasLocales.map(p => ({
    x: cx + p.x*cos - p.y*sin,
    y: cy + p.x*sin + p.y*cos
  }));
}

async function detectarYEnderezarDocumento(file){
  const { img, url } = await blobToImageEl(file);
  const src = cv.imread(img);
  URL.revokeObjectURL(url);

  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edged = new cv.Mat();
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  let resultado = null;

  try{
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5,5), 0);
    cv.Canny(blurred, edged, 75, 200);
    cv.dilate(edged, edged, kernel);
    cv.findContours(edged, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const areaImagen = src.cols * src.rows;
    let mejorArea = 0;
    let mejorPuntos = null;

    for(let i=0; i<contours.size(); i++){
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if(area < areaImagen * 0.08){ cnt.delete(); continue; }

      let puntosCandidatos = null;

      // Intento 1: forma con exactamente 4 esquinas (documentos con esquinas rectas)
      const peri = cv.arcLength(cnt, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.02*peri, true);
      if(approx.rows === 4){
        const pts = [];
        for(let k=0;k<4;k++) pts.push({ x: approx.data32S[k*2], y: approx.data32S[k*2+1] });
        puntosCandidatos = pts;
      }
      approx.delete();

      // Intento 2 (respaldo): rectangulo de area minima, tolera esquinas redondeadas
      if(!puntosCandidatos){
        const rect = cv.minAreaRect(cnt);
        puntosCandidatos = puntosDeRectanguloRotado(rect);
      }

      if(puntosCandidatos && area > mejorArea){
        mejorArea = area;
        mejorPuntos = puntosCandidatos;
      }
      cnt.delete();
    }

    if(mejorPuntos){
      const { tl, tr, br, bl } = ordenarPuntosDocumento(mejorPuntos);

      const anchoA = Math.hypot(br.x-bl.x, br.y-bl.y);
      const anchoB = Math.hypot(tr.x-tl.x, tr.y-tl.y);
      const anchoMax = Math.round(Math.max(anchoA, anchoB));

      const altoA = Math.hypot(tr.x-br.x, tr.y-br.y);
      const altoB = Math.hypot(tl.x-bl.x, tl.y-bl.y);
      const altoMax = Math.round(Math.max(altoA, altoB));

      if(anchoMax > 10 && altoMax > 10){
        const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x,tl.y, tr.x,tr.y, br.x,br.y, bl.x,bl.y]);
        const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0,0, anchoMax,0, anchoMax,altoMax, 0,altoMax]);
        const M = cv.getPerspectiveTransform(srcTri, dstTri);
        const dst = new cv.Mat();
        cv.warpPerspective(src, dst, M, new cv.Size(anchoMax, altoMax), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

        const outCanvas = document.createElement('canvas');
        cv.imshow(outCanvas, dst);
        resultado = outCanvas;

        srcTri.delete(); dstTri.delete(); M.delete(); dst.delete();
      }
    }
  } finally {
    src.delete(); gray.delete(); blurred.delete(); edged.delete(); kernel.delete();
    contours.delete(); hierarchy.delete();
  }

  return resultado;
}

document.getElementById('e-escanear').addEventListener('click', async event=>{
  const status = document.getElementById('e-status');
  await runAction(event.currentTarget, status, async ()=>{
  setProgress('e', 0);

  status.textContent = 'Cargando motor de visión (unos segundos la primera vez)...';
  let intentos = 0;
  while(!window.cvReady && intentos < 200){
    await new Promise(r=>setTimeout(r,150));
    intentos++;
  }
  if(!window.cvReady){
    status.textContent = 'No se pudo cargar el motor de visión. Revisa tu conexión e intenta de nuevo.';
    setProgress('e', null);
    return;
  }

  const formato = document.getElementById('e-formato').value;
  const calidad = (parseInt(document.getElementById('e-calidad').value)||92)/100;
  const items = [];
  const fallidos = [];

  escanearFiles.forEach(f=>{ f._estado = 'pendiente'; });
  renderEscanear();

  for(let i=0;i<escanearFiles.length;i++){
    await yieldToBrowser();
    const f = escanearFiles[i];
    f._estado = 'procesando';
    renderEscanear();
    status.textContent = `Detectando bordes ${i+1} de ${escanearFiles.length}: ${f.name}...`;
    setProgress('e', (i/escanearFiles.length)*95);
    try{
      const canvasResultado = await detectarYEnderezarDocumento(f);
      const extNueva = '.'+formato;
      const nombreNuevo = f.name.replace(/\.[^.]+$/, '') + '_escaneado' + extNueva;
      if(canvasResultado){
        const mime = formato==='png' ? 'image/png' : 'image/jpeg';
        const blob = await canvasToBlob(canvasResultado, formato, calidad);
        items.push({ blob, nombre: nombreNuevo });
        f._estado = 'listo';
      } else {
        items.push({ blob: f, nombre: f.name.replace(/\.[^.]+$/, '') + '_original' + extOf(f.name) });
        f._estado = 'sinbordes';
      }
    }catch(err){
      fallidos.push({ nombre: f.name, error: (err && err.message) ? err.message : String(err) });
      f._estado = 'error';
    }
    renderEscanear();
  }

  status.textContent = items.length>1 ? `Empaquetando ${items.length} archivos...` : 'Descargando...';
  await descargarLote(items, 'escaneados.zip', status, 'e');

  const exitosos = items.length;
  if(fallidos.length===0){
    status.textContent = `Listo, ${exitosos} archivo(s) procesado(s).`;
  } else {
    status.textContent = `Procesados: ${exitosos}. Fallaron ${fallidos.length}: ` + fallidos.map(x=>x.nombre).join(', ');
  }
  setTimeout(()=>setProgress('e', null), 1200);
  });
});
