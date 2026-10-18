from pathlib import Path
from PIL import Image, ImageDraw
import math

out = Path(__file__).parent / 'dist/assets/crafts'
out.mkdir(parents=True, exist_ok=True)
labels = {'wide-flange':'OXFORD FLANGE: flat cloth beyond inset stitching', 'narrow-flange':'NARROW FLANGE: small flat unfilled extension', 'piping':'PIPING: thin raised round cord at sewn edge', 'binding':'BINDING: flat folded tape around cut edge', 'ruffle':'RUFFLE: gathered attachment and loose wavy outer edge', 'lace':'LACE: narrow openwork strip sewn at outer edge', 'scallop':'SCALLOP: flat cut cloth with repeated curved outline', 'fitted':'FITTED SHEET: joined corner pockets, gathered underside', 'skirt':'BED SKIRT: top cloth joined to three hanging panels', 'pleated-skirt':'PLEATED SKIRT: vertical pleats below attachment seam', 'ruffle-skirt':'RUFFLE SKIRT: hanging panel with gathered bottom trim', 'coverlet':'TAILORED COVERLET: top joined to fitted drop panels'}
for kind,label in labels.items():
    im=Image.new('RGB',(1000,740),'white');d=ImageDraw.Draw(im)
    d.text((35,25),'CONSTRUCTION SCHEMATIC ONLY - NOT COLOR / PRINT / CAMERA',fill='black')
    d.text((35,55),label,fill='black')
    if 'flange' in kind:
        pad=38 if kind=='wide-flange' else 14
        for left,right,title,duvet in [(90,570,'DUVET: HEAD at top; FOOT at bottom',True),(665,940,'PILLOWCASE: FOUR flanged edges',False)]:
            top,bottom=190,550
            d.text((left,130),title,fill='black')
            d.rectangle((left,top,right,bottom),fill='#dddddd',outline='black',width=3)
            body=(left+pad,top if duvet else top+pad,right-pad,bottom-pad)
            d.rectangle(body,fill='#f7f7f7',outline='#555555',width=2)
            d.text((left+pad+8,340),'ORIGINAL BODY',fill='black')
            d.text((left+pad+8,360),'SIZE UNCHANGED',fill='black')
            if duvet:
                d.text((left,165),'HEAD: plain seam; NO FLANGE',fill='black')
                d.text((left,580),'Flange ONLY left / right / foot',fill='black')
                d.text((left,610),'Wide outer size: (W+2b) x (L+b)',fill='black')
            else:
                d.text((left,580),'All FOUR edges flanged',fill='black')
                d.text((left,610),'Wide: (W+2b) x (L+2b)',fill='black')
        d.text((90,675),'Flat cloth strips have NO filling. Apply only the selected component diagram.',fill='black')
        im.save(out/(kind+'.png'))
        continue
    if kind in ['fitted','skirt','pleated-skirt','ruffle-skirt','coverlet']:
        d.polygon([(190,180),(710,180),(850,340),(330,340)],fill='#eeeeee',outline='black',width=3)
        depth=115 if kind=='fitted' else 240
        d.polygon([(330,340),(850,340),(850,340+depth),(330,340+depth)],fill='#dddddd',outline='black',width=3)
        d.polygon([(190,180),(330,340),(330,340+depth),(190,180+depth)],fill='#e5e5e5',outline='black',width=3)
        d.line([(330,340),(850,340)],fill='black',width=5)
        if kind=='pleated-skirt':
            for x in range(350,840,35):d.line([(x,342),(x-8,570),(x+8,578)],fill='#555555',width=3)
        if kind=='ruffle-skirt':
            for x in range(332,835,22):d.arc((x,545,x+30,602),0,180,fill='black',width=3)
            d.line([(330,545),(850,545)],fill='black',width=2)
        if kind=='fitted':
            for x in range(350,840,24):d.line([(x,430),(x+8,455)],fill='#444444',width=2)
            d.text((335,480),'Elastic gathered UNDER the mattress; no loose skirt',fill='black')
        d.text((200,655),'Top and side panels connect at mattress edge. No extra fifth bedding piece.',fill='black')
    else:
        box=(210,170,790,555);pad=45 if kind=='wide-flange' else 16
        if 'flange' in kind:
            d.rectangle(box,fill='#dddddd',outline='black',width=3)
            inner=(box[0]+pad,box[1]+pad,box[2]-pad,box[3]-pad)
            d.rounded_rectangle(inner,radius=20,fill='#f7f7f7',outline='#888888',width=2)
            for x in range(inner[0],inner[2],12):
                d.line([(x,inner[1]),(x+5,inner[1])],fill='black',width=2)
                d.line([(x,inner[3]),(x+5,inner[3])],fill='black',width=2)
            for y in range(inner[1],inner[3],12):
                d.line([(inner[0],y),(inner[0],y+5)],fill='black',width=2)
                d.line([(inner[2],y),(inner[2],y+5)],fill='black',width=2)
            d.text((320,345),'ORIGINAL SIZE BODY (unchanged)' if kind=='wide-flange' else 'SOFT FILLED BODY',fill='black')
            d.line([(795,535),(865,535),(865,595)],fill='black',width=2)
            d.text((570,605),'Outer strip: FLAT cloth, NO filling',fill='black')
            d.text((200,660),'Inset stitch holds filling inside. Flange extends beyond it on all sides.',fill='black')
            if kind=='wide-flange':
                d.text((200,695),'ADD b OUTSIDE each edge: outer size = (body W + 2b) x (body L + 2b)',fill='black')
        elif kind in ['piping','binding']:
            d.rounded_rectangle(box,22,fill='#eeeeee',outline='#333333',width=7 if kind=='piping' else 12)
            if kind=='piping':d.rounded_rectangle((215,175,785,550),19,outline='white',width=2)
            else:d.rounded_rectangle((221,181,779,544),14,outline='#999999',width=2)
            d.text((220,635),'Round raised cord' if kind=='piping' else 'Flat folded tape: no raised cord / no broad flange',fill='black')
        elif kind=='ruffle':
            points=[]
            for x in range(175,826,4):points.append((x,145+18*math.sin(x/12)))
            for y in range(145,581,4):points.append((825+18*math.sin(y/12),y))
            for x in range(825,174,-4):points.append((x,580+18*math.sin(x/12)))
            for y in range(580,144,-4):points.append((175+18*math.sin(y/12),y))
            d.polygon(points,fill='#dddddd',outline='black');d.rectangle(box,fill='#f7f7f7',outline='black',width=3)
            for x in range(220,790,18):
                d.line([(x,170),(x-6,150)],fill='#555555',width=2);d.line([(x,555),(x+8,580)],fill='#555555',width=2)
            d.text((170,650),'Gathered strip attaches at seam; free outer edge ripples. Not a flat flange.',fill='black')
        elif kind=='lace':
            d.rectangle((185,145,815,580),fill='#dddddd',outline='black',width=2)
            for x in range(192,810,18):
                for y in [153,565]:d.ellipse((x,y,x+10,y+10),fill='white',outline='#555555')
            for y in range(180,550,18):
                for x in [190,799]:d.ellipse((x,y,x+10,y+10),fill='white',outline='#555555')
            d.rectangle(box,fill='#f7f7f7',outline='black',width=3)
            d.text((185,645),'Small holes belong ONLY to narrow sewn lace. Main fabric is opaque.',fill='black')
        else:
            points=[]
            for x in range(210,791,3):points.append((x,170-10*abs(math.sin((x-210)*math.pi/40))))
            for y in range(170,556,3):points.append((790+10*abs(math.sin((y-170)*math.pi/40)),y))
            for x in range(790,209,-3):points.append((x,555+10*abs(math.sin((x-210)*math.pi/40))))
            for y in range(555,169,-3):points.append((210-10*abs(math.sin((y-170)*math.pi/40)),y))
            d.polygon(points,fill='#eeeeee',outline='black')
            d.text((180,640),'Flat cloth cut into curved scallops; no gathered strip, no holes.',fill='black')
    im.save(out/(kind+'.png'))
print('Created',len(labels),'construction references')
