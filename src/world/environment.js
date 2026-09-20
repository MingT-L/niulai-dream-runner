/**
 * ============================================================
 * 环境氛围系统：水墨远山、云雀飞鸟、留白太阳、入梦渐变
 * ------------------------------------------------------------
 * 取材自《牛来》官方海报意象——"云雾缭绕的山水之间，
 * 独行的牛与飞鸟遥遥相望"：
 *   - 三层水墨远山：墨分五色渐层（浓→淡），正弦山脊剪影
 *   - 云雀飞鸟：V 形剪影群，缓慢横移 + 扇翅
 *   - 留白太阳：水墨画中的淡金圆盘
 *   - 入梦渐变：随奔跑距离，雾色/天空轻微向青墨 lerp
 *     （呼应电影"虚实交织的梦境叙事"）
 * ============================================================
 */
import * as THREE from 'three'
import { COLORS } from '../config.js'

export class Environment {
  /**
   * @param {import('../core/scene-manager.js').SceneManager} sceneManager 场景管理器
   */
  constructor(sceneManager) {
    this.sceneManager = sceneManager
    this.scene = sceneManager.scene
    this.time = 0

    // ---- 氛围渐变的起点 / 终点色（入梦方向）----
    this._fogStart = new THREE.Color(COLORS.fog)        // 宣纸米白
    this._fogDeep = new THREE.Color(COLORS.fogDeep)     // 青墨
    this._skyTopStart = new THREE.Color(COLORS.skyTop)
    this._skyTopDeep = new THREE.Color(0xdfe3da)        // 偏青宣纸
    this._skyBottomStart = new THREE.Color(COLORS.skyBottom)
    this._skyBottomDeep = new THREE.Color(0xe9ede4)
    this._fogFarStart = sceneManager.fogFar             // 132
    this._fogFarDeep = 108                              // 雾渐浓（入梦）

    this._buildSun()
    this._buildMountains()
    this._buildBirds()
  }

  /** 留白太阳：淡金圆盘悬于远山之上（水墨留白手法） */
  _buildSun() {
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(7, 32),
      new THREE.MeshBasicMaterial({ color: COLORS.sun, fog: false })
    )
    sun.position.set(26, 34, -135)
    this.scene.add(sun)
  }

  /** 三层水墨远山：正弦叠加山脊线，由近及远渐淡（墨分五色） */
  _buildMountains() {
    // base：山基高度；amp：起伏幅度；freq：山体疏密；phase：错峰
    const layers = [
      { z: -82, color: COLORS.mountains[0], base: 9, amp: 13, freq: 0.02, phase: 0.0 },
      { z: -106, color: COLORS.mountains[1], base: 14, amp: 18, freq: 0.013, phase: 2.1 },
      { z: -128, color: COLORS.mountains[2], base: 19, amp: 23, freq: 0.009, phase: 4.2 }
    ]
    for (const layer of layers) {
      // 高度方向仅 1 段：上边顶点抬成山脊、下边顶点压入地下
      const geo = new THREE.PlaneGeometry(560, 80, 96, 1)
      const pos = geo.attributes.position
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i)
        const isTop = pos.getY(i) > 0
        if (!isTop) {
          pos.setY(i, -8) // 山脚埋入地面，避免露缝
          continue
        }
        // 双正弦叠加：主峰 + 次级褶皱（固定相位，复现稳定）
        const ridge = layer.base +
          Math.sin(x * layer.freq + layer.phase) * layer.amp +
          Math.sin(x * layer.freq * 2.7 + layer.phase * 1.7) * layer.amp * 0.45
        pos.setY(i, ridge)
      }
      const mat = new THREE.MeshBasicMaterial({ color: layer.color, fog: false })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.z = layer.z
      this.scene.add(mesh)
    }
  }

  /** 云雀飞鸟：V 形双翼剪影群，缓慢横移 + 扇翅 + 轻微起伏 */
  _buildBirds() {
    this.birds = []
    const wingGeo = new THREE.PlaneGeometry(0.95, 0.16)
    const birdMat = new THREE.MeshBasicMaterial({
      color: COLORS.bird,
      fog: false,
      side: THREE.DoubleSide
    })
    // 四只飞鸟分布在天际不同位置（大小随远近递减，空气透视感）
    const flocks = [
      { x: -30, y: 26, z: -80, s: 1.0 },
      { x: 20, y: 33, z: -95, s: 0.8 },
      { x: 48, y: 22, z: -75, s: 0.62 },
      { x: -55, y: 30, z: -100, s: 0.5 }
    ]
    for (const f of flocks) {
      const bird = new THREE.Group()
      const left = new THREE.Mesh(wingGeo, birdMat)
      left.position.x = -0.44
      const right = new THREE.Mesh(wingGeo, birdMat)
      right.position.x = 0.44
      bird.add(left, right)
      bird.position.set(f.x, f.y, f.z)
      bird.scale.setScalar(f.s)
      bird.userData = {
        left, right,
        speed: 1.2 + Math.random() * 1.2,
        flapPhase: Math.random() * 6.28
      }
      this.scene.add(bird)
      this.birds.push(bird)
    }
  }

  /**
   * 每帧更新：飞鸟横移 / 扇翅 / 起伏
   * @param {number} dt 时间增量
   */
  update(dt) {
    this.time += dt
    for (const bird of this.birds) {
      const u = bird.userData
      // 缓慢横移，越界回绕（天际巡回的云雀）
      bird.position.x += u.speed * dt
      if (bird.position.x > 95) bird.position.x = -95
      // 轻微上下漂浮
      bird.position.y += Math.sin(this.time * 0.8 + u.flapPhase) * dt * 1.1
      // 双翼对拍
      const flap = Math.sin(this.time * 7 + u.flapPhase) * 0.55
      u.left.rotation.z = flap
      u.right.rotation.z = -flap
    }
  }

  /**
   * 入梦氛围渐变：随进度将雾色 / 雾程 / 天空调向青墨
   * @param {number} progress 入梦进度 0~1（由奔跑距离映射）
   */
  setAtmosphere(progress) {
    const p = THREE.MathUtils.clamp(progress, 0, 1)

    // 雾色：宣纸米白 → 青墨（克制 lerp，保持水墨淡雅）
    const fog = this.scene.fog
    fog.color.copy(this._fogStart).lerp(this._fogDeep, p * 0.6)
    fog.far = THREE.MathUtils.lerp(this._fogFarStart, this._fogFarDeep, p)
    fog.near = THREE.MathUtils.lerp(22, 16, p)

    // 天空：轻微偏青（梦境色调）
    const sky = this.sceneManager.sky.material.uniforms
    sky.topColor.value.copy(this._skyTopStart).lerp(this._skyTopDeep, p * 0.7)
    sky.bottomColor.value.copy(this._skyBottomStart).lerp(this._skyBottomDeep, p * 0.7)
  }
}
