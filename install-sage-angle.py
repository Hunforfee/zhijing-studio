from pathlib import Path
from PIL import Image,ImageOps
import re,json,shutil,sys
root=Path('dist');out=Path('generated/sage-angle-refresh');id,source=sys.argv[1:3];src=Path(source);dst=out/(id+'-final.png');shutil.copyfile(src,dst)
p=root/'camera-contract.js';s=p.read_text(encoding='utf-8');current=re.search(r"set:\{file:'([^']+)'",s).group(1);ids=re.findall(r'"([^"]+)"',re.search(r'set:\{.*?angleIds:\[([^]]+)\]',s).group(1));cell=ids.index(id)
records=json.loads((out/'manifest.json').read_text(encoding='utf-8'))
for row in records:
 if row['id']==id:row.update(final=str(dst.resolve()),checked=True)
count=sum('final' in x for x in records);filename=f'set-angles-sage-refresh-{count:02d}.png';atlas=Image.open(root/'assets'/current).convert('RGB');im=ImageOps.fit(Image.open(dst).convert('RGB'),(512,512),method=Image.Resampling.LANCZOS);im.save(root/f'assets/set20-fresh/{id}.png');atlas.paste(im,((cell%4)*512,(cell//4)*512));atlas.save(root/'assets'/filename);p.write_text(s.replace(current,filename),encoding='utf-8')
p=root/'style.css';s=p.read_text(encoding='utf-8');s=re.sub(r"(\.angle-photo-set-framed::before\{background-image:url\('/assets/)[^']+",lambda m:m.group(1)+filename,s)
if '.sage-refresh-full' not in s:s+='\n/* .sage-refresh-full: square photos fill thumbnails without padding. */\n.angle-photo-set-framed{height:auto;aspect-ratio:1}\n.angle-photo-set-framed::before{width:100%;height:100%}\n'
p.write_text(s,encoding='utf-8');version=f'20261004-sage-refresh-{count:02d}'
p=root/'app.js';s=p.read_text(encoding='utf-8');s=re.sub(r"camera-contract.js\?v=[^']+",'camera-contract.js?v='+version,s);p.write_text(s,encoding='utf-8')
p=root/'index.html';s=p.read_text(encoding='utf-8');s=re.sub(r'(?:style.css|app.js|camera-input.js)\?v=[^" ]+',lambda m:m.group(0).split('?')[0]+'?v='+version,s);p.write_text(s,encoding='utf-8');(out/'manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8');print(f'{id}: replaced {count}/20, atlas cell {cell}')
