"""Build a small, editable scene from the user's existing trusted studio template."""
import hashlib
import json
from pathlib import Path
import zipfile

root=Path(__file__).resolve().parent
source=root/'templates'/'霞沢涟_自由拼贴.mscene'
folder=root/'templates'/'default'
folder.mkdir(exist_ok=False)
with zipfile.ZipFile(source) as z:
    data=json.loads(z.read('scene.json').decode('utf-8'))
    by_name={layer['name']:layer for layer in data['layers']}
    layers=[]
    for name,filename in [('深色氛围背景','background.png'),('主视觉 · 霞沢涟','portrait.png'),('文字底板','panel.png')]:
        layer=by_name[name]
        (folder/filename).write_bytes(z.read(layer['image_path']))
        layer['image_path']=filename
        if name=='文字底板':
            layer['quad']=[[800,260],[1540,260],[1540,800],[800,800]]
        layers.append(layer)
    text=by_name['神人语录']
    text['name']='聊天文字'
    text['quad']=[[840,300],[1500,300],[1500,760],[840,760]]
    text['width']=660;text['height']=460
    text['font']['family']='@windows-cjk'
    text['font']['size']=56;text['font']['max_size']=56;text['font']['min_size']=24
    text['font']['color']='#fff8e8';text['font']['auto_shrink']=True
    layers.append(text)
    data['layers']=layers;data['message']='';data['text_mode']='repeat'
    (folder/'scene.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in folder.iterdir() if p.is_file()}
(folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'files':len(manifest),'bytes':sum(p.stat().st_size for p in folder.iterdir()),'manifest':manifest},ensure_ascii=False))
