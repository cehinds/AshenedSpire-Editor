"""Vendor review previews and the approved draft-only Combat Studio.

Source PNG masters remain in their source packages. This explicit import makes
bounded WebP review copies and records the original bytes' SHA256 hashes.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--combat', required=True, type=Path)
parser.add_argument('--armor', required=True, type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
out = root / 'public' / 'combat-art'
(out / 'editor').mkdir(parents=True, exist_ok=True)
(out / 'previews').mkdir(exist_ok=True)
sources = [(args.combat, json.loads((args.combat/'catalog.json').read_text())), (args.armor, json.loads((args.armor/'catalog.json').read_text()))]
entries = {}
for source, catalog in sources:
    for entry in catalog['entries']:
        file = source / entry['file']
        if not file.exists():
            continue
        item = dict(entry)
        if item.get('classId'):
            item.setdefault('family', 'armor')
        item['sourceMaster'] = {'file':entry['file'], 'sha256':hashlib.sha256(file.read_bytes()).hexdigest(), 'package':source.name}
        dest = out / 'previews' / (entry['id'] + '.webp')
        with Image.open(file) as image:
            image = image.convert('RGBA')
            old_size = image.size
            image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            image.save(dest, 'WEBP', quality=88, method=6)
            item['validation'] = {**item.get('validation', {}), 'size':list(image.size), 'visibleBounds':list(image.getchannel('A').getbbox())}
        item['file'] = dest.relative_to(out).as_posix()
        item['previewSha256'] = hashlib.sha256(dest.read_bytes()).hexdigest()
        item['previewOnly'] = True
        entries[item['id']] = item
catalog = {'schemaVersion':1, 'scope':'Derived review previews; source PNG masters remain in their provenance packages.', 'sourceCommits':{'combat':'41ae95ae42cce66e56805cc35ae1903a92a4d5a5','armor':'f1bad442950d43739a6f1726d63be3555b24838b'}, 'entries':list(entries.values())}
(out/'catalog.json').write_text(json.dumps(catalog, indent=2), encoding='utf-8')
(out/'catalog-data.js').write_text('window.COMBAT_ART_CATALOG = '+json.dumps(catalog)+';\n', encoding='utf-8')
for name in ['matrix.json','matrix.csv','inventory.json']:
    shutil.copyfile(args.armor/name, out/name)
for directory in ['layers','library']:
    shutil.copytree(args.combat/directory, out/directory, dirs_exist_ok=True)
for name in ['studio.mjs','studio-model.mjs','studio.css','library-data.js','starting-layout-v2.json']:
    shutil.copyfile(args.combat/'editor'/name, out/'editor'/name)
html = (args.combat/'editor/battlefield-wireframe-editor.html').read_text(encoding='utf-8')
html = html.replace('src="../../../../index.html?shot=combat"','src="about:blank"')
html = html.replace('<button data-action="ui-scope">Edit UI</button>','<span title="Use Battlefield Layout for the native interface">Art layers</span>')
html = html.replace('Current game interface','Native UI is edited in Battlefield Layout')
html = html.replace('Local art editor · Gameplay and production files are unchanged','Draft art study · Native interface: Battlefield Layout')
(out/'editor/index.html').write_text(html, encoding='utf-8')
js = (out/'editor/studio.mjs').read_text(encoding='utf-8')
js = js.replace("const KEY='ashenspire-combat-studio-v2'", "const KEY='ashenedspire-art-study-v2'")
js = js.replace("frame.addEventListener('load',installUi);const uiPoll=setInterval(()=>{installUi();measureUi();if(uiReady)clearInterval(uiPoll);},500);if(frame.contentDocument?.readyState==='complete')installUi();", "// The native game UI remains in the Editor's Battlefield Layout workspace.\n")
js = js.replace("function setScope(next){", "function setScope(next){if(next.startsWith('ui')){status('Edit the native interface in Battlefield Layout. Art study exports preserve existing UI overrides.');return;}")
# UI data survives import/export, but disconnected UI entries are not offered as editable art.
js = js.replace("const list=scope==='scene'?[...p.objects].sort", "const list=scope==='scene'?p.objects.filter(o=>o.type!=='ui').sort")
js = js.replace('Select a combatant, background or UI layer.', 'Select a combatant or background layer.')
js = js.replace(".map(e=>[e.id,e.name])", ".map(e=>[e.id,e.classId?`${e.classId} / ${e.name}`:e.name])")
js = js.replace("actions.push(['ui-scope','Edit UI groups'],['scene','Return to scene'])", "actions.push(['scene','Return to scene'])")
js += "\nwindow.addEventListener('message',event=>{if(window.parent!==window&&event.source===window.parent&&event.origin===location.origin&&event.data?.type==='combat-art:export')exportFile();});\n"
(out/'editor/studio.mjs').write_text(js, encoding='utf-8')
with (out/'editor/studio.css').open('a', encoding='utf-8') as css:
    css.write('\n/* Native UI is available in Battlefield Layout, outside this art draft. */\n#ui-host{display:none}\n')
print(json.dumps({'entries':len(entries), 'destination':str(out), 'sourceCommits':catalog['sourceCommits']}))
