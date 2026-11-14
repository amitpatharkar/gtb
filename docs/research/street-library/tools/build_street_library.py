#!/usr/bin/env python3
"""Re-generate streets.json and buildings-notable.json of the South Mumbai street library from the game's OSM extract.
Run from anywhere:
    pip install osmium shapely
    python3 docs/research/street-library/tools/build_street_library.py
Hand-made inputs (kept as they are): ../profiles.json (profiles + proposed districts) and ../survey.json (Street View notes).
Edit S, W, N, E to cover another area. Same projection as scripts/build-tiles.mjs (origin Mahim 19.03 N, 72.85 E)."""
import os, sys, json, math, re, collections, statistics as st
import osmium
from shapely.geometry import LineString, Polygon, Point
from shapely.strtree import STRtree
from shapely.ops import unary_union
LIB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.abspath(os.path.join(LIB, '..', '..', '..'))
S,W,N,E = 18.890,72.795,18.985,72.860
lat0,lon0=19.03,72.85; rad=math.pi/180
M_LAT=111132.92-559.82*math.cos(2*lat0*rad)+1.175*math.cos(4*lat0*rad)
M_LON=111412.84*math.cos(lat0*rad)-93.5*math.cos(3*lat0*rad)
proj=lambda la,lo:((lo-lon0)*M_LON,-(la-lat0)*M_LAT)
unproj=lambda x,z:(lat0-z/M_LAT,lon0+x/M_LON)
HW={'motorway':(0,15),'trunk':(1,14),'primary':(2,12),'secondary':(3,10),'tertiary':(4,8.5),'motorway_link':(5,7),'trunk_link':(5,7),'primary_link':(5,6.5),'secondary_link':(5,6.5),'tertiary_link':(5,6),'unclassified':(6,6.5),'residential':(6,6),'road':(6,6),'living_street':(7,5),'service':(8,4.5),'pedestrian':(9,5),'footway':(10,2.2),'path':(10,2),'cycleway':(10,2.2),'steps':(10,2),'track':(11,3.5)}
PRIVATE=re.compile(r'\b(mannat|jalsa|antilia|prateeksha)\b',re.I)

inb=lambda la,lo:S<=la<=N and W<=lo<=E
PRIVATE=re.compile(r'\b(mannat|jalsa|antilia|prateeksha)\b',re.I)
roads=[];blds=[];pois=[]
class H(osmium.SimpleHandler):
    def node(self,n):
        if not n.location.valid() or not inb(n.location.lat,n.location.lon): return
        t={k.k:k.v for k in n.tags}
        if not t: return
        kind=None
        if 'shop' in t: kind='shop'
        elif t.get('amenity') in('restaurant','cafe','fast_food','bank','pharmacy','atm','bar','pub','fuel','place_of_worship','school','hospital','clinic','cinema','theatre','police','post_office'): kind=t['amenity']
        elif t.get('natural')=='tree': kind='tree'
        elif t.get('highway') in('traffic_signals','bus_stop','street_lamp'): kind=t['highway']
        elif t.get('tourism') or t.get('historic'): kind='sight'
        if kind: pois.append((kind,n.location.lat,n.location.lon,t.get('name','')))
    def way(self,w):
        t={k.k:k.v for k in w.tags}
        try: pts=[(nd.location.lat,nd.location.lon) for nd in w.nodes]
        except osmium.InvalidLocationError: return
        if not pts or not any(inb(*p) for p in pts): return
        hwv=t.get('highway')
        if hwv in HW and t.get('area')!='yes' and not (t.get('tunnel') not in (None,'no','building_passage')) and t.get('footway')!='crossing':
            roads.append(dict(id=w.id,tags=t,pts=pts,nodes=[nd.ref for nd in w.nodes]))
        if 'building' in t and len(pts)>=4 and pts[0]==pts[-1]:
            blds.append(dict(id=w.id,tags=t,pts=pts))
h=H(); h.apply_file(os.path.join(ROOT,'data/raw/mumbai-region.osm.pbf'),locations=True)
RAW=dict(roads=roads,blds=blds,pois=pois)

R=RAW
roads=R['roads']; blds=R['blds']; pois=R['pois']
def rname(t):
    n=t.get('name') or t.get('name:en') or t.get('ref') or ''
    return '' if PRIVATE.search(n) else n
for r in roads:
    r['xz']=[proj(*p) for p in r['pts']]
    r['len']=sum(math.dist(r['xz'][i],r['xz'][i-1]) for i in range(1,len(r['xz'])))
    r['name']=rname(r['tags']); r['cls']=HW[r['tags']['highway']][0]
named=[r for r in roads if r['name']]
COMMON=set('road marg street lane cross flyover bridge chowk nagar galli gully path avenue station east west north south first second third fourth fifth raod service maharshi maharaj shivaji gandhi mahatma sardar netaji subhash'.split())
words=lambda n:{w for w in re.sub('[^a-z ]',' ',n.lower()).split() if len(w)>=7 and w not in COMMON}
par={r['id']:r['id'] for r in named}
def f(a):
    while par[a]!=a: par[a]=par[par[a]]; a=par[a]
    return a
def u(a,b): par[f(a)]=f(b)
byid={r['id']:r for r in named}
for r in named: r['w']=words(r['name'])
bynode=collections.defaultdict(list)
for r in named:
    for nd in r['nodes']: bynode[nd].append(r)
for L in bynode.values():
    for i in range(len(L)):
        for j in range(i+1,len(L)):
            a,b=L[i],L[j]
            if a['name']==b['name'] or a['w']&b['w']: u(a['id'],b['id'])
key=lambda n:re.sub('[^a-z0-9]','',n.lower())
# same normalized name within 150 m chain -> merge
bykey=collections.defaultdict(list)
for r in named: bykey[key(r['name'])].append(r)
for L in bykey.values():
    for i in range(len(L)):
        for j in range(i+1,len(L)):
            a,b=L[i],L[j]
            if f(a['id'])==f(b['id']): continue
            if LineString(a['xz']).distance(LineString(b['xz']))<150: u(a['id'],b['id'])
groups=collections.defaultdict(list)
for r in named: groups[f(r['id'])].append(r)
out=[]
for g in groups.values():
    sc=collections.Counter()
    for r in g: sc[r['name']]+=r['len']-(1e5 if ('/' in r['name'] or '(' in r['name']) else 0)
    out.append(dict(name=sc.most_common(1)[0][0],variants=sorted(set(r['name'] for r in g)),ways=g))
GROUPS=[dict(name=o['name'],variants=o['variants'],ids=[r['id'] for r in o['ways']]) for o in out]

R=RAW; G=GROUPS
src=open(os.path.join(ROOT,'scripts/lib/districts.mjs')).read()
D=[]
for m in re.finditer(r"D\('([^']+)', \[([\d., ]+)\], (\{[^}]*\})",src):
    b=[float(x) for x in m.group(2).split(',')]
    D.append((m.group(1),b,m.group(3)))
D.sort(key=lambda d:(d[1][2]-d[1][0])*(d[1][3]-d[1][1]))
def district(la,lo):
    for n,b,s in D:
        if b[0]<=la<=b[2] and b[1]<=lo<=b[3]: return n
    return 'Mumbai'
roads={r['id']:r for r in R['roads']}
for r in R['roads']: r['xz']=[proj(*p) for p in r['pts']]
# buildings
B=[]
for b in R['blds']:
    xz=[proj(*p) for p in b['pts']]
    try: poly=Polygon(xz)
    except Exception: continue
    if not poly.is_valid: poly=poly.buffer(0)
    if poly.is_empty: continue
    c=poly.centroid; la,lo=unproj(c.x,c.y)
    if not (S<=la<=N and W<=lo<=E): continue
    t=b['tags']; lv=t.get('building:levels'); h=t.get('height')
    try: lv=float(lv) if lv else (round((float(re.sub('[^0-9.]','',h))-0.8)/3.2) if h else None)
    except: lv=None
    B.append(dict(id=b['id'],poly=poly,c=(c.x,c.y),la=la,lo=lo,lv=lv,area=poly.area,t=t))
btree=STRtree([b['poly'] for b in B])
P=collections.defaultdict(list)
for k,la,lo,nm in R['pois']: P[k].append(Point(*proj(la,lo)))
ptrees={k:STRtree(v) for k,v in P.items()}
CLS='motorway trunk primary secondary tertiary link residential living service pedestrian footway track'.split()
out=[]
for gi,g in enumerate(G):
    ws=[roads[i] for i in g['ids']]
    lines=[LineString(w['xz']) for w in ws if len(w['xz'])>1]
    if not lines: continue
    geom=unary_union(lines); L=sum(l.length for l in lines)
    cls=min(HW[w['tags']['highway']][0] for w in ws)
    # point at half length on the longest piece
    longest=max(lines,key=lambda l:l.length); mid=longest.interpolate(0.5,normalized=True)
    la,lo=unproj(mid.x,mid.y)
    # heading of street at mid
    p1=longest.interpolate(max(0,longest.project(mid)-5)); p2=longest.interpolate(min(longest.length,longest.project(mid)+5))
    brg=(math.degrees(math.atan2(p2.x-p1.x,-(p2.y-p1.y)))+360)%360  # compass bearing (z is south)
    buf=geom.buffer(30)
    idx=btree.query(buf,predicate='intersects')
    bs=[B[i] for i in idx]
    lvs=[b['lv'] for b in bs if b['lv']]
    def cnt(k,d=20):
        if k not in ptrees: return 0
        return len(ptrees[k].query(geom.buffer(d),predicate='intersects'))
    tags=collections.Counter()
    for w in ws:
        t=w['tags']
        if t.get('oneway') in('yes','1'): tags['oneway']+=1
        if t.get('bridge') not in(None,'no'): tags['bridge']+=1
    lanes=[int(w['tags']['lanes']) for w in ws if w['tags'].get('lanes','').isdigit()]
    xs=[p for l in lines for p in l.coords]
    bb=[min(unproj(x,z)[0] for x,z in xs),min(unproj(x,z)[1] for x,z in xs),max(unproj(x,z)[0] for x,z in xs),max(unproj(x,z)[1] for x,z in xs)]
    dc=collections.Counter(district(*unproj(*p)) for p in xs)
    out.append(dict(name=g['name'],variants=[v for v in g['variants'] if v!=g['name']],osm_way_ids=g['ids'],
        class_=CLS[min(cls,len(CLS)-1)] if cls<5 else CLS[cls], length_m=round(L),
        mid=[round(la,6),round(lo,6)],game_xz=[round(mid.x,1),round(mid.y,1)],bearing=round(brg),
        bbox=[round(v,5) for v in bb],districts=[d for d,_ in dc.most_common(3)],
        lanes=max(lanes) if lanes else None, oneway=tags['oneway']>len(ws)/2, bridge=tags['bridge']>0,
        buildings_30m=len(bs), levels_median=st.median(lvs) if lvs else None, levels_tagged=len(lvs),
        shops_20m=cnt('shop'), food_20m=cnt('restaurant')+cnt('cafe')+cnt('fast_food'), trees_osm_15m=cnt('tree',15),
        signals=cnt('traffic_signals',8), bus_stops=cnt('bus_stop',25), worship_30m=cnt('place_of_worship',30)))
STREETS_RAW=out
# notable buildings
NB=[]
for b in B:
    t=b['t']
    nm=t.get('name') or t.get('name:en') or ''
    if PRIVATE.search(nm): continue
    notable = nm or t.get('historic') or t.get('heritage') or t.get('amenity') in('place_of_worship','school','college','university','hospital','theatre','cinema','townhall','courthouse','library') or t.get('tourism')
    if not notable: continue
    NB.append(dict(osm_way_id=b['id'],name=nm,lat=round(b['la'],6),lon=round(b['lo'],6),game_xz=[round(b['c'][0],1),round(b['c'][1],1)],
        footprint_m2=round(b['area']),levels=b['lv'],building=t.get('building'),
        tags={k:t[k] for k in ('amenity','historic','heritage','tourism','religion','denomination','shop','office','start_date','architect','wikipedia','wikidata','addr:street','building:colour','roof:shape','building:material') if k in t},
        district=district(b['la'],b['lo'])))
NOTABLE_RAW=NB

import json, re, math, collections
PJ=json.load(open(os.path.join(LIB,'profiles.json'))); P={p['id']:p for p in PJ['profiles']}
S_ = STREETS_RAW
NB = NOTABLE_RAW
NOTES = json.load(open(os.path.join(LIB,'survey.json')))

# ---- proposed extra districts for the gaps that fall back to "Mumbai" in districts.mjs
NEW_DISTRICTS = PJ['new_districts']
def new_district(la, lo):
    for d in NEW_DISTRICTS:
        b = d['bbox']
        if b[0] <= la <= b[2] and b[1] <= lo <= b[3]: return d['name']
    return None

DMAP = {  # district -> (main-road profile, lane profile)
  'Apollo Bunder': ('heritage-boulevard', 'colaba-leafy-residential'), 'Colaba': ('deco-avenue', 'colaba-leafy-residential'),
  'Cuffe Parade': ('nariman-office', 'nariman-office'), 'Nariman Point': ('nariman-office', 'nariman-office'),
  'Churchgate': ('deco-avenue', 'deco-avenue'), 'Marine Drive': ('deco-avenue', 'deco-avenue'),
  'Kala Ghoda': ('heritage-boulevard', 'fort-narrow-commercial'), 'Fort': ('fort-arcade-commercial', 'fort-narrow-commercial'),
  'CST': ('fort-arcade-commercial', 'fort-narrow-commercial'), 'Ballard Estate': ('ballard-office', 'ballard-office'),
  'Dhobi Talao': ('arterial-mixed', 'girgaon-chawl-street'), 'Crawford Market': ('bazaar-wholesale', 'bazaar-wholesale'),
  'Kalbadevi': ('bazaar-wholesale', 'kalbadevi-gully'), 'Girgaon': ('girgaon-chawl-street', 'girgaon-chawl-street'),
  'Chowpatty': ('girgaon-chawl-street', 'girgaon-chawl-street'), 'Malabar Hill': ('malabar-hill-ridge', 'malabar-hill-ridge'),
  'Grant Road': ('arterial-mixed', 'girgaon-chawl-street'), 'Tardeo': ('arterial-mixed', 'quiet-residential'),
  'Mazgaon': ('port-dock-road', 'quiet-residential'), 'Byculla': ('byculla-mill-market', 'byculla-mill-market'),
  'Haji Ali': ('arterial-mixed', 'quiet-residential'), 'Parel': ('byculla-mill-market', 'byculla-mill-market'),
  'Bhendi Bazaar': ('muslim-quarter-bazaar', 'muslim-quarter-bazaar'), 'Nagpada': ('muslim-quarter-bazaar', 'muslim-quarter-bazaar'),
  'Dongri Mandvi': ('bazaar-wholesale', 'bazaar-wholesale'), 'Mumbai Central': ('byculla-mill-market', 'quiet-residential'),
  'Reay Road': ('port-dock-road', 'port-dock-road'), 'Mumbai': ('arterial-mixed', 'quiet-residential'),
}
# Street-name overrides (regex on the canonical name or variants), from the survey and the guide.
NAME_RULES = [
  (r'freeway|coastal road|sea link|expressway', 'flyover-corridor'),
  (r'\bmarine drive\b|netaji subhash|sea face|chowpatty seaface', 'seafront-boulevard'),
  (r'shahid bhagat singh|colaba causeway', 'colaba-causeway'),
  (r'madame cama|mahatma gandhi road|karmaveer bhaurao|veer nariman|jamshedji tata|dinshaw wachha|maharshi karve', None),  # handled below
  (r'dadabhai naoroji|hornby|fort street|walchand hirachand', None),
  (r'bhadkamkar|lamington', 'electronics-strip'),
  (r'\bwadi\b|khotachi', 'wadi-lane'),
  (r'banganga', 'banganga-ghat'),
  (r'altamount|barodawala|carmichael|ridge road|b g kher|jagmohandas|nepean|purandare|mount pleasant|bhausaheb hire|l d ruparel|narayan dabholkar|manav mandir|jamnadas mehta|raj bhavan', 'malabar-hill-ridge'),
  (r'mohammed ali|ebrahim rehmatullah|imamwada|bhendi|maulana azad road|shuklaji|kamathipura|falkland|foras', 'muslim-quarter-bazaar'),
  (r'carnac|abdul rehman|masjid bunder|yusuf meher|mint road|kalbadevi|zaveri|bhuleshwar|chakala|nagdevi|narshi natha|princess street|samuel street', 'bazaar-wholesale'),
  (r"d' ?mello|dockyard|reay road|frere|malet bandar|haji bandar|quay street|darukhana", 'port-dock-road'),
  (r'jagannath shankarsheth|vithalbhai patel|raja ram mohan roy|charni road|girgaum|thakurdwar|v p road', 'girgaon-chawl-street'),
  (r'sardar vallabhbhai patel|maulana shaukat ali|j boman behram|grant road|patthe bapurao|anand ?rao nair|sir j\.? ?j\.? road|jamshetji jeejeebhoy|lokmanya tilak|keshavrao khadye|lala lajpat|javji dadaji', 'arterial-mixed'),
]
EXPLICIT = {  # surveyed or well-known, exact canonical names
  'Madame Cama Road': 'heritage-boulevard', 'Mahatma Gandhi Road': 'heritage-boulevard', 'Karmaveer Bhaurao Patil Road': 'heritage-boulevard',
  'Veer Nariman Road': 'deco-avenue', 'Jamshedji Tata Road': 'deco-avenue', 'Dinshaw Wachha Road': 'deco-avenue', 'Maharshi Karve Road': 'deco-avenue',
  'Dr Dadabhai Naoroji Road': 'fort-arcade-commercial', 'Fort Street': 'fort-arcade-commercial',
  'Walchand Hirachand Road': 'ballard-office', 'Ramjibhai Kamani Road (Nichol Road)': 'ballard-office',
  'Sir Pherozeshah Mehta Road': 'fort-narrow-commercial', 'Bombay Samachar Marg': 'fort-narrow-commercial',
  'Henry Road': 'colaba-leafy-residential', 'Captain Prakash Pethe Marg': 'nariman-office', 'Jamnalal Bajaj Road': 'nariman-office',
  'Free Press Journal Road': 'nariman-office', 'Wodehouse Road': 'colaba-leafy-residential', 'Nathalal M. Parikh Road': 'colaba-leafy-residential',
  'Marine Drive': 'seafront-boulevard', 'Mama Paramanand Marg': 'deco-avenue', 'Horniman Circle': 'heritage-boulevard',
  'Chhatrapati Shivaji Maharaj Marg': 'heritage-boulevard', 'Gopalrao Deshmukh Marg': 'deco-avenue', 'Dr Dadasaheb Bhadkamkar Marg': 'electronics-strip',
  'Lala Lajpatrai Marg': 'arterial-mixed', 'Abdul Rehman Street': 'bazaar-wholesale', 'Kalbadevi Road': 'kalbadevi-gully', 'Bhuleshwar Road': 'kalbadevi-gully',
  '2nd Peerkhan Street': 'muslim-quarter-bazaar', 'Ridge Road': 'malabar-hill-ridge', 'P J Ramchandani Marg': 'seafront-boulevard',
}
# long streets that change character along their length: (name, lat_min, lat_max, profile)
ZONES = {
  'Shahid Bhagat Singh Marg': [[18.900, 18.9245, 'colaba-causeway'], [18.9245, 18.9330, 'heritage-boulevard'], [18.9330, 18.9500, 'fort-arcade-commercial']],
  'Maharshi Karve Road': [[18.900, 18.9300, 'deco-avenue'], [18.9300, 18.9450, 'heritage-boulevard'], [18.9450, 18.9600, 'girgaon-chawl-street']],
  "P D' Mello Road": [[18.930, 18.9400, 'fort-arcade-commercial'], [18.9400, 18.9900, 'port-dock-road']],
  'Sardar Vallabhbhai Patel Road': [[18.940, 18.9620, 'bazaar-wholesale'], [18.9620, 18.9800, 'arterial-mixed']],
  'Nanabhai Moos Marg': [[18.880, 18.9060, 'quiet-residential'], [18.9060, 18.9300, 'colaba-causeway']],
  'Dr Babasaheb Ambedkar Marg': [[18.950, 18.9700, 'muslim-quarter-bazaar'], [18.9700, 19.0200, 'byculla-mill-market']],
  'Lokmanya Tilak Road': [[18.940, 18.9600, 'bazaar-wholesale']],
}

def profile_for(s):
    n = s['name']; nl = (n + ' ' + ' '.join(s['variants'])).lower()
    c = s['class_']
    if 'flyover' in nl or (s['bridge'] and s['length_m'] < 800 and c in ('trunk', 'primary', 'secondary', 'motorway', 'link')): return 'flyover-corridor', 'rule:flyover'
    if c in ('footway', 'pedestrian'): return 'pedestrian-promenade', 'rule:class'
    if n in EXPLICIT: return EXPLICIT[n], 'explicit'
    for rx, p in NAME_RULES:
        if p and re.search(rx, nl): return p, 'name-rule'
    if c == 'service': return 'service-lane', 'rule:class'
    d = s['district']
    main, lane = DMAP.get(d, DMAP['Mumbai'])
    if c in ('motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'link'): return main, 'district-main'
    return lane, 'district-lane'

def sv(lat, lon, h):
    return f'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={lat:.6f},{lon:.6f}&heading={h % 360}&pitch=0&fov=80'

from shapely.geometry import LineString as _LS, Point as _Pt
_RAW = RAW
_roads = {r['id']: r for r in _RAW['roads']}
def _street_line_dist(s, la, lo):
    p = _Pt(*proj(la, lo)); d = 1e9
    for wid in s['osm_way_ids']:
        pts = _roads[wid]['pts']
        if len(pts) > 1: d = min(d, _LS([proj(*q) for q in pts]).distance(p))
    return d
NOTE_OF = {}
for n in NOTES:
    toks = set(w for w in re.sub('[^a-z ]', ' ', n['street'].lower()).split() if len(w) > 3 and w not in ('road', 'marg', 'lane', 'street'))
    cands = sorted(((_street_line_dist(s, n['lat'], n['lon']), i) for i, s in enumerate(S_)), key=lambda t: t[0])
    cands = [c for c in cands if c[0] < 40]
    named = [c for c in cands if toks & set(re.sub('[^a-z ]', ' ', (S_[c[1]]['name'] + ' ' + ' '.join(S_[c[1]]['variants'])).lower()).split())]
    pick = (named or cands)[:1]
    if pick: NOTE_OF.setdefault(id(S_[pick[0][1]]), n)
def near_note(s):
    return NOTE_OF.get(id(s))

streets = []
for i, s in enumerate(sorted(S_, key=lambda x: (x['districts'][0], -x['length_m']))):
    la, lo = s['mid']
    nd = new_district(la, lo)
    s['district'] = nd if (s['districts'][0] == 'Mumbai' and nd) else s['districts'][0]
    p, why = profile_for(s)
    z = ZONES.get(s['name'])
    note = near_note(s)
    shop_density = round(s['shops_20m'] * 100 / max(s['length_m'], 50), 1)
    e = dict(key=f"s{i:04d}", name=s['name'], variants=s['variants'], osm_way_ids=s['osm_way_ids'], cls=s['class_'],
             length_m=s['length_m'], lanes=s['lanes'], oneway=s['oneway'], bridge=s['bridge'],
             mid=s['mid'], game_xz=s['game_xz'], bearing=s['bearing'], bbox=s['bbox'],
             district=s['district'], districts=s['districts'], profile=p, profile_source=why,
             zones=[dict(lat=[a, b], profile=q) for a, b, q in z] if z else None,
             stats=dict(buildings_30m=s['buildings_30m'], levels_median=s['levels_median'], levels_tagged=s['levels_tagged'],
                        shops_per_100m=shop_density, food_20m=s['food_20m'], osm_trees_15m=s['trees_osm_15m'], signals=s['signals'],
                        bus_stops=s['bus_stops'], worship_30m=s['worship_30m']),
             surveyed=bool(note), survey=dict(date=note['date'], point=[note['lat'], note['lon']], notes=note['obs']) if note else None,
             streetview=sv(note['lat'], note['lon'], note['heading']) if note else sv(la, lo, s['bearing']))
    streets.append(e)
for e in streets:
    e.pop('bbox', None); e.pop('districts', None)
    if not e['surveyed']: e.pop('streetview', None)
    e.pop('surveyed', None)
    e['stats'] = {k: v for k, v in e['stats'].items() if v not in (0, None)}
    if e['lanes'] is None: del e['lanes']
    if not e['oneway']: del e['oneway']
    if not e['bridge']: del e['bridge']
    if e['zones'] is None: del e['zones']
    if e['survey'] is None: del e['survey']
    if not e['variants']: del e['variants']
key_by_name = {e['name']: e['key'] for e in streets}

# ---- notable buildings: nearest named street (by street line distance is costly; use mid points + bbox)
from shapely.geometry import LineString, Point
from shapely.strtree import STRtree
R = RAW
lines, owner = [], []
roads = {r['id']: r for r in R['roads']}
for e in streets:
    for wid in e['osm_way_ids']:
        r = roads[wid]
        if len(r['pts']) > 1:
            lines.append(LineString([proj(*p) for p in r['pts']])); owner.append(e['key'])
tree = STRtree(lines)
blds = []
for b in NB:
    pt = Point(*b['game_xz'])
    j = tree.nearest(pt)
    d = lines[j].distance(pt)
    nd = new_district(b['lat'], b['lon'])
    rec = dict(id=b['osm_way_id'], name=b['name'], ll=[b['lat'], b['lon']], xz=b['game_xz'], area=b['footprint_m2'],
               lv=b['levels'], b=b['building'], tags=b['tags'], district=(nd if b['district'] == 'Mumbai' and nd else b['district']),
               street=owner[j], street_d=round(d))
    KEEP = ('amenity', 'historic', 'heritage', 'tourism', 'religion', 'start_date', 'architect', 'wikidata')
    TYPES = {'mosque', 'church', 'temple', 'school', 'college', 'university', 'hotel', 'hospital', 'public', 'civic', 'government', 'train_station',
             'cathedral', 'chapel', 'synagogue', 'museum', 'stadium', 'office', 'commercial', 'retail'}
    rec['tags'] = {k: v for k, v in (rec['tags'] or {}).items() if k in KEEP}
    if not (rec['tags'] or rec['b'] in TYPES): continue
    rec['ll'] = [round(rec['ll'][0], 5), round(rec['ll'][1], 5)]
    if not rec['name']: del rec['name']
    if not rec['tags']: del rec['tags']
    if rec['lv'] is None: del rec['lv']
    blds.append(rec)

json.dump(streets, open(os.path.join(LIB,'streets.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(blds, open(os.path.join(LIB,'buildings-notable.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(streets), 'streets,', len(blds), 'notable buildings')
