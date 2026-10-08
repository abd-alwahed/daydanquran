"""فحص الخطوط حرفاً حرفاً: هل كل نص في الصورة رُسم فعلاً بالخط المعلن له؟
تحذير: document.fonts.check() يعطي true حتى لو لم يُحمَّل الخط، فلا تعتمد عليه.
الاستخدام: python fontcheck.py templates-html/*.html   (يفشل بكود 1 عند أي حرف بخط بديل)
يتطلب: pip install playwright ، والخطوط في brand/fonts (يحقنها localfonts.inject)."""
import re, sys, asyncio, collections
from playwright.async_api import async_playwright
from localfonts import inject, load_all
TEXT_NODES='''()=>[...document.querySelectorAll('*')].map((e,i)=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())?i:-1).filter(i=>i>=0)'''
async def check(b,path):
    s=inject(open(path,encoding='utf-8').read())
    m=re.search(r'width: ?(\d+)px; ?height: ?(\d+)px',s); w,h=map(int,m.groups()) if m else (1080,1080)
    pg=await b.new_page(viewport={'width':w,'height':h}); await pg.set_content(s,wait_until='load'); await load_all(pg)
    cdp=await pg.context.new_cdp_session(pg); await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
    root=(await cdp.send('DOM.getDocument',{'depth':-1}))['root']['nodeId']
    ids=(await cdp.send('DOM.querySelectorAll',{'nodeId':root,'selector':'*'}))['nodeIds']
    direct=set(await pg.evaluate(TEXT_NODES)); bad=collections.Counter()
    for i,nid in enumerate(ids):
        if i not in direct: continue
        st=(await cdp.send('CSS.getComputedStyleForNode',{'nodeId':nid}))['computedStyle']
        fam=[x['value'] for x in st if x['name']=='font-family'][0].split(',')[0].strip("' \"")
        for f in (await cdp.send('CSS.getPlatformFontsForNode',{'nodeId':nid}))['fonts']:
            if fam.lower().replace(' ','') not in f['familyName'].lower().replace(' ',''): bad[(fam,f['familyName'])]+=f['glyphCount']
    await pg.close(); return bad
async def main(paths):
    async with async_playwright() as p:
        b=await p.chromium.launch(); fail=0
        for path in paths:
            bad=await check(b,path); fail+=sum(bad.values()); print(path,'OK' if not bad else f'FALLBACK {dict(bad)}')
        await b.close(); sys.exit(1 if fail else 0)
if __name__=='__main__': asyncio.run(main(sys.argv[1:]))
