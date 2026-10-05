import { jobs } from './art-prompts.mjs';

const attacks = {
  ranger:'draw the bowstring, release toward the right, and recover; keep the bow and quiver unchanged',
  soldier:'brace the rifle, fire with a small recoil, and recover. Keep the muzzle close to the character; NO muzzle flash, smoke or emitted bullet',
  sniper:'aim the long scoped rifle diagonally toward the lower right, fire with a small recoil, and recover. Keep the full rifle inside the cell; NO muzzle flash, smoke or emitted bullet',
  pyro:'brace and operate the flamethrower nozzle, then recover; do not draw a long flame stream',
  rocketeer:'brace the shoulder launcher, fire with a small recoil, and recover; do not draw a launched rocket',
  titan:'brace the machine-gun arms, recoil the gun barrels and brass pistons, and recover',
  mutant:'wind back one BENT clawed arm close to the torso, perform a SHORT compact swipe toward the right, and recover. Never extend either arm fully. Keep both hands close enough to the body to fit completely inside the cell. All four figures are SMALL thumbnails with wide transparent gaps between them; each figure occupies only the middle half of its cell width',
  venom:'pull the head back with swollen throat sacs, spit toward the right, and recover; no large emitted acid stream',
  giant:'raise one massive BENT arm close to the shoulder, make a short heavy punch toward the right, and recover. Keep the fist close to the torso, never fully extend the arm; all four compact poses have broad transparent gaps',
  behemoth:'curl the long clawed arms close to the torso, perform a short compact swipe toward the right, and recover. Never fully extend either arm; all four compact poses have broad transparent gaps',
};

export const animationJobs = jobs.filter(j=>j.key.startsWith('unit/')||j.key.startsWith('infected/')).flatMap(base=>['walk','attack'].map(state=>{
  const id=base.key.split('/')[1], frames=4;
  const subject=base.prompt.split('Subject: ')[1].split('\nCamera:')[0];
  const motion=state==='walk'
    ? 'Four unmistakably DIFFERENT articulated poses forming one seamless walk cycle. Pose 1: right leg FORWARD toward screen right, left leg BACK toward screen left. Pose 2: rear left knee bent high, right leg planted. Pose 3: left leg FORWARD toward screen right, right leg BACK toward screen left. Pose 4: rear right knee bent high, left leg planted. The legs exchange front/back positions across the cycle. Relax the arms and carry weapons LOW, angled diagonally downward rather than projecting far to the right. DO NOT repeat the idle fighting stance. Small torso bob, same anatomy throughout. Entire character, hands and weapons fit within each cell with a broad transparent gap on both sides.'
    : `Four consecutive phases of one attack: preparation, wind-up, strike or discharge, recovery. ${attacks[id]||'pull the reaching arms back, swipe with the hands toward the right, and recover'}. No victim, scene, gore or large projectile effects.`;
  const prompt=`Use case: stylized-concept. Create ONE transparent horizontal sprite strip for ${base.key}_${state}, using the supplied character as the exact visual reference. Original painterly steampunk RTS game art, same clothing, face, anatomy, weapons, palette, high overhead three-quarter camera and upper-left lighting as the reference.\nSubject: ${subject}\nAnimation: ${motion}\nLAYOUT IS ESSENTIAL: exactly ${frames} separate full-body poses in ONE horizontal row, evenly spaced across exactly ${frames} equal-width cells. Canvas aspect 3:1; cells may be tall. Each pose is centered at its own cell's midpoint. Use the SAME scale, camera, fixed root position and foot baseline in every cell. Entire head, limbs and weapons must be contained inside each cell, with transparent margins between poses. Keep the body in the central 40% of cell height and all weapons inside the central 70% of cell width.\nEvery pose faces RIGHT. Preserve every detail of the character's identity; change only the articulated motion. No horizontal drift, turn-around, camera movement, anatomy changes, detached limbs, overlapping frames, extra characters, second row, cell outlines, labels, numbers, words or watermark. Real alpha transparency everywhere outside the characters and compact contact shadows. No background or ground plane.`;
  return {key:base.key+'_'+state,baseKey:base.key,file:base.file.replace(/\.png$/,'_'+state+'.png'),w:base.w,h:base.h,frames,fps:state==='walk'?8:12,transparent_background:true,prompt};
}));
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(animationJobs));
