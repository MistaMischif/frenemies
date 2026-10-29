from pathlib import Path
import json,io,copy,shutil
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A3,landscape,letter
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader,PdfWriter,Transformation
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/pdf';OUT.mkdir(parents=True,exist_ok=True)
data=json.loads((ROOT/'public/territory-map.json').read_text());MAP=data['territories'];FIG=data['figures'];INK='#263d2c';PAPER='#f2eedf';GREEN='#506b42';RUST='#a05c40'
style=ParagraphStyle('body',fontName='Helvetica',fontSize=11,leading=15,textColor=HexColor(INK))
small=ParagraphStyle('small',parent=style,fontSize=9,leading=12)
def txt(c,text,x,y,size=12,color=INK):c.setFont('Helvetica-Bold',size);c.setFillColor(HexColor(color));c.drawString(x,y,text)
def box(c,x,y,w,h,fill=PAPER):c.setLineWidth(1);c.setFillColor(HexColor(fill));c.setStrokeColor(HexColor('#7e9167'));c.roundRect(x,y,w,h,8,fill=1,stroke=1)
def para(c,text,x,y,w,st=style):p=Paragraph(text,st);_,h=p.wrap(w,1200);p.drawOn(c,x,y-h);return y-h-14
def art(c,path,x,y,w,h):c.drawImage(ImageReader(str(ROOT/'public'/path)),x,y,w,h,preserveAspectRatio=True,anchor='c',mask='auto')
def page(c,title,n):c.setFillColor(HexColor(PAPER));c.rect(0,0,612,792,fill=1,stroke=0);txt(c,'FRENEMIES / C2G TERRITORIES / PHYSICAL PROTOTYPE 0.2',30,756,9,GREEN);txt(c,title,30,720,25);txt(c,'C2G ART ONLY / FRENEMIES 1.5.0',30,20,8);txt(c,str(n),565,20,9)
def rules(c,title,sections,n):
 page(c,title,n);y=682
 for heading,body in sections:txt(c,heading,30,y,13,GREEN);y=para(c,body,30,y-12,552)-8
 assert y>40,(title,y)
 c.showPage()
# Board: exactly 75 mm between territory centers in both dimensions.
W,H=landscape(A3);cell=75*72/25.4;ox=28;oy=94;b=canvas.Canvas(str(OUT/'frenemies-territory-board-a3.pdf'),pagesize=(W,H));b.setTitle('Frenemies C2G territory board - 75 mm grid')
b.setFillColor(HexColor(PAPER));b.rect(0,0,W,H,fill=1,stroke=0);txt(b,'FRENEMIES / CRADLE TO THE GRAVE',ox,H-40,28);txt(b,'TERRITORY CAMPAIGN / MOVE - SCAVENGE - CRAFT - FIGHT',ox,H-65,12,GREEN)
for t in MAP:
 x=ox+t['x']*cell;y=oy+(2-t['y'])*cell
 for neighbor in [n for n in t['neighbors'] if n>t['id']]:
  other=next(q for q in MAP if q['id']==neighbor);x2=ox+other['x']*cell;y2=oy+(2-other['y'])*cell;b.setStrokeColor(HexColor('#a9b989'));b.setLineWidth(7);b.line(x+cell/2,y+cell/2,x2+cell/2,y2+cell/2)
for t in MAP:
 x=ox+t['x']*cell;y=oy+(2-t['y'])*cell;owner='Human' if t['id'] in ['A3','B3','C3'] else 'Zombie' if t['id'] in ['B1','C1','D1'] else 'Unclaimed';box(b,x+6,y+6,cell-12,cell-12,'#e7d6bd' if owner=='Human' else '#d1dfbe' if owner=='Zombie' else '#e6e8d1')
 txt(b,t['id']+' / '+t['name'],x+16,y+cell-27,11);txt(b,'START: '+owner.upper(),x+16,y+cell-44,8)
 image='environments/c2g/rock.png' if t['id']=='D3' else 'environments/c2g/Map_zone1_house01.png' if t['clinic'] or t['workshop'] or t['id'] in ['A1','A3','B1','D1','D2'] else 'environments/c2g/Map_zone1_trees02.png' if t['resource']=='bipod' else 'environments/c2g/Map_zone1_trees03.png'
 art(b,image,x+150,y+76,47,87);b.setStrokeColor(HexColor(GREEN));b.setLineWidth(1);b.circle(x+cell/2,y+cell/2,27,stroke=1,fill=0);start=next((f['id'] for f in FIG if f['home']==t['id']),'FIGURE');txt(b,start,x+cell/2-(8 if start!='FIGURE' else 21),y+cell/2-4,11)
 txt(b,'SALVAGE: '+t['resource'].upper(),x+16,y+43,9);txt(b,'STOCK  2 / 1 / 0',x+16,y+25,9)
sx=ox+cell*4+12;sw=W-sx-20;txt(b,'THE EXPEDITION',sx,H-110,14)
y=para(b,'Humans act first.<br/>2 actions per faction turn.<br/>8 rounds maximum.<br/><br/><b>Victory:</b> own 8 territories at the end of your turn. At round 8 end, most territories wins; equal counts draw.',sx,H-128,sw,small)
y=para(b,'Only printed connections permit movement or adjacent attacks. A territory holds one figure. Enemy empty territory still has one garrison unit.',sx,y,sw,small)
for title,body in [('ROUND','1  2  3  4  5  6  7  8'),('ACTIVE FACTION','HUMAN / ZOMBIE'),('ACTIONS LEFT','2 / 1 / 0'),('REFUGE INTEGRITY','________ / 100'),('SHARED SUPPLIES','________ / 99')]:txt(b,title,sx,y-5,9);y=para(b,body,sx,y-16,sw,small)
art(b,'environments/c2g/rock.png',sx,110,sw,60)
txt(b,'HUMAN EDGE / Living Table row 0',ox,60,12);txt(b,'Exact spacing: 75 mm. Board origin: center of the 4 x 3 grid. Print Actual size.',ox,38,10)
b.showPage();b.save()
c=canvas.Canvas(str(OUT/'territory-content.pdf'),pagesize=letter);c.setTitle('Frenemies C2G Territories - playable rules and pieces')
rules(c,'A board you actually explore.',[
 ('The game','Two factions compete over twelve connected territories. Six figures lead squads: Humans H1/H2/H3 and Zombies Z1/Z2/Z3. Each figure is an individual piece with a location, 1-6 units, infection and crafted equipment. Players may share control of their faction. The facilitator records orders; they do not gain an extra army.'),
 ('Prepare the map','Place H1 at A3, H2 at B3, H3 at C3, Z1 at B1, Z2 at C1, Z3 at D1. Each starts with 3 units. Those six territories start owned by their faction; others are unclaimed. Each owned territory has one abstract garrison, used only when no figure is there. Mark 2 salvage stock per territory. Both factions start with 3 reserves and no components.'),
 ('The shared campaign','For a new campaign, refuge integrity is 70 and community supplies are 0. Existing campaign values carry over. In later expeditions, equipment and infection persist; control, stock, reserves and component banks reset. Infected Human figures start off-board for Zombies and may be deployed by them. Non-infected figures start in their original places with 3 units.'),
 ('Print and assemble','The four landscape Letter tiles form an A3 map. Print Actual size with auto-rotate, trim to the rectangles and join the edges. Center spacing is exactly 75 mm. Print figure counters and markers single-sided; use spare card as backing. Supply five ordinary six-sided dice. Cards and paper counters work without an app, toys, electronics or purchases.')],1)
rules(c,'A turn with real choices.',[
 ('Turn order','Humans start. Each faction gets 2 actions, in any combination and with either the same figure or different figures. Before its first action it may draw one world-event card, resolve it, return it and reshuffle. Each accepted figure order costs one action. Invalid orders cost nothing. A faction may End early.'),
 ('Move and claim','Move one of your on-board figures to a connected empty friendly or unclaimed territory. No diagonals, jumps or stacking. Entering an unclaimed territory claims it. Leaving a territory keeps it owned with a one-unit garrison; this does not subtract a unit from your figure. You must Attack an enemy territory, even if no figure occupies it.'),
 ('Scavenge, reinforce, guard','Scavenge the figure\'s current location: remove 1 local stock and gain its printed resource. Components go to your faction bank; supplies go to the shared clinic. Stock never refills during an expedition. Reinforce spends up to 2 reserves to add that many units, up to 6. Guard adds +1 to your highest defense die on the next attack against that figure, capped at 6; then discard it.'),
 ('Turn end and victory','At your turn end, owning 8 territories wins immediately. Otherwise change faction; the incoming faction gains max(1, floor(owned territories / 3)) reserves, up to 12. After Zombies finish, advance the round. After round 8, most owned territories wins; ties draw. Each new faction turn gets 2 actions.'),
 ('Convoy','If a convoy is pending and Humans own the clinic B2 at a turn end, gain 3 shared supplies and clear the objective. Victory and the final round check occur first; an unresolved convoy can remain pending for the next expedition.')],2)
rules(c,'Fight for the next territory.',[
 ('Choose the target','Your attacking figure must have at least 2 units and be adjacent to an enemy-owned territory. A defending figure uses its current units; an empty territory uses its one-unit garrison. Attacking is one action, not an entire fight to the death.'),
 ('Roll, sort, compare','Attacker rolls min(3, attacking units - 1) dice. Defender rolls min(2, defending units) dice. Sort each side from high to low. Compare highest with highest, then second with second if available. Each pair removes 1 unit from the lower die\'s side; ties favor the defender. Unpaired dice do nothing. Apply losses together.'),
 ('Equipment and Frenzy','A support-equipped attacker adds +1 to its highest attack die, capped at 6. A prepared Frenzy adds another +1 to that die, also capped at 6, then is consumed. A guarded defender adds +1 to its highest defense die, capped at 6, then loses Guard. Apply modifiers after sorting; do not reroll.'),
 ('Capture and infection','If the defender reaches 0, remove it from the map. Move the surviving attacking figure into the captured territory and change ownership. A defeated Human figure becomes infected, switches to Zombies and retains its toy identity and equipment. A defeated native Zombie is simply off-board. Surviving defenders stay put; the attacker stays in its origin unless it captures.'),
 ('Deploy','Spend one action and 2 faction reserves to place an off-board figure of your faction with 2 units in any empty territory you own. This includes captured, infected Human figures under Zombie control. No empty owned location means no deployment. A one-unit figure may move, guard or scavenge, but cannot attack.')],3)
rules(c,'Craft. Recover. Remember.',[
 ('Craft at a workshop','Move to B3 or C1. Spend one Launcher, one Bipod and one Sensor from your faction bank and one action to equip that figure with a support weapon. A figure equips only one. Equipment persists through infection, recovery and future expeditions. It grants the attack-die bonus; it does not fire independently.'),
 ('The clinic at B2','Any figure at B2 can spend 1 shared supply and an action to restore up to 2 units, maximum 6. A Human at B2 can instead spend 3 supplies and an action to recover an infected off-board Human figure. The recovered figure becomes Human but remains off-board until deployed. If it is currently fighting for Zombies on the map, defeat it before recovery.'),
 ('Emergency recovery','On the Human turn, if all three Human figures are infected and supplies are below 3, use an action to recover one of them for free at an empty Human-owned territory with 2 units. Lose 10 refuge integrity; if this reaches zero, evacuate and reset integrity to 50. Without an empty Human territory, the order is unavailable. This figure-based condition applies to this mode; the older tabletop mode retains its character-based rule.'),
 ('Expedition result','A Human win adds 10 refuge integrity; a Zombie win subtracts 10; a draw leaves it unchanged. Keep integrity within 0-100; at zero evacuate to 50. Every finished expedition grants 3 supplies (maximum 99) and advances the shared chapter. Figure infection is caused by capture, not automatically by losing the expedition. Begin the next expedition only after recording the result.'),
 ('Persistent identities','Keep each figure\'s ID H1-H3/Z1-Z3 on its base and card. Its canonical ID is c2g-figure-h1 through c2g-figure-z3. Optional physical tags bind to that identity; changing a tag does not create a new character. Keep a paper record of equipment, infection and the campaign when playing offline.')],4)
rules(c,'Twitch and Living Table.',[
 ('One territory rules engine','In Frenemies choose Play C2G Territory Campaign. The browser board is authoritative while connected. Physical players discuss an order; the host enters it. Twitch viewers join !human or !zombie and propose orders such as !move H1 A2, !attack H1 A1, !scavenge H1 or !craft H2. Only the active faction votes; one valid order per viewer per decision. Host resolves the majority. Ties use alphabetical order of the serialized order (action, figure, target).'),
 ('Physical dice and synchronization','The host may enter the exact physical attack and defense dice before pressing Attack, or leave both fields blank for server dice. Never apply both results. Successful orders save the entire map and increment its revision. Stale orders and repeated request IDs cannot execute twice. Twitch votes are temporary and clear after a state change; saved board state survives restart.'),
 ('Twitch events','Subscriptions and gifts add the existing shared clinic supplies. Raids and Hype starts can create the existing convoy objective. Hype contributors give their represented factions one-use Frenzy. Repeated event receipts cannot re-grant a territorial effect. Follows and paid Barrage have no territory effect in this edition. Free world-event cards provide an offline counterpart.'),
 ('Living Table bridge','The read-only state export supplies stable figure IDs, positions, units, equipment, infection and a 4 x 3 board with 0.075 m cells. A paired device can submit an observed physical move; the host must approve a legal adjacent Move. Observations never perform combat or override rules. Existing Living Table scenes are not replaced. Its optional C# adapter requires integration and headset testing; automatic camera/NFC recognition is not included.'),
 ('Prototype boundaries','This is the territory edition, not the older shared-strength duel. Capture, reserves, terrain locations and individual equipment are prototype mechanics to playtest and refine for the wider C2G ecosystem. The companion does not import the separate C2G Unity game\'s saves. It does not claim production toy electronics or a finished Quest build.')],5)
# Cuttable character standees/cards.
page(c,'Your six persistent figures',6)
for i,f in enumerate(FIG):
 x=30+(i%3)*184;y=390-(i//3)*270;box(c,x,y,176,260);txt(c,f['id']+' / '+('HUMAN' if f['team']=='red' else 'ZOMBIE'),x+12,y+239,12);art(c,'characters/'+f['art']+'.png',x+28,y+105,120,125)
 para(c,f"<b>{f['toyId']}</b><br/>Units: 0 1 2 3 4 5 6<br/>Equipped: YES / NO<br/>Infected: YES / NO<br/>Location: ______",x+12,y+95,152,small)
c.showPage();page(c,'Figure counters / cut the circles',7)
para(c,'Use these flat pieces now; keep their matching cards beside the board. The same IDs can later identify physical toys. Circles are 40 mm across and fit inside the 75 mm territories.',30,682,552)
for i,f in enumerate(FIG):
 cx=120+(i%3)*186;cy=535-(i//3)*210;r=20*72/25.4;c.setFillColor(HexColor('#e7d6bd' if f['team']=='red' else '#d1dfbe'));c.setStrokeColor(HexColor(GREEN));c.circle(cx,cy,r,fill=1,stroke=1);art(c,'characters/'+f['art']+'.png',cx-35,cy-35,70,85);txt(c,f['id'],cx-8,cy-r+8,10)
c.showPage();page(c,'World-event cards / reshuffle',8)
events=[('CONVOY','Set one pending convoy. If one is already pending, do not stack rewards.','environments/c2g/Map_zone1_house01.png'),('CLINIC SUPPLY','Add 1 shared supply, maximum 99.','characters/char02V01.png'),('HUMAN FRENZY','Humans prepare +1 highest attack die on their next attack, capped at 6. No stacking.','characters/char01V01.png'),('ZOMBIE FRENZY','Zombies prepare +1 highest attack die on their next attack, capped at 6. No stacking.','characters/zmb01V03.png'),('REINFORCEMENTS','Both factions gain 1 reserve, maximum 12 per faction.','characters/char03V01.png'),('QUIET WATCH','No immediate effect. Choose your first action.','environments/c2g/Map_zone1_trees03.png')]
for i,(title,body,image) in enumerate(events):
 x=30+(i%3)*184;y=390-(i//3)*270;box(c,x,y,176,260);txt(c,title,x+12,y+236,11);art(c,image,x+23,y+124,130,100);para(c,body,x+12,y+105,152,small)
c.showPage();page(c,'Resources and control markers',9)
labels=['H CONTROL']*12+['Z CONTROL']*12+['LAUNCHER','BIPOD','SENSOR']*4+['SUPPLY 1','SUPPLY 3','RESERVE 1','RESERVE 3']*3+['GUARD','FRENZY','INFECTED','EQUIPPED']*3
for i,label in enumerate(labels):
 x=30+(i%6)*92;y=635-(i//6)*55;box(c,x,y,86,48);txt(c,label,x+6,y+20,7)
c.showPage();page(c,'The expedition record',10)
y=680
for title,body in [('Campaign','Name __________ Chapter ____ Expedition ____ Round ____ Active side ____ Actions ____'),('Shared refuge','Integrity ____ Supplies ____ Convoy pending: YES / NO'),('Faction reserves','Humans ____ / 12     Zombies ____ / 12'),('Crafting banks','Humans L____ B____ S____     Zombies L____ B____ S____')]:txt(c,title,30,y,12);y=para(c,body,30,y-14,552,small)
for i,f in enumerate(FIG):
 box(c,30,y-58,552,50);para(c,f"<b>{f['id']}</b>  Location ____ Units ____ Faction ____ Infected Y/N ____ Equipped Y/N ____<br/>Physical tag _____________________________________________________",40,y-18,532,small);y-=62
para(c,'Mark ownership and remaining salvage on the board. Record final outcome and recovery choices on the back. In connected play, the server saves the full map after every accepted order; offline paper records are not automatically imported.',30,y-5,552,small);c.showPage();c.save()
master=PdfReader(str(OUT/'frenemies-territory-board-a3.pdf')).pages[0];source=PdfReader(str(OUT/'territory-content.pdf'));writer=PdfWriter()
for p in source.pages[:5]:writer.add_page(p)
for row in range(2):
 for col in range(2):
  p=copy.deepcopy(master);x0=col*W/2;y0=(1-row)*H/2;p.cropbox.lower_left=(x0,y0);p.cropbox.upper_right=(x0+W/2,y0+H/2)
  tile=writer.add_blank_page(width=792,height=612);tile.merge_transformed_page(p,Transformation().translate(-x0,-y0).translate(98,95))
  mem=io.BytesIO();mark=canvas.Canvas(mem,pagesize=(792,612));txt(mark,f"TERRITORY BOARD / {'TOP' if row==0 else 'BOTTOM'} {'LEFT' if col==0 else 'RIGHT'}",98,554,12);txt(mark,'Actual size. Trim rectangle. Territory spacing must measure 75 mm.',98,535,9);mark.setStrokeColor(HexColor(GREEN));mark.rect(98,95,W/2,H/2);mark.showPage();mark.save();mem.seek(0);tile.merge_page(PdfReader(mem).pages[0])
for p in source.pages[5:]:writer.add_page(p)
writer.add_metadata({'/Title':'Frenemies C2G Territories - physical prototype 0.2'})
with open(OUT/'frenemies-territory-kit.pdf','wb') as f:writer.write(f)
shutil.copy2(OUT/'frenemies-territory-kit.pdf',ROOT/'public/territory-rules.pdf');shutil.copy2(OUT/'frenemies-territory-board-a3.pdf',ROOT/'public/territory-board.pdf')
print('Territory kit:',len(writer.pages),'pages; board spacing:',cell,'points / 75 mm')
