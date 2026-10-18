from PIL import Image
from pathlib import Path
root=Path(r'E:\图片101\织景工作台\dist\assets')
a=Image.open(root/'set-framed-angles-v2-printed.png').convert('RGB')
s=Image.open(r'C:\Users\Hunfo\Desktop\ChatGPT Image Oct 4, 2026, 04_38_47 PM.png').convert('RGB')
w,h=a.size;cw,ch=w//4,h//3
s.resize((cw,ch),Image.Resampling.LANCZOS).save(root/'set-front-approved.png')
a.paste(s.resize((cw,ch),Image.Resampling.LANCZOS),(cw,0));a.save(root/'set-framed-angles-v3-approved-front.png')
old=Image.open(root/'set-framed-angles-v2-printed.png').convert('RGB')
assert all(a.crop((i%4*cw,i//4*ch,(i%4+1)*cw,(i//4+1)*ch)).tobytes()==old.crop((i%4*cw,i//4*ch,(i%4+1)*cw,(i//4+1)*ch)).tobytes() for i in range(12) if i!=1)
print('仅正面全景单元已替换，其他11个角度像素保持一致',a.size)
