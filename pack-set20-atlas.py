from pathlib import Path
import json, shutil
from PIL import Image
specs=json.loads(Path('set20-specs.json').read_text(encoding='utf-8'))
rows=json.loads(Path('set20-corrected-files.json').read_text(encoding='utf-8'))
byid={r['id']:r['path'] for r in rows}
assets=Path('dist/assets/set20-fresh');assets.mkdir(exist_ok=True)
atlas=Image.new('RGB',(2048,2560))
for i,(id,name,camera) in enumerate(specs):
 src=Path(byid[id]);dst=assets/(id+'.png');shutil.copyfile(src,dst)
 im=Image.open(src).convert('RGB');assert im.width==im.height, (id,im.size)
 atlas.paste(im.resize((512,512)),((i%4)*512,(i//4)*512))
atlas.save('dist/assets/set-angles-v6-fresh20.png')
print('Packed 20 individually generated square photos into 4x5 reference atlas')
