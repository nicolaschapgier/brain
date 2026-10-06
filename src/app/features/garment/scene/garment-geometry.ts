import { ExtrudeGeometry, Shape } from 'three';

// Silhouette d'un maillot à manches courtes et col rond, en unités centrées sur l'origine. Pas un vrai patron :
// juste assez reconnaissable pour qu'on identifie « un vêtement » une fois extrudé et texturé.
const W = 1;
const HEM_Y = -1.3;
const UNDERARM_Y = 0.55;
const SHOULDER_Y = 0.95;
const NECK_Y = 0.82;
const NECK_DIP_Y = 0.58;
const NECK_X = 0.26;
const SLEEVE_OUT_X = 1.5;
const SLEEVE_TOP_Y = 1.05;
const SLEEVE_BOTTOM_Y = 0.35;

/** Épaisseur du tissu (visible sur la tranche pendant la rotation) : de quoi avoir un vrai volume 3D, pas juste un plan. */
const DEPTH = 0.16;

function outline(): Shape {
  const shape = new Shape();
  shape.moveTo(-W, HEM_Y);
  shape.lineTo(-W, UNDERARM_Y);
  shape.lineTo(-SLEEVE_OUT_X, SLEEVE_BOTTOM_Y);
  shape.lineTo(-SLEEVE_OUT_X, SLEEVE_TOP_Y);
  shape.lineTo(-W * 0.7, SHOULDER_Y);
  shape.lineTo(-NECK_X, NECK_Y);
  shape.quadraticCurveTo(0, NECK_DIP_Y, NECK_X, NECK_Y);
  shape.lineTo(W * 0.7, SHOULDER_Y);
  shape.lineTo(SLEEVE_OUT_X, SLEEVE_TOP_Y);
  shape.lineTo(SLEEVE_OUT_X, SLEEVE_BOTTOM_Y);
  shape.lineTo(W, UNDERARM_Y);
  shape.lineTo(W, HEM_Y);
  shape.lineTo(-W, HEM_Y);
  return shape;
}

/**
 * La géométrie du maillot : deux groupes de matériau (voir `GarmentScene`) — le 0 pour les faces avant/arrière (la
 * photo y sera appliquée comme un motif), le 1 pour la tranche extrudée (une couleur de tissu unie).
 */
export function garmentGeometry(): ExtrudeGeometry {
  const geometry = new ExtrudeGeometry(outline(), {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geometry.center();
  return geometry;
}
