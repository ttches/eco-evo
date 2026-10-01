changelog focussed on gameplay changes + simulator run per version (not always) to document drift per patch

add camera lock feature. glorpinspector should have icon that locks. turns off when clicked again or when user pans.
clicking a living glorp in the stats panel should also center camera on glorp. with glorp inspector up, space on keyboard toggles lock icon

glorp inspector renders specific glorp next to name and can round to full seconds. show parents on right end of lineage bar.
the "repro status" icon should look ike ovaries
repro status should show a status not a timer. consolidate pregnancy with it.
the trait ratios should look cooler, maybe 7 segmented bar.
let's remove position
show time alive

remove global genetic directive

stamina while in pursuit or running away needs to be rethought. it just stays at 0 while they jog

research how stats work and better math algos that will give us more variance in traits and less average. consider reproduction, evolutionary directive

should heart layer be a whole layer? should it be more generic

add render cycle test to make sure we don't impact performance between commits

evolution directive attribute highlighted on glorp click ui

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

biomes break the game up naturally instead of one full square. swamps / sand / mountains, slow creatures without mutations so that others likely die before reaching new habitable zone.

opposing attributes - can't have more than 150% total attribute points for some categories. speed / stamina. if speed is 100%, stamina can't go beyond 50%.

have "clouds" you don't see the cloud but you see shadow similarly to how nagomi does, and you see rain maybe, and it makes all plant tiles grow

make click ui look less like ai and match sprite theme
