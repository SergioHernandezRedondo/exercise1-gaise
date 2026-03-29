#!/usr/bin/env bash
set -euo pipefail
ENGINE=lightpanda
START_URL='https://inmobiliariaiparralde.com/'
SEARCH_PATH='https://inmobiliariaiparralde.com/inmuebles/listado_de_inmuebles'
OUTPUT_FILE='/tmp/inmo_results.json'

function extract_items() {
  agent-browser --engine "$ENGINE" eval "(function(){
    var rows = Array.from(document.querySelectorAll('.property-list-list')).map(el=>{
      var info=el.querySelector('.property-list-list-info');
      var link=info ? info.querySelector('a[href*=\"/inmuebles/inmueble_detalles/\"]') : null;
      var title=link ? link.querySelector('h3')?.innerText.trim() : '';
      var detail_url=link ? link.href : '';
      var paragraphs = info ? Array.from(info.querySelectorAll('p')).map(p => p.innerText.trim()).filter(Boolean) : [];
      var location = paragraphs[0] || '';
      var reference = paragraphs[1] || '';
      var description = paragraphs[2] || '';
      var price = paragraphs[3] || '';
      var scrape_ts = new Date().toISOString();
      var stable_id = detail_url.replace(/\/?$/,'').split('/').pop() || '';
      return { title, price, location, detail_url, scrape_ts, stable_id };
    });
    return rows;
  })()"
}

# Navigate and set filters
agent-browser --engine "$ENGINE" open "$START_URL"
agent-browser --engine "$ENGINE" wait --load networkidle
agent-browser --engine "$ENGINE" eval "(function(){
  var tipo=document.querySelector('select[name=\"tipoInmueble[]\"]');
  var muni=document.querySelector('select[name=\"municipio[]\"]');
  if(tipo){ Array.from(tipo.options).forEach(o=>o.selected=o.value==='piso'); tipo.dispatchEvent(new Event('change',{bubbles:true})); }
  if(muni){ Array.from(muni.options).forEach(o=>o.selected=o.value==='Hendaye'); muni.dispatchEvent(new Event('change',{bubbles:true})); }
  return true;
})()"
agent-browser --engine "$ENGINE" click "section.property-query-area form.findus button[type=submit]"
agent-browser --engine "$ENGINE" wait --load networkidle

# Collect pages
page_rels=$(agent-browser --engine "$ENGINE" eval "Array.from(document.querySelectorAll('a.page.racargar_funcion_megusta')).map(a=>a.getAttribute('rel')).join(',')")
page_rels=${page_rels//\"/}
page_rels=${page_rels//,/ }

# Scrape each page
echo "[]" > "$OUTPUT_FILE"
for rel in $page_rels; do
  if [ -z "$rel" ]; then continue; fi
  agent-browser --engine "$ENGINE" click "a.page.racargar_funcion_megusta[rel='${rel}']"
  agent-browser --engine "$ENGINE" wait --load networkidle
  sleep 1
  items_json=$(extract_items)
  if [ "${items_json}" = "[]" ]; then
    continue
  fi
  # merge into output using jq if available, else with python
  if command -v jq >/dev/null 2>&1; then
    jq -s 'add' <(cat "$OUTPUT_FILE") <(echo "$items_json") > "$OUTPUT_FILE.tmp" && mv "$OUTPUT_FILE.tmp" "$OUTPUT_FILE"
  else
    python3 - <<PY
import json, pathlib
out=pathlib.Path('$OUTPUT_FILE')
old=json.loads(out.read_text())
new=json.loads('''$items_json''')
out.write_text(json.dumps(old+new, ensure_ascii=False, indent=2))
PY
  fi
done

cat "$OUTPUT_FILE"
