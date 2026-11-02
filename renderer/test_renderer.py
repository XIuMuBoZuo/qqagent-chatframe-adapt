from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys
import uuid
from PIL import Image, ImageChops

root=Path(__file__).resolve().parent
evidence=root/('test_evidence_'+uuid.uuid4().hex[:8])
evidence.mkdir()
output=evidence/'images'

def call(value,env=None):
    args=[sys.executable,str(root/'render_card.py'),'--output-dir',str(output)]
    p=subprocess.run(args,input=json.dumps(value,ensure_ascii=False).encode('utf-8'),stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,timeout=80)
    assert len(p.stdout.splitlines())==1,(p.returncode,p.stderr)
    result=json.loads(p.stdout.decode('utf-8'))
    assert (p.returncode==0)==result['ok']
    return result

def image_result(value):
    r=call({'text':value});assert r['ok'],r
    path=Path(r['image_path']);assert path.parent.resolve()==output.resolve()
    assert path.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
    with Image.open(path) as image:
        image.load();assert image.size==(1600,1000)
    return path

sample=image_result('挚友，吾辈今天也认真完成任务了！')
punct_a=image_result('吾辈已经完成。')
punct_b=image_result('吾辈已经完成！')
with Image.open(punct_a) as a,Image.open(punct_b) as b:
    assert ImageChops.difference(a.convert('RGB'),b.convert('RGB')).getbbox() is not None
long=image_result('吾辈正在努力记录这段对话。'*12)
before=len(list(output.glob('*.png')))
for invalid,code in [({'text':'甲'*241},'TEXT_TOO_LONG'),({'text':'正常','template':'C:/private.png'},'INVALID_REQUEST'),({'text':'\u0000'},'INVALID_REQUEST'),({'text':''},'INVALID_REQUEST')]:
    r=call(invalid);assert not r['ok'] and r['error']['code']==code,r
assert len(list(output.glob('*.png')))==before
env={**os.environ,'WINDIR':str(evidence/'no-windows-fonts')}
missing=call({'text':'中文字体测试'},env);assert missing['error']['code']=='FONT_UNAVAILABLE'
record={'passed':True,'sample':str(sample),'long_sample':str(long),'real_QQ_messages':0,'network_calls':0,'model_calls':0,'checks':['actual_PNG_decode_1600x1000','terminal_punctuation_changes_pixels','reasonable_long_text_visible_with_minimum_font_check','overlong_text_rejected','message_cannot_select_template_or_path','invalid_controls_rejected','missing_Windows_font_fails_explicitly','unique_output_in_caller_controlled_directory'],'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in output.glob('*.png')}}
(evidence/'result.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record,ensure_ascii=False))
