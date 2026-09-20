/**
 * ============================================================
 * 三车道赛道（无限滚动）
 * ------------------------------------------------------------
 * 核心思路：玩家固定于 z≈0，世界沿 +z 向玩家滚动（跑酷经典做法，
 * 浮点精度稳定、回收逻辑简单）。本模块负责：
 *   1. 车道底带 + 路肩墨线（静态，勾勒水墨跑道轮廓）
 *   2. 车道分隔虚线（滚动，提供速度感）
 *   3. 两侧草原草簇与墨石点缀（滚动 + 回绕时随机换位）
 * ============================================================
 */
import * as THREE from 'three'
import { COLORS, LANE, GAME } from '../config.js'
import { toonMat } from '../effects/materials.js'

export class Track {
  /**
   * @param {THREE.Scene} scene 主场景
   */
  constructor(scene) {
    this.scene = scene
    // 滚动元素集合：{ mesh, wrap, respawn? }
    //   wrap    —— 回绕总长（超出边界后 z 减去该值回到远处）
    //   respawn —— 可选，回绕时的随机换位回调（避免重复感）
    this._scrollItems = []

    this._buildRoad()
    this._buildDashes()
    this._buildTufts()
  }

  /** 车道底带（三车道合一的浅色带）+ 两侧路肩墨线（静态元素） */
  _buildRoad() {
    const length = 360
    const roadWidth = LANE.width * LANE.count

    // 跑道底带：略亮黄绿，与草原形成淡彩对比
    const roadGeo = new THREE.PlaneGeometry(roadWidth, length)
    roadGeo.rotateX(-Math.PI / 2)
    const road = new THREE.Mesh(roadGeo, toonMat(COLORS.road))
    road.position.set(0, 0.005, -length / 2 + GAME.worldWrapZ)
    this.scene.add(road)

    // 路肩墨线：水墨"勾边"笔法，勾勒跑道轮廓
    const edgeGeo = new THREE.PlaneGeometry(0.12, length)
    edgeGeo.rotateX(-Math.PI / 2)
    for (const sx of [-1, 1]) {
      const edge = new THREE.Mesh(edgeGeo, toonMat(COLORS.roadEdge))
      edge.position.set(sx * (roadWidth / 2 + 0.18), 0.01, -length / 2 + GAME.worldWrapZ)
      this.scene.add(edge)
    }
  }

  /** 车道分隔虚线（滚动元素：两条分隔线上的宣纸白短条） */
  _buildDashes() {
    const geo = new THREE.BoxGeometry(0.12, 0.02, 1.3)
    const mat = toonMat(COLORS.dash)
    const spacing = 4.5 // 虚线纵向间距
    const count = Math.ceil(GAME.worldWrapLength / spacing) + 2
    for (const sx of [-1, 1]) {
      const x = sx * (LANE.width / 2) // 分隔线位置：x = ±1.1
      for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(x, 0.02, GAME.worldWrapZ - i * spacing)
        this.scene.add(mesh)
        this._scrollItems.push({ mesh, wrap: GAME.worldWrapLength })
      }
    }
  }

  /** 两侧草原点缀：草簇（锥体）与墨石（压扁二十面体），滚动 + 随机换位 */
  _buildTufts() {
    // 共享几何体与材质（所有实例复用，降低开销）
    const coneGeo = new THREE.ConeGeometry(0.22, 0.55, 5)
    const rockGeo = new THREE.IcosahedronGeometry(0.3, 0)
    rockGeo.scale(1.5, 0.6, 1.5) // 压扁成扁石形状
    const tuftMat = toonMat(COLORS.grassTuft)
    const rockMat = toonMat(COLORS.rock)

    const count = 90
    for (let i = 0; i < count; i++) {
      const isRock = Math.random() < 0.25
      const mesh = new THREE.Mesh(isRock ? rockGeo : coneGeo, isRock ? rockMat : tuftMat)
      this._placeTuft(mesh)
      this.scene.add(mesh)
      this._scrollItems.push({
        mesh,
        wrap: GAME.worldWrapLength,
        // 点缀物回绕时重新随机位置，制造"无穷草原"的错觉
        respawn: () => this._placeTuft(mesh)
      })
    }
  }

  /**
   * 随机放置一个草原点缀物
   * x 避开跑道（跑道半宽约 3.4），z 分布于整个回绕区间
   * @param {THREE.Mesh} mesh 待放置的点缀物
   */
  _placeTuft(mesh) {
    const side = Math.random() < 0.5 ? -1 : 1
    const x = side * (4.2 + Math.random() * 16)
    const z = GAME.worldWrapZ - Math.random() * GAME.worldWrapLength
    const s = 0.7 + Math.random() * 0.9 // 随机大小，避免阵列感
    mesh.position.set(x, 0, z)
    mesh.scale.setScalar(s)
    mesh.rotation.y = Math.random() * Math.PI * 2
  }

  /**
   * 赛道滚动：所有滚动元素向 +z 移动，越过边界即回绕
   * @param {number} dt 时间增量（秒）
   * @param {number} speed 当前前进速度（单位/秒）
   */
  update(dt, speed) {
    const dz = speed * dt
    for (const item of this._scrollItems) {
      item.mesh.position.z += dz
      if (item.mesh.position.z > GAME.worldWrapZ) {
        item.mesh.position.z -= item.wrap
        if (item.respawn) item.respawn()
      }
    }
  }
}
