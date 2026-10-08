import base64, re, os
D=os.environ.get('DAYDAN_FONTS_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','brand','fonts'))
FACES=[('El Messiri','ElMessiri.ttf','400 700'),
 ('Tajawal','Tajawal-Regular.ttf','400'),('Tajawal','Tajawal-Medium.ttf','500'),('Tajawal','Tajawal-Bold.ttf','700'),
 ('Scheherazade New','ScheherazadeNew-Regular.ttf','400'),('Scheherazade New','ScheherazadeNew-Medium.ttf','500'),
 ('Scheherazade New','ScheherazadeNew-SemiBold.ttf','600'),('Scheherazade New','ScheherazadeNew-Bold.ttf','700')]
_css=None
def css():
    global _css
    if _css is None:
        _css=''.join("@font-face{font-family:'%s';src:url(data:font/ttf;base64,%s) format('truetype');font-weight:%s;font-style:normal;font-display:block}\n"
            %(f,base64.b64encode(open(os.path.join(D,fn),'rb').read()).decode(),w) for f,fn,w in FACES)
    return _css
def inject(s):
    s=re.sub(r'<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>','',s)
    return s.replace('<head>','<head><style>'+css()+'</style>',1) if '<head>' in s else '<style>'+css()+'</style>'+s
FAMS=[f for f,_,_ in FACES]
async def load_all(pg):
    # force-load every face, then fail loudly if any face isn't loaded
    st=await pg.evaluate("""async()=>{await Promise.all([...document.fonts].map(f=>f.load().catch(()=>null)));await document.fonts.ready;
      return [...document.fonts].map(f=>f.family+' '+f.weight+' '+f.status)}""")
    bad=[x for x in st if not x.endswith('loaded')]
    if bad: raise RuntimeError('fonts not loaded: %s'%bad)
    return st
