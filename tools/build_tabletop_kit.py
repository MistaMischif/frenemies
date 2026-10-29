"""Reproducible print-and-play layout. Artwork is only supplied C2G PNGs."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A3, landscape, letter
from reportlab.lib.colors import HexColor
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader, PdfWriter, Transformation
import copy, hashlib, shutil, io
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'output/pdf'; OUT.mkdir(parents=True,exist_ok=True)
INK='#233c35'; GREEN='#4c6849'; PAPER='#f4f0e4'; MUTED='#65725e'; RED='#a65339'
styles={k:ParagraphStyle(k,fontName='Helvetica',fontSize=size,leading=size*1.36,textColor=HexColor(INK)) for k,size in [('body',10.5),('small',8.5),('card',10)]}
def box(c,x,y,w,h,fill=PAPER,stroke='#a7b299',r=8):
 c.setFillColor(HexColor(fill));c.setStrokeColor(HexColor(stroke));c.roundRect(x,y,w,h,r,fill=1,stroke=1)
def label(c,text,x,y,size=12,color=INK,font='Helvetica-Bold'):
 c.setFont(font,size);c.setFillColor(HexColor(color));c.drawString(x,y,text)
def para(c,text,x,y,w,style='body'):
 p=Paragraph(text,styles[style]);_,h=p.wrap(w,1000);p.drawOn(c,x,y-h);return y-h-12
def art(c,path,x,y,w,h):
 p=ROOT/'public'/path
 if p.exists(): c.drawImage(ImageReader(str(p)),x,y,w,h,preserveAspectRatio=True,anchor='c',mask='auto')
def page(c,title,kicker='FRENEMIES / CRADLE TO THE GRAVE',number=None):
 c.setFillColor(HexColor(PAPER));c.rect(0,0,612,792,fill=1,stroke=0)
 label(c,kicker,36,754,9,GREEN);label(c,title,36,719,26)
 c.setStrokeColor(HexColor('#a7b299'));c.line(36,700,576,700)
 label(c,'PHYSICAL PROTOTYPE 0.1 / FRENEMIES 1.4.0 / COLTRAN STUDIOS ART',36,22,7,MUTED)
 if number:label(c,str(number),563,22,8,MUTED)
def rules_page(c,title,sections,n):
 page(c,title,number=n);y=677
 for heading,text in sections:
  label(c,heading,36,y,13,GREEN);y-=12;y=para(c,text,36,y,540)-12
 assert y>40,(title,y)
 c.showPage()
# Master board: A3 landscape. Zones organize play; no movement spaces implied.
bw,bh=landscape(A3);board=OUT/'frenemies-board-a3.pdf';b=canvas.Canvas(str(board),pagesize=(bw,bh));b.setTitle('Frenemies - C2G physical battle board')
b.setFillColor(HexColor(PAPER));b.rect(0,0,bw,bh,fill=1,stroke=0)
art(b,'environments/c2g/Map_zone1_ground.png',0,0,bw,bh)
box(b,20,20,bw-40,bh-40,'#e8ead6',GREEN,14)
box(b,32,bh-160,bw-64,128,'#70835b',GREEN)
art(b,'environments/c2g/Map_zone1_trees01.png',35,bh-175,200,160);art(b,'environments/c2g/Map_zone1_trees02.png',bw-220,bh-175,190,160)
label(b,'FRENEMIES',bw/2-125,bh-73,34,'#ffffff');label(b,'CRADLE TO THE GRAVE',bw/2-112,bh-99,16,'#ffffff');label(b,'WOODLAND APPROACH / PHYSICAL EDITION',bw/2-145,bh-125,11,'#f3f3dc')
def strength(y,title,character,color):
 box(b,40,y,bw-80,94,'#f8f5e9');art(b,character,48,y+4,70,86);label(b,title,128,y+68,17,color)
 label(b,'TENS',128,y+44,8);label(b,'ONES',128,y+18,8)
 for i in range(11):
  x=175+i*66;box(b,x,y+34,48,22,'#ffffff',r=3);label(b,str(i*10),x+12,y+40,10)
 for i in range(10):
  x=175+i*35;box(b,x,y+7,27,20,'#ffffff',r=3);label(b,str(i),x+10,y+13,9)
 label(b,'+ HALF',540,y+13,9);label(b,'SHIELD',700,y+13,9);label(b,'SURGE: READY / ROUND ____',850,y+13,9)
strength(bh-264,'ZOMBIE STRENGTH','characters/zmb01V02.png',GREEN)
box(b,40,300,bw-80, bh-576,'#f9f6e9')
label(b,'SHARED BATTLEFIELD',bw/2-130,bh-303,22)
for x,title in [(95,'HUMAN ACTION'),(bw-275,'ZOMBIE ACTION')]:
 box(b,x,306,180,252,'#e3e8d1');label(b,title,x+20,538,12);label(b,'PLACE WINNING CARD',x+18,320,9)
label(b,'CURRENT OBJECTIVE',bw/2-90,440,12);b.setStrokeColor(HexColor(GREEN));b.line(bw/2-155,412,bw/2+155,412)
label(b,'ROUND',bw/2-25,387,10)
for i in range(12):
 x=bw/2-202+i*34;box(b,x,343,29,26,'#ffffff',r=3);label(b,str(i+1),x+8,351,10)
for x,title,text in [(40,'OUTSKIRTS','EVENT CARD / CONVOY'),(bw/3+10,'SETTLEMENT','INTEGRITY ____ / SUPPLIES ____'),(2*bw/3-20,'CLINIC','RECOVERY COST: 3 SUPPLIES')]:
 box(b,x,184,bw/3-30,101,'#dbe1c5');label(b,title,x+16,257,16);label(b,text,x+16,234,10)
art(b,'environments/c2g/Map_zone1_house01.png',bw/3+235,188,65,70)
label(b,'One optional draw per round.',56,210,10);label(b,'All infected and fewer than 3 supplies:',2*bw/3-4,213,9);label(b,'Recover one; lose 10 integrity.',2*bw/3-4,198,9)
strength(73,'HUMAN STRENGTH','characters/char01V01.png',RED)
label(b,'Strength = tens + ones + half marker. Start 100. Scenery has no movement or terrain effects.',40,45,10)
label(b,'C2G ART / PROTOTYPE 0.1',bw-230,45,9);b.showPage();b.save()
kitbase=OUT/'kit-content.pdf';c=canvas.Canvas(str(kitbase),pagesize=letter);c.setTitle('Frenemies - complete physical prototype and Twitch companion rules')
rules_page(c,'Bring your friends home.',[
 ('A playable campaign for 2-12 people','Humans and Zombies share their own strength pools. Each person has a named, persistent character and four action cards. Both factions need at least one player to begin. One person facilitates; they may play a character offline, but the Twitch broadcaster account is excluded from chat play.'),
 ('What to print','Print the four landscape tiled board pages at 100% / Actual size (auto-rotate), trim to their borders and join matching edges. Or print the separate A3 board at Actual size. Print the action-card sheet once per player. Print character sheets as needed, plus one copy of event, encounter, crafting, token and journal pages. Cards are 2.5 x 3.5 inches. Paper sleeves and scrap card backing are optional.'),
 ('Only your C2G artwork','All illustrations are original supplied Cradle to the Grave assets: characters, trees, grass, houses, rocks, equipment and enemy portraits. No stock or generated artwork. Printed boxes, text and tracks are functional layout. The Mega Mech card uses an existing C2G support-weapon emblem, not an invented boss portrait.'),
 ('Set up chapter one','Start both strength pools at 100, settlement integrity at 70 and supplies at 0. Each player names a character and chooses Human or Zombie. Give each player Attack, Defend, Heal and Surge. Start the Woodland encounter, round 1. Shuffle the six event cards. No equipment is owned initially.'),
 ('Two speeds, one campaign','Offline: the paper journal is authoritative. Connected: the companion resolves rounds and records the channel campaign; paper is a display. Do not also apply the printed arithmetic to the server. A self-hosted local companion needs no Twitch account or paid service. Prototype rules are playtest values, not claims of shipped C2G combat.')],1)
rules_page(c,'One round at the table.',[
 ('1 / Prepare and choose','Apply the encounter condition for this round. Optionally draw one event card, resolve it, then return it to the deck and reshuffle. Players discuss, choose one action face down, and reveal together. Count each person once. Everyone who has taken an action this battle remains a participant for its duration.'),
 ('2 / Find each majority','Each faction executes its most-voted action. Ties prioritize Attack, then Defend, then Heal, then Surge. A faction with no votes takes no action. In a connected game, Twitch viewers vote using !attack, !defend, !heal or !surge; the first accepted vote counts until the host reveals.'),
 ('3 / Prepare, then strike','Resolve both teams\' Defend, Heal and Surge first. Then calculate both attacks from that same state and apply damage simultaneously. A knockout ends the battle; simultaneous knockouts draw. At the end of round 12, higher strength wins; ties use participating players, then draw.'),
 ('4 / Advance','Move the round marker. Surge can recharge three rounds after its last successful charge: charged in round 1, available again in round 4. Set its ready-round marker immediately. Choosing Surge too early wastes that faction\'s action. Shields and unspent Surge persist until consumed, but never stack.'),
 ('Track precisely','Attack damage can end in .5 after a shield. Keep the half-strength marker; do not round. Strength = tens + ones + optional half. Example: 92.5 uses tens 90, ones 2 and half. At 100, use tens 100 and ones 0. Counters, equipment and records on paper must match the companion when connected.')],2)
rules_page(c,'Actions and support.',[
 ('Attack','Normal damage = (5 + your participating players), doubled if Surge is ready. Add +2 if your faction has a crafted support weapon, +3 if Frenzy is ready, and +3 if it has a Barrage charge. Cap this total at 25. An opposing shield halves it, then is consumed. Consume Surge, Frenzy and one Barrage charge on Attack, even if a mole is underground and damage becomes zero.'),
 ('Defend / Heal / Surge','Defend: prepare one shield against the next hit. Heal: restore 3 + floor(participants / 2), at most 15, never above 100 strength. Surge: prepare double base damage on the next Attack, with a three-round recharge. None of these effects stacks with itself.'),
 ('Crafting','After every tabletop battle with participants, both factions gain one component: Launcher after the first, Bipod after the second, Sensor after the third, then repeat. Between battles, consume one of each to equip a support weapon. Each faction may equip one; it persists for the campaign. Extra components can be kept but provide no further bonus.'),
 ('Frenzy and Barrage','Frenzy is a one-use +3 Attack bonus. A new Frenzy replaces, rather than stacks with, an existing one. An earned Barrage sets that faction to three charges; one charge adds +3 to each of its next three Attacks. Charges and Frenzy expire at battle end. This tabletop version has no Bits purchases or paid Barrage shots.'),
 ('Twitch effects','In tabletop pace, eligible follows heal +2; subscriptions can charge Surge, and subscription/gift events add clinic supplies. Raids/Hype can create a convoy; represented Hype teams gain Frenzy. Existing follow protection applies. Supply Drop heals both +5. Freeze skips the next reveal; reveal even with no votes. Fog has no extra effect because votes are already hidden. Offline events use the same resource and objective rules.')],3)
rules_page(c,'Consequences that stay.',[
 ('After a battle','Human victory: settlement +10. Zombie victory: settlement -10. Draw: no integrity change. Keep integrity within 0-100. A battle with participants earns 3 shared supplies (maximum 99). Human victory with a convoy earns 3 additional supplies, then the convoy is cleared. Empty battles yield no supplies or equipment.'),
 ('Infection and recovery','Participating Humans become infected after a Zombie victory. An infected character must join Zombies next battle. Between battles, spend 3 community supplies to recover one infected character; they can return to Humans. Absence does not harm a character. Each participated chapter advances Recruit to Survivor; at five, Veteran. Rank currently grants no stat bonus.'),
 ('Approved emergency rule','Between battles, if every registered character is infected and supplies are below 3, recover one volunteer for free. Lose 10 settlement integrity and record the emergency. This is not available merely because one team has no seated players. If integrity reaches zero, evacuate and establish a refuge at 50. Regular rescue remains preferred whenever affordable.'),
 ('The 100-chapter framework','Mark one numbered space per completed campaign chapter. This is a record of a long campaign, not 100 different authored encounters. Tabletop encounters unlock after 0, 1, 2 and 4 completed tabletop battles: Woodland, Moles, Shields, Mega Mech. Choose any unlocked encounter between battles. The printable journal supports continuation beyond 100 by starting another sheet.'),
 ('The living chronicle','Record names, chapter counts, wins, infection, rescues, strength result, settlement, supplies, components, equipped support and convoy outcome. At zero integrity, record the evacuation before resetting to 50. There is no permanent death or forced retirement in this edition.')],4)
rules_page(c,'Connect the physical table.',[
 ('Local companion','Run the Frenemies 1.4.0 build (Node.js 22+, npm ci, npm start). Open http://localhost:3000 and choose Start physical tabletop companion. On this project computer use port 3005. The local campaign saves to DATA_DIR. Re-seat existing names after a restart. Mid-battle state is not restart-safe; finish a chapter before shutting down.'),
 ('Same Twitch room','For a channel campaign, sign into Twitch through Frenemies, then open /tabletop from stream controls. Select an unlocked encounter and Use tabletop pace between battles. Seat physical players. Viewers join in chat. Do not represent the same person both at the table and in chat: that would create two identities and two votes.'),
 ('Resolve once','Start a battle. The host enters revealed physical cards and presses Resolve simultaneous round. Chat votes collected since the previous reveal are included. The server is authoritative, the board refreshes every two seconds, and the existing stream overlay receives the same state. Optional Mega Mech orders are entered by the host after the Zombie team chooses its majority order.'),
 ('Offline and hosted demo limits','The paper game needs no app, internet, purchase or account. Hosted demo rooms are temporary; Download campaign journal before leaving. Local tabletop and real Twitch campaign records persist, but battle progress does not. Journal export is a readable backup, not an automatic import or reconciliation feature. Never apply an offline result again to a live campaign.'),
 ('Test this edition','Play three battles with equal teams. Record rounds played, actions chosen, first-player confusion, recovery choices and crafting timing. Test each encounter before adjusting balance. Keep the 12-round and three-round Surge values marked as prototype settings. Real Twitch Bits onboarding is a separate unresolved dependency, not required by this board game.')],5)
def card(x,y,title,body,img=None,tag='ACTION',foot='FRENEMIES / C2G'):
 box(c,x,y,180,252,'#fffdf5',GREEN,9);box(c,x+7,y+211,166,33,GREEN,GREEN,4);label(c,tag,x+16,y+231,7,'#e6e9d9');label(c,title,x+16,y+216,12,'#ffffff')
 if img:art(c,img,x+18,y+119,144,83)
 yy=y+111 if img else y+196
 bottom=para(c,body,x+14,yy,152,'card');assert bottom>=y+22,(title,bottom,y)
 label(c,foot,x+13,y+11,6.5,MUTED)
def cards_page(title,cards,n):
 page(c,title,number=n)
 for i,v in enumerate(cards):card(36+(i%3)*180,425-(i//3)*264,**v)
 c.showPage()
actions=[dict(title='ATTACK',body='Deal 5 + participants.<br/>Surge doubles the base.<br/>Add equipment / Frenzy / Barrage.<br/><b>Cap 25; shield halves.</b>',img='tabletop-assets/launcher.png'),dict(title='DEFEND',body='Prepare one shield.<br/><br/>Halve the next incoming hit, then remove the shield.<br/><b>No stacking.</b>',img='tabletop-assets/shielded.png'),dict(title='HEAL',body='Restore 3 + half your participants, rounded down.<br/><b>Maximum 15 healing.</b><br/>Never exceed 100 strength.',img='characters/char02V01.png'),dict(title='SURGE',body='Double base damage on your next Attack.<br/><br/>Recharge after 3 rounds.<br/><b>No stacking.</b>',img='tabletop-assets/sensor.png')]
cards_page('Action cards / print per player',actions,6)
characters=['char01V01','char02V01','char03V01','zmb01V01','zmb01V02','zmb01V03','zmb01V04']
for index,group in enumerate([characters[:6],characters[6:]]):
 cards_page('Persistent character cards', [dict(title='NAME: __________',body='Faction: __________<br/>Chapters: ____ Wins: ____<br/>Recruit / Survivor / Veteran<br/>Infected: YES / NO<br/>Rescues: ____',img='characters/'+name+'.png',tag='CHARACTER') for name in group],7+index)
cards_page('Event deck / shuffle after drawing',[
 dict(title='REINFORCEMENTS',body='Both factions restore 2 strength, up to 100. Apply immediately.',img='characters/char01V01.png',tag='EVENT'),
 dict(title='RESCUE CONVOY',body='Set one convoy objective. Next played battle: Human win earns +3 supplies. No stacking.',img='environments/c2g/Map_zone1_house01.png',tag='EVENT'),
 dict(title='FRENZY',body='Both factions prepare +3 on their next Attack, within the 25 cap. One-use; no stacking.',img='characters/zmb01V03.png',tag='EVENT'),
 dict(title='BARRAGE CACHE',body='Both factions set Barrage to 3 charges. Each next Attack consumes one for +3, capped at 25.',img='tabletop-assets/launcher.png',tag='EVENT'),
 dict(title='CLINIC SUPPLIES',body='Add 1 shared supply. Maximum 99. Save it for recovery between battles.',img='environments/c2g/Map_zone1_house01.png',tag='EVENT'),
 dict(title='QUIET WATCH',body='No immediate effect. The teams choose their actions as normal.',img='environments/c2g/Map_zone1_trees03.png',tag='EVENT')],9)
cards_page('Encounter deck / choose one',[
 dict(title='WOODLAND',body='Always available.<br/><br/>Before rounds 4 and 8, both factions gain a shield as a new wave arrives.',img='environments/c2g/Map_zone1_trees01.png',tag='ENCOUNTER / 1'),
 dict(title='MOLE AMBUSH',body='After 1 tabletop battle.<br/>Odd rounds: Human attacks deal zero against underground Zombies.<br/>Even rounds: revealed.',img='tabletop-assets/mole.png',tag='ENCOUNTER / 2'),
 dict(title='SHIELD FORMATION',body='After 2 tabletop battles.<br/>Before rounds 1, 5 and 9: Zombies gain a shield; Humans gain one-use Frenzy.',img='tabletop-assets/shielded.png',tag='ENCOUNTER / 3'),
 dict(title='MEGA MECH',body='After 4 tabletop battles.<br/>Instead of its action, Zombie majority chooses Missile (charge +3 next Attack, twice) or Brace (shield, once).',img='tabletop-assets/support.png',tag='ENCOUNTER / PROTOTYPE')],10)
cards_page('Crafting bench / use faction markers',[
 dict(title='GRENADE LAUNCHER',body='Component.<br/>Gain after tabletop battles 1, 4, 7 ...<br/>Combine with Bipod and Sensor.',img='tabletop-assets/launcher.png',tag='CRAFTING'),
 dict(title='BIPOD',body='Component.<br/>Gain after tabletop battles 2, 5, 8 ...<br/>Combine with Launcher and Sensor.',img='tabletop-assets/bipod.png',tag='CRAFTING'),
 dict(title='MOTION SENSOR',body='Component.<br/>Gain after tabletop battles 3, 6, 9 ...<br/>Combine with Launcher and Bipod.',img='tabletop-assets/sensor.png',tag='CRAFTING'),
 dict(title='HUMAN SUPPORT',body='Consume all 3 components.<br/>Persistent +2 to normal Attack, within the 25 cap.<br/>One equipped per faction.',img='tabletop-assets/support.png',tag='EQUIPMENT'),
 dict(title='ZOMBIE SUPPORT',body='Consume all 3 components.<br/>Persistent +2 to normal Attack, within the 25 cap.<br/>One equipped per faction.',img='tabletop-assets/support.png',tag='EQUIPMENT'),
 dict(title='COMPONENT BANK',body='Humans: L___ B___ S___<br/><br/>Zombies: L___ B___ S___<br/><br/>Record exact quantities in the journal.',img=None,tag='CRAFTING')],11)
page(c,'Cut-out counters',number=12)
tokens=['H TENS','H ONES','H HALF','Z TENS','Z ONES','Z HALF','ROUND','CONVOY','H SHIELD','Z SHIELD','H SURGE','Z SURGE','H FRENZY','Z FRENZY','H BARRAGE 1','H BARRAGE 2','H BARRAGE 3','Z BARRAGE 1','Z BARRAGE 2','Z BARRAGE 3']+['SUPPLY 1']*10+['SUPPLY 3']*5+['INFECTED']*10
for i,text in enumerate(tokens):
 x=36+(i%5)*108;y=625-(i//5)*62;box(c,x,y,100,52,'#fffdf5',GREEN,4);label(c,text,x+8,y+23,8)
para(c,'H = Humans. Z = Zombies. Use spare paper markers for higher supply totals and round-number cooldowns. Mark a Surge ready round in pencil; erase when consumed.',36,55,540,'small');c.showPage()
page(c,'The 100-chapter chronicle',number=13)
para(c,'Campaign: ____________________  Start date: __________  Tabletop encounters completed: ____<br/>Mark every completed campaign chapter. This is a progression record, not 100 unique scenarios.',36,678,540)
for i in range(100):
 x=36+(i%10)*54;y=570-(i//10)*42;box(c,x,y,48,36,'#fffdf5',r=3);label(c,str(i+1),x+10,y+14,11)
para(c,'Current integrity: ____ / 100    Supplies: ____ / 99    Convoy pending: YES / NO<br/>Human components: Launcher ____ Bipod ____ Sensor ____ Support equipped: YES / NO<br/>Zombie components: Launcher ____ Bipod ____ Sensor ____ Support equipped: YES / NO',36,165,540)
para(c,'Continue past 100 on another sheet. Chapter numbering and tabletop encounter count are different: real-time Twitch chapters also advance the campaign, but only tabletop battles grant these prototype components.',36,80,540,'small');c.showPage()
page(c,'The living campaign journal',number=14)
para(c,'Copy this page as needed. Record recovery decisions as well as victories. Keep individual character cards with this journal.',36,677,540)
for i in range(5):
 y=527-i*103;box(c,36,y,540,94,'#fffdf5',r=4)
 para(c,'Chapter ____  Encounter __________  Winner __________  Rounds ____<br/>Integrity ____ Supplies ____ Convoy __________ Components gained __________<br/>Infected _____________________ Recovered _____________________<br/>Story / emergency / evacuation ___________________________________',48,y+80,516,'small')
c.showPage();c.save()
# Four printable Letter tiles, with clipping in PDF space, preserve original art.
master=PdfReader(str(board)).pages[0];writer=PdfWriter();content=PdfReader(str(kitbase))
for p in content.pages[:5]:writer.add_page(p)
for row in range(2):
 for col in range(2):
  p=copy.deepcopy(master);x0=col*bw/2;y0=(1-row)*bh/2
  p.cropbox.lower_left=(x0,y0);p.cropbox.upper_right=(x0+bw/2,y0+bh/2)
  tile=writer.add_blank_page(width=792,height=612)
  tile.merge_transformed_page(p,Transformation().translate(-x0,-y0).translate(98,95))
  stamp=io.BytesIO();sc=canvas.Canvas(stamp,pagesize=(792,612))
  label(sc,f"BOARD TILE {row*2+col+1} / {'TOP' if row==0 else 'BOTTOM'} {'LEFT' if col==0 else 'RIGHT'}",98,554,12)
  label(sc,'Print Actual size. Trim to the rectangle and join matching edges. Finished board: A3.',98,534,9)
  sc.setStrokeColor(HexColor(GREEN));sc.rect(98,95,bw/2,bh/2,fill=0,stroke=1);sc.showPage();sc.save();stamp.seek(0)
  tile.merge_page(PdfReader(stamp).pages[0])
for p in content.pages[5:]:writer.add_page(p)
writer.add_metadata({'/Title':'Frenemies: Cradle to the Grave - Physical prototype 0.1','/Author':'COLTRAN Studios / Frenemies'})
with open(OUT/'frenemies-print-and-play.pdf','wb') as f:writer.write(f)
shutil.copy2(OUT/'frenemies-print-and-play.pdf',ROOT/'public/tabletop-kit.pdf');shutil.copy2(board,ROOT/'public/tabletop-board.pdf')
print('Created A3 board and',len(writer.pages),'page print-and-play kit')
