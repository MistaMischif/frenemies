// Original C2G artwork, composed for the battle camera. Coordinates are ground
// contact points: rear scenery never enters the player lane at 0.76 * height.
(() => {
  const names = {ground:'Map_zone1_ground.png',oak:'Map_zone1_trees01.png',pine:'Map_zone1_trees02.png',birch:'Map_zone1_trees03.png',house:'Map_zone1_house01.png',rock:'rock.png'};
  const images = {};
  const ready = Promise.all(Object.entries(names).map(([key,name]) => new Promise(resolve => {
    const image = images[key] = new Image();
    image.onload = image.onerror = resolve;
    image.src = '/environments/c2g/' + name;
  })));
  const has = id => id === 'forest' || id === 'ruins';
  const title = id => id === 'forest' ? 'C2G · Woodland clearing' : 'C2G · Settlement outskirts';
  function prop(ctx,key,x,foot,height,alpha=1) {
    const image=images[key];
    if (!image?.complete || !image.naturalWidth) return;
    const width=height*image.naturalWidth/image.naturalHeight;
    ctx.save(); ctx.globalAlpha=alpha;
    ctx.drawImage(image,x-width/2,foot-height,width,height); ctx.restore();
  }
  function background(ctx,w,h,id) {
    if (!has(id)) return false;
    ctx.save();
    const sky=ctx.createLinearGradient(0,0,0,h);
    sky.addColorStop(0,'#182e3b'); sky.addColorStop(.55,'#849888'); sky.addColorStop(1,'#33452a');
    ctx.fillStyle=sky; ctx.fillRect(0,0,w,h);
    // Far treeline: smaller scale, atmospheric contrast, irregular rhythm.
    for (const [x,y,s,key] of [[.01,.48,.30,'pine'],[.12,.46,.25,'birch'],[.23,.49,.32,'oak'],[.36,.47,.24,'pine'],[.46,.46,.20,'birch'],[.57,.48,.26,'oak'],[.70,.46,.24,'pine'],[.82,.49,.31,'birch'],[.95,.47,.29,'oak']])
      prop(ctx,key,x*w,y*h,s*h,.48);
    // Grass is stretched only in the ground plane, never up the sky. Its quiet
    // texture supports feet and shadows without an artificial horizontal grid.
    const ground=images.ground;
    ctx.fillStyle='#506236'; ctx.fillRect(0,h*.46,w,h*.54);
    if (ground?.complete && ground.naturalWidth) ctx.drawImage(ground,0,0,ground.naturalWidth,ground.naturalHeight,0,h*.46,w,h*.54);
    const haze=ctx.createLinearGradient(0,h*.46,0,h);
    haze.addColorStop(0,'#a4af8b66'); haze.addColorStop(.42,'#24362222'); haze.addColorStop(1,'#091c2055');
    ctx.fillStyle=haze; ctx.fillRect(0,h*.46,w,h*.54);
    // Worn lane follows the actors' foot plane, with soft shoulders.
    const lane=ctx.createLinearGradient(0,h*.62,0,h*.89);
    lane.addColorStop(0,'#b9ab7700'); lane.addColorStop(.42,'#b9ab7760'); lane.addColorStop(.73,'#b9ab7750'); lane.addColorStop(1,'#b9ab7700');
    ctx.fillStyle=lane; ctx.fillRect(0,h*.62,w,h*.27);
    if(id==='ruins') {
      prop(ctx,'house',w*.39,h*.57,h*.38,.85);
      prop(ctx,'house',w*.65,h*.53,h*.29,.65);
    } else {
      prop(ctx,'birch',w*.38,h*.55,h*.31,.80);
      prop(ctx,'pine',w*.69,h*.56,h*.38,.85);
    }
    prop(ctx,'oak',w*.055,h*.66,h*.66);
    prop(ctx,'pine',w*.95,h*.64,h*.68);
    prop(ctx,'birch',w*.19,h*.57,h*.37,.95);
    prop(ctx,'oak',w*.84,h*.56,h*.34,.90);
    prop(ctx,'rock',w*.44,h*.59,h*.065,.85);
    prop(ctx,'rock',w*.76,h*.61,h*.08,.90);
    ctx.restore(); return true;
  }
  function foreground(ctx,w,h,id) {
    if(!has(id)) return;
    // Low edge framing stays below actors and leaves the center unobstructed.
    prop(ctx,'rock',w*.025,h*1.01,h*.18);
    prop(ctx,'rock',w*.975,h*.99,h*.14);
    ctx.save(); const shade=ctx.createLinearGradient(0,h*.88,0,h);
    shade.addColorStop(0,'#06131b00'); shade.addColorStop(1,'#06131b80');
    ctx.fillStyle=shade; ctx.fillRect(0,h*.88,w,h*.12); ctx.restore();
  }
  window.FrenemiesScenes={has,title,ready,background,foreground};
})();
