#!/usr/bin/env bash
set -euo pipefail
ENGINE=lightpanda
SESSION="default"
agent-browser --engine "$ENGINE" open https://inmobiliariaiparralde.com/
agent-browser --engine "$ENGINE" wait --load networkidle
agent-browser --engine "$ENGINE" eval "(function(){var t=document.querySelector('select[name=\"tipoInmueble[]\"]'); if(t){Array.from(t.options).forEach(o=>o.selected=o.value==='piso');t.dispatchEvent(new Event('change',{bubbles:true}));} var m=document.querySelector('select[name=\"municipio[]\"]'); if(m){Array.from(m.options).forEach(o=>o.selected=o.value==='Hendaye');m.dispatchEvent(new Event('change',{bubbles:true}));} return 'filters set';})()"
agent-browser --engine "$ENGINE" click "section.property-query-area form.findus button[type=submit]"
agent-browser --engine "$ENGINE" wait --load networkidle
page_rels=$(agent-browser --engine "$ENGINE" eval "Array.from(document.querySelectorAll('a.page.racargar_funcion_megusta')).map(a=>a.getAttribute('rel')).join(',')")
# normalize comma-separated list
page_rels=${page_rels//\"/}
page_rels=${page_rels//,/ }
output_file=/tmp/inmo_all.json
echo "[" > "$output_file"
first=true
for rel in $page_rels; do
  if [ -z "$rel" ]; then continue; fi
  agent-browser --engine "$ENGINE" click "a.page.racargar_funcion_megusta[rel='${rel}']"
  agent-browser --engine "$ENGINE" wait 1500
  items=$(agent-browser --engine "$ENGINE" eval "(function(){return Array.from(document.querySelectorAll('.col-inmueble')).map(item=>{var url=item.querySelector('.proerty_text h3 a')?.href||'';var title=item.querySelector('.proerty_text h3 a')?.innerText.trim()||'';var allText=item.querySelector('.proerty_text')?.innerText.trim().split('\\n').map(s=>s.trim()).filter(Boolean)||[];var location=allText[1]||'';var price=allText[allText.length-1]||'';var ts=new Date().toISOString();var stableId=url.replace(/\/?$/,'').split('/').pop()||'';return {title, price, location, detail_url:url, scrape_ts:ts, stable_id:stableId};});})()")
  # items is JSON array with brackets.
  # strip leading/trailing [ ]
  items_body=$(echo "$items" | sed '1d; $d')
  if [ -n "$items_body" ]; then
    if [ "$first" = true ]; then first=false; else echo "," >> "$output_file"; fi
    echo "$items_body" >> "$output_file"
  fi
done
echo "]" >> "$output_file"
cat "$output_file"
