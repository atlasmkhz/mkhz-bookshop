// 디오라마 화면 (시험판): 그린 화면 위에 한 번 더 손질
// - 구석 그늘(깊이로 가까운 곳의 틈을 어둡게), 위아래 가장자리 흐림(틸트시프트), 따뜻한 색 · 채도 · 가장자리 어둡게
// - 모두 내 화면에서만 그리는 것이라 서버 요청과 상관없음
import * as THREE from 'three';

export class Diorama {
  constructor(renderer) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 0 });
    this.rt.depthTexture = new THREE.DepthTexture(size.x, size.y);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture },
        res: { value: size.clone() }, near: { value: 0.1 }, far: { value: 200 },
        focus: { value: 0.52 }, band: { value: 0.16 }, blur: { value: 3.2 }, ao: { value: 0.75 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */`
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 res; uniform float near, far, focus, band, blur, ao;
        varying vec2 vUv;
        float lin(vec2 uv){ float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
        void main(){
          vec2 px = 1.0 / res;
          // 틸트시프트: 화면 가운데 띠는 또렷, 위아래로 갈수록 흐림
          float dy = abs(vUv.y - focus);
          float b = smoothstep(band, band + 0.32, dy) * blur;
          vec3 c = vec3(0.0); float wsum = 0.0;
          for (int i = 0; i < 12; i++) {
            float a = float(i) * 2.39996;
            float r = sqrt(float(i) / 12.0) * b;
            vec2 o = vec2(cos(a), sin(a)) * r * px * 1.6;
            c += texture2D(tColor, vUv + o).rgb; wsum += 1.0;
          }
          c /= wsum;
          // 구석 그늘: 둘레가 나보다 앞에(가까이) 있으면 어둡게
          float d = lin(vUv);
          float occ = 0.0;
          float rad = clamp(18.0 / d, 2.0, 22.0);
          for (int i = 0; i < 10; i++) {
            float a = float(i) * 0.6283 + 0.3;
            float rr = rad * (0.4 + 0.6 * fract(float(i) * 0.618));
            float ds = lin(vUv + vec2(cos(a), sin(a)) * rr * px);
            float diff = d - ds;
            occ += smoothstep(0.02, 0.25, diff) * (1.0 - smoothstep(0.25, 1.2, diff));
          }
          occ = 1.0 - ao * occ / 10.0;
          c *= occ;
          // 색: 따뜻하게, 채도 조금 올리고, 밝은 곳은 부드럽게
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(l), c, 1.08);
          c *= vec3(1.02, 1.0, 0.96);
          c = c / (1.0 + c * 0.06);
          // 가장자리 어둡게
          vec2 q = vUv - 0.5;
          c *= 1.0 - dot(q, q) * 0.55;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setSize() {
    const s = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rt.setSize(s.x, s.y);
    this.mat.uniforms.res.value.copy(s);
  }
  render(scene, camera) {
    const r = this.renderer;
    if (this.rt.width !== r.getDrawingBufferSize(new THREE.Vector2()).x) this.setSize();
    this.mat.uniforms.near.value = camera.near; this.mat.uniforms.far.value = camera.far;
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.scene, this.cam);
  }
}
