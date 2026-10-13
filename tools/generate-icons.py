"""Render the project's voxel penguin as install icons; no downloaded artwork."""
from pathlib import Path
from PIL import Image, ImageDraw

root=Path(__file__).resolve().parent.parent/'icons'
root.mkdir(exist_ok=True)
for name,size in [('icon-192.png',192),('icon-512.png',512),('maskable-512.png',512),('apple-touch-icon.png',180)]:
    image=Image.new('RGB',(100,100),'#bce4f4')
    draw=ImageDraw.Draw(image)
    def block(box,color): draw.rectangle(box,fill=color)
    block((32,37,67,71),'#212e40')
    block((29,24,70,47),'#212e40')
    block((36,42,63,67),'#fff5d9')
    block((35,29,48,43),'#fff5d9');block((51,29,64,43),'#fff5d9')
    block((40,33,44,37),'#0d141c');block((55,33,59,37),'#0d141c')
    block((40,33,41,34),'#ffffff');block((55,33,56,34),'#ffffff')
    block((46,39,53,44),'#ffa62e')
    block((25,44,31,62),'#212e40');block((68,44,74,62),'#212e40')
    block((33,72,46,78),'#ffa62e');block((53,72,66,78),'#ffa62e')
    image.resize((size,size),Image.Resampling.NEAREST).save(root/name,optimize=True)
print('Generated 192 / 512 / maskable / Apple install icons')
