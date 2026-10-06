allow 0 pts into trait

see if endurance should also affect energy. rename energy everywhere to hunger

<!-- > > > > > > > prey should not freeze when it can only run toward other pray. SHould go to least bad option -->

dhasboard: prey / predators pills in leaderboard replace with glorp svg like the glorpInspector
glorp svg to right of name in the Fasted / Fertilest styled buttons.
descenants tally is bugged. if this field is an efficiency problem we can remove it.ß
remove born
timers should be formatted like they are in glorpinspector

should heart layer be a whole layer? should it be more generic

fertility should be more impactful, even though evo pressure won't tend towards it

add render cycle test to make sure we don't impact performance between commits

New mothers should not eat children

stats panel shouldn't overlay

add traction

mutation granted every 10 generations
hunters have a chance to inherit eaten mutation
7 mutations max, then no additions
children get their parents mutations up to 5 for hunters, all for prey. all minus 1 if generational mutation for prey

mutation mechanism will animalize glops - cold blooded lowers metabolism and speed
mutations will affect behavior as well so behavior will need to be composable
twins / triplets (more energy) / eggs (use less energy but easy food for predators) / photosynthetic (always full energy)
vampiric: doesn't consume their food but fed half as much
poison (prey): doesn't provide energy when eaten, (pred): ignore strength
dig: can dig underground to avoid predators (predators): can eat dug prey

positive Analytics metric longer lives for the most successful glorps living a similarly long amount of time (but not invincible)
goal of rock paper scissor mechanics where attributes have weaknesses. the best attributes for predators depend on the current attributes of prey. They are always adapting to the other's pressure.

biomes break the game up naturally instead of one full square. swamps / sand / mountains, slow creatures without mutations so that others likely die before reaching new habitable zone.
day + night cycle
weather changes biomes?

fitness via computer concepts:
different sorts or pathfinding functions?

opposing attributes - can't have more than 150% total attribute points for some categories. speed / stamina. if speed is 100%, stamina can't go beyond 50%.

have "clouds" you don't see the cloud but you see shadow similarly to how nagomi does, and you see rain maybe, and it makes all plant tiles grow

make click ui look less like ai and match sprite theme

Leap for predators based on strength + agility
try to compete with speed + endurance

implement corpses
glorp deflates and turns darker than max hunger
corpse exists for 3 seconds (in config)
corpses only show in world detailed view (not when zoomed out)

balance levers:
preds and prey use the jog mechanic when critically hungry if not eating / pursuing food
dead unconsumed glorps create a full patch of grass after short # of seconds

introduce corpses
3 seconds existance - in config

scavenger
can eat corpse of prey for 15hp
prioritizes corpse over grass or prey
tile beneath eaten corpse becomes full grass.

Mutation changes
mutations that come from a pregnancy or a clone will have a chance to be enabled: false, like a recessive gene

all gen 0 glorps start with same stats?

mutations:

We want to make a detailed world glorp for the scavenger mutation. Read about the scavenger and our glorp art direction and look at the hololab world shader all variants to get an idea of some of the interesting ways we've done art effects in the past. The effects typically have a blocky resolution but they're still dynamic and interesting, often with unique animations. Also research sprite art, pixel art, shaders for interesting effects we might want to incorporate

Without copying any of the others too closely, I want you to create designs based on this:

Scavenger: Bone Ribs, hyena, racoon mask

mutation appearances:
Scavenger: Bone Ribs, hyena, racoon mask

change jumper to grasshopper

mutations stack
uglier sprites for the ones without synergies
prettier sprites for synnergies

mutations:

Cannibal
can hunt eat your own kind when starving
dodge still works normally even if prey vs prey

Pack Leader
creates offspring with Pack Animal mutation
No cloning no mating with pack animals. Always becomes pregnant when mating

Pack Animal
All animals in pack share 20% of each meal
Pack animals like to be in proximity to eachother
Maybe a grid so they don't clump up where each glorp can only move within iit's grid?
No cloning No mating

See if you know of or can find a fun effcient suggestion to keep animals "together" without them blobbing up or feeling too grid like.

And here's what we could use if we don't have a better idea or finding
Grid idea for pack animals - I know it's a shader but describes the similar behavior. We would very likely not implement as a shader.
// Author: @patriciogv - 2015
// Title: Tissue

#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

// Created by inigo quilez - iq/2013
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// http://www.iquilezles.org/www/articles/voronoilines/voronoilines.htm

vec2 random2( vec2 p ) {
return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))\*43758.5453);
}

#define ANIMATE
vec3 voronoi( in vec2 x, float rnd ) {
vec2 n = floor(x);
vec2 f = fract(x);

    // first pass: regular voronoi
    vec2 mg, mr;
    float md = 8.0;
    for (int j=-1; j<=1; j++ ) {
        for (int i=-1; i<=1; i++ ) {
            vec2 g = vec2(float(i),float(j));
            vec2 o = random2( n + g )*rnd;
            #ifdef ANIMATE
            o = 0.5 + 0.5*sin( u_time + 6.2831*o );
            #endif
            vec2 r = g + o - f;
            float d = dot(r,r);

            if( d<md ) {
                md = d;
                mr = r;
                mg = g;
            }
        }
    }

    // second pass: distance to borders
    md = 8.0;
    for (int j=-2; j<=2; j++ ) {
        for (int i=-2; i<=2; i++ ) {
            vec2 g = mg + vec2(float(i),float(j));
            vec2 o = random2(n + g)*rnd;
            #ifdef ANIMATE
            o = 0.5 + 0.5*sin( u_time + 6.2831*o );
            #endif
            vec2 r = g + o - f;

            if( dot(mr-r,mr-r)>0.00001 )
            md = min( md, dot( 0.5*(mr+r), normalize(r-mr) ) );
        }
    }
    return vec3( md, mr );

}

void main() {
vec2 st = gl*FragCoord.xy/u_resolution.xy;
st = (st-.5)*.75+.5;
if (u*resolution.y > u_resolution.x ) {
st.y *= u*resolution.y/u_resolution.x;
st.y -= (u_resolution.y*.5-u_resolution.x*.5)/u_resolution.x;
} else {
st.x *= u*resolution.x/u_resolution.y;
st.x -= (u_resolution.x*.5-u_resolution.y\*.5)/u_resolution.y;
}
vec3 color = vec3(0.0);

    float d = dot(st-.5,st-.5);
    vec3 c = voronoi( 20.*st, pow(d,.4) );

    // borders
    color = mix( vec3(1.0), color, smoothstep( 0.01, 0.02, c.x ) );
    // feature points
    float dd = length( c.yz );
    color += vec3(1.)*(1.0-smoothstep( 0.0, 0.1, dd));

    gl_FragColor = vec4(color,1.0);

}

I think I want to see world glorps looking like thtey did in 6890aeb5d833f0abbad63dfdb4732df5451fa7ee, before they were changed in 85811e681f449468fa6f0dbaa5af70125707b59e but I want them to seem at double pixel density. I think you said they were about 8px wide, so we'd do 16
