/**
 * ============================================================
 * 水墨风格材质工厂
 * ------------------------------------------------------------
 * 统一创建 MeshToonMaterial（阶梯光影，贴近水墨平涂质感）。
 * 相同配置的材质全局复用同一实例（缓存池），
 * 降低内存占用与渲染状态切换开销。
 * ============================================================
 */
import * as THREE from 'three'

// 三阶灰度渐变贴图：让 toon 光影过渡柔和（默认两阶过硬，缺乏水墨晕染感）
let gradientMap = null
function getGradientMap() {
  if (!gradientMap) {
    // 3 个灰阶：暗部 / 中间调 / 亮部（红通道作为灰度值）
    const data = new Uint8Array([90, 170, 255])
    gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RedFormat)
    gradientMap.minFilter = THREE.NearestFilter
    gradientMap.magFilter = THREE.NearestFilter
    gradientMap.needsUpdate = true
  }
  return gradientMap
}

// 材质缓存池：key = 颜色 + 选项序列化
const cache = new Map()

/**
 * 创建（或复用）水墨风格材质
 * MeshToonMaterial 不支持 flatShading：需要平面块面效果（如墨岩）时
 * 自动降级为 MeshLambertMaterial（其 flatShading 表现与水墨山石契合）。
 * @param {number} color 十六进制颜色（如 0xf7f4ec）
 * @param {Object} [options] 额外材质参数（flatShading / emissive 等）
 * @returns {THREE.Material} 复用的材质实例
 */
export function toonMat(color, options = {}) {
  const key = `${color}|${JSON.stringify(options)}`
  if (!cache.has(key)) {
    if (options.flatShading) {
      // 平面着色分支：块面硬朗的山石质感
      cache.set(key, new THREE.MeshLambertMaterial({ color, ...options }))
    } else {
      // 默认分支：toon 阶梯光影（水墨平涂）
      cache.set(key, new THREE.MeshToonMaterial({
        color,
        gradientMap: getGradientMap(),
        ...options
      }))
    }
  }
  return cache.get(key)
}
