let CONCEPTS=null, GUIDE=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const norm=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const escapeHTML=s=>(s??'').toString().replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const refList=s=>(s||'').split(',').map(x=>x.trim()).filter(Boolean);

function setView(view){
  $$('.view-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $$('.view').forEach(p=>p.classList.toggle('active',p.dataset.viewPanel===view));
  history.replaceState(null,'',`#${view}`);
  window.scrollTo({top:document.querySelector('.view-nav').offsetTop,behavior:'smooth'});
}

function conceptCard(c){
  return `<details class="concept" data-search="${escapeHTML(norm(c.search))}" data-tag="${escapeHTML(c.tag)}">
    <summary><span class="term">${escapeHTML(c.term)}</span><span class="tag">${escapeHTML(c.tag)}</span></summary>
    <div class="concept-body">
      <div class="field"><div class="label">Qué significa</div><p>${escapeHTML(c.definition)}</p></div>
      ${c.example?`<div class="field"><div class="label">Ejemplo</div><p>${escapeHTML(c.example)}</p></div>`:''}
      ${c.note?`<div class="field"><div class="label">Nota profesional</div><p>${escapeHTML(c.note)}</p></div>`:''}
      ${c.refs?`<div class="refs">Evidencia relacionada: ${escapeHTML(c.refs)}</div>`:''}
    </div>
  </details>`;
}

function renderConcepts(){
  const groups={}; CONCEPTS.concepts.forEach(c=>(groups[c.section]??=[]).push(c));
  $('#conceptSections').innerHTML=Object.entries(groups).map(([n,cs])=>`<details class="section concept-section">
    <summary class="section-summary"><span class="section-no">${n}</span><span class="section-title">${escapeHTML(cs[0].section_title)}</span><span class="section-count">${cs.length} conceptos</span></summary>
    <div class="section-content">${cs.map(conceptCard).join('')}</div>
  </details>`).join('');
  const tags=[...new Set(CONCEPTS.concepts.map(c=>c.tag))].sort();
  $('#tagFilter').innerHTML='<option value="">Todas las etiquetas</option>'+tags.map(t=>`<option>${escapeHTML(t)}</option>`).join('');
  $('#principles').innerHTML=CONCEPTS.principles.map(p=>`<article class="principle"><b>${p.number}. ${escapeHTML(p.title)}</b><p>${escapeHTML(p.text)}</p></article>`).join('');
  $('#conceptCount').textContent=CONCEPTS.concepts.length;
  filterConcepts();
}

function evidenceClass(s){const n=norm(s);if(n.includes('directa'))return 'direct';if(n.includes('general')||n.includes('review')||n.includes('meta'))return 'general';return 'indirect';}
function refLinks(ids){return refList(ids).map(id=>{const r=GUIDE.references.find(x=>x.id===id);return r?`<a href="${escapeHTML(r.url)}" target="_blank" rel="noopener">${escapeHTML(id)}</a>`:escapeHTML(id)}).join(' · ')}

function exerciseCard(e){
  const evc=evidenceClass(e.evidence);
  const search=norm([e.name,e.tier,e.target,e.why,e.execution,e.reps,e.rir,e.evidence,e.pro_tip,e.avoid].join(' '));
  return `<details class="exercise-card" data-tier="${escapeHTML(e.tier)}" data-evidence="${evc}" data-search="${escapeHTML(search)}">
    <summary>
      <div class="exercise-summary-main"><span class="tier tier-${escapeHTML(e.tier.toLowerCase())}">${escapeHTML(e.tier)}</span><span class="exercise-name">${escapeHTML(e.name)}</span></div>
      <div class="exercise-summary-meta"><span>${escapeHTML(e.reps)} reps</span><span>${escapeHTML(e.rir)} RIR</span></div>
    </summary>
    <div class="exercise-body">
      <div class="exercise-grid">
        <div class="exercise-field wide"><span>Objetivo</span><p>${escapeHTML(e.target)}</p></div>
        <div class="exercise-field wide"><span>Por qué está aquí</span><p>${escapeHTML(e.why)}</p></div>
        <div class="exercise-field wide"><span>Ejecución</span><p>${escapeHTML(e.execution)}</p></div>
        <div class="exercise-field"><span>Rango</span><b>${escapeHTML(e.reps)} reps</b></div>
        <div class="exercise-field"><span>Esfuerzo</span><b>${escapeHTML(e.rir)} RIR</b></div>
        <div class="exercise-field"><span>Descanso</span><b>${escapeHTML(e.rest)}</b></div>
        <div class="exercise-field"><span>Evidencia</span><b class="evidence-badge ${evc}">${escapeHTML(e.evidence)}</b></div>
      </div>
      ${e.pro_tip?`<div class="coach-note"><b>Uso profesional</b><p>${escapeHTML(e.pro_tip)}</p></div>`:''}
      ${e.avoid?`<div class="avoid-note"><b>Evita</b><p>${escapeHTML(e.avoid)}</p></div>`:''}
      <div class="exercise-refs">Fuentes: ${refLinks(e.refs)}</div>
    </div>
  </details>`;
}

function renderGuide(){
  $('#exerciseCount').textContent=GUIDE.groups.reduce((a,g)=>a+g.exercises.length,0);
  $('#muscleCount').textContent=GUIDE.groups.length;
  $('#sourceCount').textContent=GUIDE.references.length;
  $('#guideIntro').innerHTML=`
    <div class="intro-card">
      <div><div class="eyebrow">Guía definitiva · ${escapeHTML(GUIDE.meta.edition)}</div><h2>${escapeHTML(GUIDE.meta.scope)}</h2></div>
      <p>${escapeHTML(GUIDE.meta.disclaimer)}</p>
      <p class="tier-note"><b>Cómo leer los tiers:</b> ${escapeHTML(GUIDE.meta.tier_note)}</p>
    </div>`;
  $('#muscleChips').innerHTML=GUIDE.groups.map(g=>`<button class="muscle-chip" data-muscle-jump="${escapeHTML(g.slug)}">${escapeHTML(g.title)}</button>`).join('');
  $('#muscleGroups').innerHTML=GUIDE.groups.map((g,i)=>`<details class="muscle-section" id="muscle-${escapeHTML(g.slug)}" data-muscle-search="${escapeHTML(norm(g.title+' '+g.subtitle))}">
    <summary class="muscle-summary">
      <div><span class="muscle-index">${String(i+1).padStart(2,'0')}</span><span class="muscle-title">${escapeHTML(g.title)}</span></div>
      <div class="muscle-meta"><span class="priority">Prioridad: ${escapeHTML(g.priority)}</span><span>${g.exercises.length} ejercicios</span></div>
    </summary>
    <div class="muscle-content"><p class="muscle-subtitle">${escapeHTML(g.subtitle)}</p>${g.exercises.map(exerciseCard).join('')}</div>
  </details>`).join('');
  $('#eliteRules').innerHTML=GUIDE.elite_rules.map((r,i)=>`<article class="rule-card"><span>${String(i+1).padStart(2,'0')}</span><h3>${escapeHTML(r.title)}</h3><p>${escapeHTML(r.text)}</p></article>`).join('');
  const p=GUIDE.programming;
  $('#programmingSection').innerHTML=`<div class="section-heading-block"><div class="eyebrow">Sistema de uso</div><h2>${escapeHTML(p.title)}</h2></div><div class="programming-grid">${p.steps.map(s=>`<article class="program-step"><span>${s.n}</span><div><h3>${escapeHTML(s.title)}</h3><p>${escapeHTML(s.text)}</p></div></article>`).join('')}</div>`;
  $('#sourceGrid').innerHTML=GUIDE.references.map(r=>`<article class="source-card"><div class="source-top"><span class="source-id">${escapeHTML(r.id)}</span><span class="source-year">${r.year}</span></div><h3>${escapeHTML(r.title)}</h3><p class="source-type">${escapeHTML(r.type)}</p><p>${escapeHTML(r.note)}</p><a href="${escapeHTML(r.url)}" target="_blank" rel="noopener">Abrir fuente ↗</a></article>`).join('');
  filterExercises();
}

function filterConcepts(){
  const q=norm($('#conceptSearch').value.trim()),tag=$('#tagFilter').value;let total=0;
  $$('.concept-section').forEach(sec=>{let v=0;sec.querySelectorAll('.concept').forEach(c=>{const ok=(!q||c.dataset.search.includes(q))&&(!tag||c.dataset.tag===tag);c.hidden=!ok;if(ok){v++;total++;if(q)c.open=true}});sec.hidden=!v;if(q&&v)sec.open=true;});
  $('#conceptVisible').textContent=total;$('#conceptEmpty').style.display=total?'none':'block';
}

function filterExercises(){
  const q=norm($('#exerciseSearch').value.trim()),tier=$('#tierFilter').value,ev=$('#evidenceFilter').value;let total=0;
  $$('.muscle-section').forEach(sec=>{let v=0;const msearch=sec.dataset.muscleSearch||'';sec.querySelectorAll('.exercise-card').forEach(c=>{const evidenceOk=!ev||(ev==='directa'&&c.dataset.evidence==='direct')||(ev==='general'&&c.dataset.evidence==='general')||(ev==='biomecánica'&&c.dataset.evidence==='indirect');const qOk=!q||c.dataset.search.includes(q)||msearch.includes(q);const ok=qOk&&(!tier||c.dataset.tier===tier)&&evidenceOk;c.hidden=!ok;if(ok){v++;total++;if(q)c.open=true}});sec.hidden=!v;if(q&&v)sec.open=true;});
  $('#exerciseVisible').textContent=total;$('#exerciseEmpty').style.display=total?'none':'block';
}

Promise.all([
  fetch('assets/concepts.json').then(r=>r.json()),
  fetch('assets/olympia_guide.json').then(r=>r.json())
]).then(([c,g])=>{CONCEPTS=c;GUIDE=g;renderConcepts();renderGuide();
  const initial=['guide','encyclopedia','sources'].includes(location.hash.slice(1))?location.hash.slice(1):'guide';
  setView(initial);
});

$$('.view-tab').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$$('[data-view-target]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.viewTarget)));
$('#conceptSearch').addEventListener('input',filterConcepts);$('#tagFilter').addEventListener('change',filterConcepts);
$('#conceptClear').addEventListener('click',()=>{$('#conceptSearch').value='';$('#tagFilter').value='';filterConcepts();$('#conceptSearch').focus()});
$('#exerciseSearch').addEventListener('input',filterExercises);$('#tierFilter').addEventListener('change',filterExercises);$('#evidenceFilter').addEventListener('change',filterExercises);
$('#exerciseClear').addEventListener('click',()=>{$('#exerciseSearch').value='';$('#tierFilter').value='';$('#evidenceFilter').value='';filterExercises();$('#exerciseSearch').focus()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-muscle-jump]');if(!b)return;const sec=document.getElementById('muscle-'+b.dataset.muscleJump);if(sec){sec.open=true;sec.scrollIntoView({behavior:'smooth',block:'start'});}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();const active=$('.view.active');(active.id==='view-encyclopedia'?$('#conceptSearch'):$('#exerciseSearch')).focus();}});
