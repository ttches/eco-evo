/**
 * The browser side of a chart page: stylesheet and the small script that draws
 * each `.chart[data-spec]` as SVG with a hover crosshair. Shipped inline so the
 * report is one file that works offline. Colors are CSS variables with a dark
 * mode, so charts follow the viewer's theme.
 */

export const PAGE_STYLE = `
:root{color-scheme:light;--bg:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--grid:#e6e5e0;--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--s4:#eda100;--shade:#00000010}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:#1a1a19;--ink:#fff;--ink2:#c3c2b7;--grid:#34332f;--s1:#3987e5;--s2:#d95926;--s3:#199e70;--s4:#c98500;--shade:#ffffff12}}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,sans-serif}
main{max-width:980px;margin:0 auto;padding:16px}
h1{font-size:20px;margin:8px 0}h2{font-size:15px;margin:0}p.sub,.note{color:var(--ink2);margin:2px 0 8px}
.chart{margin:18px 0;position:relative}
.chart svg{width:100%;height:auto;display:block;overflow:visible}
.legend{display:flex;gap:14px;flex-wrap:wrap;color:var(--ink2);font-size:12px;margin-top:4px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px}
.tip{position:absolute;pointer-events:none;background:var(--bg);border:1px solid var(--grid);border-radius:6px;padding:6px 8px;font-size:12px;display:none;white-space:nowrap}
.flags li{margin:2px 0}
`

export const CHART_SCRIPT = `
const fmt=v=>Math.abs(v)>=100?v.toFixed(0):Math.abs(v)>=10?v.toFixed(1):v.toFixed(2);
document.querySelectorAll('.chart').forEach(el=>{
const s=JSON.parse(el.dataset.spec);const W=900,H=260,m={l:48,r:12,t:10,b:28};
const xs=s.series.flatMap(a=>a.points.map(p=>p[0]));const ys=s.series.flatMap(a=>a.points.map(p=>p[1]));
const x0=Math.min(...xs),x1=Math.max(...xs)||1;let y1=Math.max(...ys,s.floor||0,1);y1*=1.05;
const X=x=>m.l+(x-x0)/(x1-x0||1)*(W-m.l-m.r),Y=y=>H-m.b-y/y1*(H-m.t-m.b);
let g='';for(let i=0;i<=4;i++){const v=y1*i/4;g+='<line x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+Y(v)+'" y2="'+Y(v)+'" stroke="var(--grid)"/><text x="'+(m.l-6)+'" y="'+(Y(v)+4)+'" text-anchor="end" font-size="11" fill="var(--ink2)">'+fmt(v)+'</text>'}
for(let i=0;i<=6;i++){const v=x0+(x1-x0)*i/6;g+='<text x="'+X(v)+'" y="'+(H-8)+'" text-anchor="middle" font-size="11" fill="var(--ink2)">'+v.toFixed(0)+'s</text>'}
if(s.warmup)g+='<rect x="'+X(x0)+'" y="'+m.t+'" width="'+(X(Math.min(s.warmup,x1))-X(x0))+'" height="'+(H-m.t-m.b)+'" fill="var(--shade)"/><text x="'+(X(x0)+4)+'" y="'+(m.t+12)+'" font-size="11" fill="var(--ink2)">warmup</text>';
if(s.floor!=null)g+='<line x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+Y(s.floor)+'" y2="'+Y(s.floor)+'" stroke="var(--ink2)" stroke-dasharray="4 4"/><text x="'+(W-m.r)+'" y="'+(Y(s.floor)-4)+'" text-anchor="end" font-size="11" fill="var(--ink2)">floor '+s.floor+'</text>';
for(const a of s.series)g+='<polyline fill="none" stroke="'+a.color+'" stroke-width="'+(a.width||2)+'" stroke-linejoin="round" opacity="'+(a.opacity??1)+'" points="'+a.points.map(p=>X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)).join(' ')+'"/>';
g+='<line class="cross" y1="'+m.t+'" y2="'+(H-m.b)+'" stroke="var(--ink2)" style="display:none"/>';
el.innerHTML='<h2>'+s.title+'</h2>'+(s.subtitle?'<p class="sub">'+s.subtitle+'</p>':'')+'<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+s.title+'">'+g+'<rect x="'+m.l+'" y="'+m.t+'" width="'+(W-m.l-m.r)+'" height="'+(H-m.t-m.b)+'" fill="transparent"/></svg>'+(s.legend===false?'':'<div class="legend">'+s.series.map(a=>'<span><i style="background:'+a.color+'"></i>'+a.name+'</span>').join('')+'</div>')+'<div class="tip"></div>';
const svg=el.querySelector('svg'),cross=el.querySelector('.cross'),tip=el.querySelector('.tip');
svg.addEventListener('mousemove',e=>{const r=svg.getBoundingClientRect();const px=(e.clientX-r.left)/r.width*W;if(px<m.l||px>W-m.r)return;
const t=x0+(px-m.l)/(W-m.l-m.r)*(x1-x0);cross.setAttribute('x1',px);cross.setAttribute('x2',px);cross.style.display='';
const rows=s.series.slice(0,12).map(a=>{let b=a.points[0];for(const p of a.points)if(Math.abs(p[0]-t)<Math.abs(b[0]-t))b=p;return a.name+': '+fmt(b[1])});
tip.innerHTML='<b>'+t.toFixed(0)+'s</b><br>'+rows.join('<br>');tip.style.display='block';tip.style.left=Math.min(e.clientX-r.left+12,r.width-150)+'px';tip.style.top='40px'});
svg.addEventListener('mouseleave',()=>{cross.style.display='none';tip.style.display='none'});
});
`
