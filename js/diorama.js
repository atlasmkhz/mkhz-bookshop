// 디오라마 화면: 그린 화면 위에 한 번 더 손질 — 작은 모형 마을을 접사로 찍은 사진처럼
// 단계 (무거운 계산은 작은 화면에서):
//   1) 장면 → 전체 해상도 그림 + 깊이
//   2) 절반 해상도: 구석 그늘(깊이로 틈을 찾음, 점마다 각도를 돌려 얼룩 없이) + 그림 줄이기 → 가로 · 세로 번짐 두 번 (그늘도 같이 부드럽게)
//   3) 4분의 1 해상도: 밝은 곳만 골라 넓게 번짐 (등불 · 모닥불 · 창빛의 빛 번짐)
//   4) 전체 해상도 한 번: 또렷한 그림과 번진 그림을 섞음 — 화면 위아래(틸트시프트) + 내 캐릭터보다 많이 앞 · 뒤(깊이 흐림),
//      초점 맞은 곳은 살짝 더 또렷하게, 구석 그늘 · 빛 번짐 · 따뜻한 색 · 가장자리 어둡게 · 옅은 필름 입자
// 전체 해상도 한 번만 쓰고 나머지는 1/4 · 1/16 크기라 전보다 가볍다. 모두 내 화면에서만, 서버 요청과 상관없음
import * as THREE from 'three';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const SAFE = 'vec3 safe(vec3 c){ return (c.r >= 0.0 && c.r < 6e4 && c.g >= 0.0 && c.g < 6e4 && c.b >= 0.0 && c.b < 6e4) ? c : vec3(0.0); }';
const LIN = 'float lin(vec2 uv){ float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }';

// 절반 해상도: 구석 그늘 + 그림 줄이기 (rgb = 그림, a = 그늘)
const AO_FRAG = /* glsl */`
  uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 res; uniform float near, far, ao;
  varying vec2 vUv;
  ${LIN}
  ${SAFE}
  void main(){
    vec2 px = 1.0 / res;
    // 장면 어딘가 계산이 깨진 점(무한대 · 숫자 아님)이 번짐으로 네모나게 퍼지지 않게 먼저 걸러 냄
    vec3 c = safe(texture2D(tColor, vUv).rgb);
    float d = lin(vUv);
    // 점마다 다른 각도로 돌려 띠 무늬가 생기지 않게 (뒤에서 번지며 섞임)
    float n = fract(52.9829189 * fract(0.06711056 * gl_FragCoord.x + 0.00583715 * gl_FragCoord.y));
    float rad = clamp(16.0 / d, 1.6, 14.0);
    float occ = 0.0;
    if (!(d > 0.0 && d < 1e5)) d = 1e5;
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 2.39996 + n * 6.2832;
      float r = sqrt((float(i) + 0.5) / 12.0) * rad;
      float ds = lin(vUv + vec2(cos(a), sin(a)) * r * px);
      float diff = d - ds;
      occ += smoothstep(0.03, 0.22, diff) * (1.0 - smoothstep(0.3, 1.6, diff));
    }
    gl_FragColor = vec4(c, 1.0 - ao * occ / 12.0);
  }`;

// 가로 · 세로 번짐 (9칸)
const BLUR_FRAG = /* glsl */`
  uniform sampler2D tIn; uniform vec2 dir;
  varying vec2 vUv;
  void main(){
    vec4 s = texture2D(tIn, vUv) * 0.2270;
    s += (texture2D(tIn, vUv + dir * 1.3846) + texture2D(tIn, vUv - dir * 1.3846)) * 0.3162;
    s += (texture2D(tIn, vUv + dir * 3.2308) + texture2D(tIn, vUv - dir * 3.2308)) * 0.0703;
    gl_FragColor = s;
  }`;

// 4분의 1 해상도: 밝은 곳만
const BRIGHT_FRAG = /* glsl */`
  uniform sampler2D tIn; uniform float thr;
  varying vec2 vUv;
  void main(){
    vec3 c = texture2D(tIn, vUv).rgb;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    gl_FragColor = vec4(c * smoothstep(thr, thr + 0.6, l), 1.0);
  }`;

// 마지막 섞기
const MIX_FRAG = /* glsl */`
  uniform sampler2D tColor; uniform sampler2D tBlur; uniform sampler2D tBloom; uniform sampler2D tDepth;
  uniform vec2 res; uniform float near, far, focus, band, blur, focusDist, aoMix, bloom, warm, grain, time;
  varying vec2 vUv;
  ${LIN}
  ${SAFE}
  void main(){
    vec3 c = safe(texture2D(tColor, vUv).rgb);
    vec4 b = texture2D(tBlur, vUv);
    // 흐릴 정도: 화면 위아래(틸트시프트) 와 내 캐릭터보다 많이 앞 · 뒤(깊이) 가운데 큰 쪽
    float wt = smoothstep(band, band + 0.34, abs(vUv.y - focus));
    float d = lin(vUv);
    float dd = d - focusDist;
    float wd = dd < 0.0 ? smoothstep(1.2, 4.5, -dd) : smoothstep(4.0, 16.0, dd);
    float w = clamp(max(wt, wd * 0.85) * blur, 0.0, 1.0);
    // 많이 흐릴 곳은 번진 그림을 한 번 더 퍼뜨림
    vec2 px = 1.0 / res;
    float r = 3.0 * w;
    vec3 bb = (b.rgb * 2.0 + texture2D(tBlur, vUv + vec2(r, r) * px).rgb + texture2D(tBlur, vUv + vec2(-r, r) * px).rgb
             + texture2D(tBlur, vUv + vec2(r, -r) * px).rgb + texture2D(tBlur, vUv + vec2(-r, -r) * px).rgb) / 6.0;
    vec3 col = mix(c, bb, w);
    // 초점 맞은 곳은 살짝 더 또렷하게 (또렷한 그림과 번진 그림의 차이를 조금 더함)
    col += (c - b.rgb) * 0.28 * (1.0 - w);
    // 구석 그늘 (절반 해상도에서 번져 부드러움)
    col *= mix(1.0, b.a, aoMix);
    // 빛 번짐
    col += texture2D(tBloom, vUv).rgb * bloom;
    // 색: 조금 따뜻하게 · 채도 살짝 · 밝은 곳은 부드럽게
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, 1.08);
    col *= mix(vec3(1.0), vec3(1.03, 1.0, 0.95), warm);
    col = col / (1.0 + col * 0.05);
    // 가장자리 어둡게
    vec2 q = vUv - 0.5;
    col *= 1.0 - dot(q, q) * 0.6;
    // 옅은 필름 입자 (매 프레임 조금씩)
    float g = fract(sin(dot(vUv * res + time, vec2(12.9898, 78.233))) * 43758.5453);
    col += (g - 0.5) * grain;
    gl_FragColor = vec4(max(col, 0.0), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export class Diorama {
  constructor(renderer) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const opt = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
    this.rt.depthTexture = new THREE.DepthTexture(size.x, size.y);
    this.half = [0, 1].map(() => new THREE.WebGLRenderTarget(1, 1, opt));
    this.quarter = [0, 1].map(() => new THREE.WebGLRenderTarget(1, 1, opt));
    const mk = (frag, uniforms) => new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false });
    this.aoMat = mk(AO_FRAG, { tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture }, res: { value: new THREE.Vector2(1, 1) }, near: { value: 0.1 }, far: { value: 200 }, ao: { value: 0.95 } });
    this.blurMat = mk(BLUR_FRAG, { tIn: { value: null }, dir: { value: new THREE.Vector2() } });
    this.brightMat = mk(BRIGHT_FRAG, { tIn: { value: null }, thr: { value: 0.85 } });
    this.mat = mk(MIX_FRAG, {
      tColor: { value: this.rt.texture }, tBlur: { value: null }, tBloom: { value: null }, tDepth: { value: this.rt.depthTexture },
      res: { value: new THREE.Vector2(1, 1) }, near: { value: 0.1 }, far: { value: 200 },
      focus: { value: 0.52 }, band: { value: 0.2 }, blur: { value: 1.0 }, focusDist: { value: 12 },
      aoMix: { value: 1.0 }, bloom: { value: 0.25 }, warm: { value: 1.0 }, grain: { value: 0.018 }, time: { value: 0 },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.setSize();
  }
  setSize() {
    const s = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rt.setSize(s.x, s.y);
    const hx = Math.max(1, Math.floor(s.x / 2)), hy = Math.max(1, Math.floor(s.y / 2));
    const qx = Math.max(1, Math.floor(s.x / 4)), qy = Math.max(1, Math.floor(s.y / 4));
    for (const t of this.half) t.setSize(hx, hy);
    for (const t of this.quarter) t.setSize(qx, qy);
    this.aoMat.uniforms.res.value.set(hx, hy);
    this.mat.uniforms.res.value.copy(s);
    this.sizeX = s.x;
    this.hpx = new THREE.Vector2(1 / hx, 1 / hy);
    this.qpx = new THREE.Vector2(1 / qx, 1 / qy);
  }
  pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.cam);
  }
  render(scene, camera) {
    const r = this.renderer;
    if (this.sizeX !== r.getDrawingBufferSize(new THREE.Vector2()).x) this.setSize();
    for (const m of [this.aoMat, this.mat]) { m.uniforms.near.value = camera.near; m.uniforms.far.value = camera.far; }
    // 1) 장면
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    // 2) 절반: 그늘 + 줄이기 → 가로 · 세로 번짐
    this.pass(this.aoMat, this.half[0]);
    this.blurMat.uniforms.tIn.value = this.half[0].texture; this.blurMat.uniforms.dir.value.set(this.hpx.x, 0); this.pass(this.blurMat, this.half[1]);
    this.blurMat.uniforms.tIn.value = this.half[1].texture; this.blurMat.uniforms.dir.value.set(0, this.hpx.y); this.pass(this.blurMat, this.half[0]);
    // 3) 4분의 1: 밝은 곳 → 넓게 번짐
    this.brightMat.uniforms.tIn.value = this.half[0].texture; this.pass(this.brightMat, this.quarter[0]);
    this.blurMat.uniforms.tIn.value = this.quarter[0].texture; this.blurMat.uniforms.dir.value.set(this.qpx.x * 1.5, 0); this.pass(this.blurMat, this.quarter[1]);
    this.blurMat.uniforms.tIn.value = this.quarter[1].texture; this.blurMat.uniforms.dir.value.set(0, this.qpx.y * 1.5); this.pass(this.blurMat, this.quarter[0]);
    // 4) 섞기 → 화면
    this.mat.uniforms.tBlur.value = this.half[0].texture;
    this.mat.uniforms.tBloom.value = this.quarter[0].texture;
    this.pass(this.mat, null);
  }
}
