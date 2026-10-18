from PIL import Image
from pathlib import Path
r=Path('dist/assets')
a=Image.open(r/'set-framed-angles-v2-printed.png').convert('RGB')
b=Image.open(r/'set-front-original-floral.png').convert('RGB')
w,h=a.size;cw,ch=w//4,h//3
original=a.copy();a.paste(b.resize((cw,ch),Image.Resampling.LANCZOS),(cw,0))
a.save(r/'set-framed-angles-v4-floral-front.png')
assert all(a.crop((i%4*cw,i//4*ch,(i%4+1)*cw,(i//4+1)*ch)).tobytes()==original.crop((i%4*cw,i//4*ch,(i%4+1)*cw,(i//4+1)*ch)).tobytes() for i in range(12) if i!=1)
print('Updated only front cell; other 11 verified unchanged.')
