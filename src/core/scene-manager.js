/**
 * ============================================================
 * 场景管理器
 * ------------------------------------------------------------
 * 负责 Three.js 场景核心要素：渲染器、第三人称相机、灯光、
 * 渐变天空穹顶、淡墨雾效与宣纸草原地面。
 * 水墨基调（宣纸底色 + 墨晕层次）在此奠定。
 * ============================================================
 */
import * as THREE from 'three'
import { COLORS, CAMERA } from '../config.js'
import { toonMat } from '../effects/materials.js'

export class SceneManager {
  /**
   * @param {HTMLElement} container 画布挂载容器
   */
  constructor(container) {
    // ---- 渲染器：抗锯齿 + 像素比上限 2（兼顾清晰度与移动端性能）----
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    container.appendChild(this.renderer.domElement)

    // ---- 场景与淡墨雾（宣纸色，远景自然晕染出水墨层次）----
    this.scene = new THREE.Scene()
    this.fogNear = 22
    this.fogFar = 132
    this.scene.fog = new THREE.Fog(COLORS.fog, this.fogNear, this.fogFar)

    // ---- 第三人称相机 ----
    this.camera = new THREE.PerspectiveCamera(
      CAMERA.fov,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    )
    this.camera.position.set(CAMERA.pos.x, CAMERA.pos.y, CAMERA.pos.z)
    this.camera.lookAt(CAMERA.lookAt.x, CAMERA.lookAt.y, CAMERA.lookAt.z)

    // ---- 灯光：半球光（宣纸天光 + 草地反光）+ 柔和暖色方向光 ----
    const hemi = new THREE.HemisphereLight(COLORS.fog, COLORS.grass, 1.0)
    this.scene.add(hemi)
    const dir = new THREE.DirectionalLight(0xfff8e8, 0.85)
    dir.position.set(6, 12, 8)
    this.scene.add(dir)

    this._buildSky()
    this._buildGround()

    // 响应式：窗口尺寸变化时同步渲染器与相机
    window.addEventListener('resize', () => this.onResize())
  }

  /** 渐变天空穹顶：宣纸色系上下晕染（纯 Shader，无贴图，水墨留白感） */
  _buildSky() {
    const geo = new THREE.SphereGeometry(420, 32, 16)
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, // 从内表面观看穹顶
      fog: false,           // 天空不受雾影响（雾色即底色）
      uniforms: {
        topColor: { value: new THREE.Color(COLORS.skyTop) },
        bottomColor: { value: new THREE.Color(COLORS.skyBottom) },
        offset: { value: 60 },
        exponent: { value: 0.6 }
      },
      vertexShader: /* glsl */`
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPos;
        void main() {
          // 依据世界坐标 y 值在上下两色间渐变，模拟宣纸晕染
          float h = normalize(vWorldPos + vec3(0.0, offset, 0.0)).y;
          float t = pow(max(h, 0.0), exponent);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }`
    })
    this.sky = new THREE.Mesh(geo, mat)
    this.scene.add(this.sky)
  }

  /** 宣纸草原地面：淡彩大平面（静态底座；滚动感由 Track 的动态元素提供） */
  _buildGround() {
    const geo = new THREE.PlaneGeometry(600, 600)
    geo.rotateX(-Math.PI / 2)
    this.ground = new THREE.Mesh(geo, toonMat(COLORS.grass))
    this.ground.position.set(0, -0.02, -120) // 略低于赛道，避免 z-fighting
    this.scene.add(this.ground)
  }

  /** 响应式处理：同步渲染器尺寸与相机宽高比 */
  onResize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  /** 渲染一帧 */
  render() {
    this.renderer.render(this.scene, this.camera)
  }
}
