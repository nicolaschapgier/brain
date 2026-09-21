import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  Points,
  ShaderMaterial,
  SphereGeometry,
} from 'three';

const NEBULA_VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NEBULA_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec3 vDirection;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float sum = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      sum += amplitude * noise(p);
      p *= 2.02;
      amplitude *= 0.5;
    }
    return sum;
  }

  void main() {
    vec3 d = normalize(vDirection);
    float t = uTime * 0.008;
    float clouds = fbm(d * 2.2 + vec3(t, 0.0, -t));
    float dust = fbm(d * 4.0 + 10.0 + vec3(0.0, t * 1.5, 0.0));

    vec3 color = vec3(0.008, 0.012, 0.03);
    color += vec3(0.30, 0.10, 0.55) * smoothstep(0.45, 0.85, clouds) * 0.65;
    color += vec3(0.05, 0.25, 0.50) * smoothstep(0.50, 0.90, dust) * 0.50;
    color += vec3(0.60, 0.12, 0.40) * pow(smoothstep(0.55, 0.95, clouds * dust * 1.8), 2.0) * 0.6;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const STAR_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vColor = aColor;
    vTwinkle = 0.75 + 0.25 * sin(uTime * 1.5 + aPhase * 6.2831);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio;
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * vTwinkle * 1.5, alpha * vTwinkle);
  }
`;

/** Le décor spatial : nébuleuse en fond et champ d'étoiles scintillantes. */
export class SpaceBackdrop {
  readonly group = new Group();

  private readonly nebula: ShaderMaterial;
  private readonly stars: ShaderMaterial;
  private readonly geometries: BufferGeometry[] = [];

  constructor(pixelRatio: number) {
    this.nebula = new ShaderMaterial({
      vertexShader: NEBULA_VERTEX,
      fragmentShader: NEBULA_FRAGMENT,
      uniforms: { uTime: { value: 0 } },
      side: BackSide,
      depthWrite: false,
    });
    const sky = new Mesh(new SphereGeometry(900, 48, 32), this.nebula);
    sky.renderOrder = -2;
    this.geometries.push(sky.geometry);

    this.stars = new ShaderMaterial({
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: pixelRatio } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const starField = this.createStars(6000);
    starField.renderOrder = -1;

    this.group.add(sky, starField);
  }

  update(time: number) {
    this.nebula.uniforms['uTime'].value = time;
    this.stars.uniforms['uTime'].value = time;
  }

  setPixelRatio(ratio: number) {
    this.stars.uniforms['uPixelRatio'].value = ratio;
  }

  dispose() {
    this.nebula.dispose();
    this.stars.dispose();
    this.geometries.forEach((geometry) => geometry.dispose());
  }

  private createStars(count: number): Points {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const tints = [0xffffff, 0xcfe0ff, 0xffe6c4, 0xffc4e8].map((hex) => new Color(hex));

    for (let i = 0; i < count; i++) {
      // Direction uniforme sur la sphère, à une distance variable.
      const u = Math.random() * 2 - 1;
      const angle = Math.random() * Math.PI * 2;
      const radial = Math.sqrt(1 - u * u);
      const distance = 400 + Math.random() * 400;
      positions.set([radial * Math.cos(angle) * distance, u * distance, radial * Math.sin(angle) * distance], i * 3);

      const tint = tints[Math.floor(Math.random() * tints.length)];
      colors.set([tint.r, tint.g, tint.b], i * 3);
      sizes[i] = 1.2 + Math.pow(Math.random(), 4) * 4.5;
      phases[i] = Math.random();
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));
    this.geometries.push(geometry);

    const points = new Points(geometry, this.stars);
    points.frustumCulled = false;
    return points;
  }
}
