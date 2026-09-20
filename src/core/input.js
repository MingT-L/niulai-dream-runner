/**
 * ============================================================
 * 输入系统：键盘 + 触摸手势统一分发
 * ------------------------------------------------------------
 * 键盘：← → / A D 变道　↑ / W / 空格 跳跃　P / Esc 暂停
 * 触摸：左右滑动变道 · 上滑或轻点跳跃
 * 手势判定忽略 UI 按钮上的触摸（避免点"暂停"误触跳跃）。
 * ============================================================
 */
export class Input {
  /**
   * @param {Object} handlers 回调集合
   * @param {Function} [handlers.onLeft] 左变道
   * @param {Function} [handlers.onRight] 右变道
   * @param {Function} [handlers.onJump] 跳跃
   * @param {Function} [handlers.onPause] 暂停/继续
   */
  constructor(handlers) {
    this.handlers = handlers
    this._bindKeyboard()
    this._bindTouch()
  }

  /** 键盘事件绑定（keydown，过滤长按重复触发） */
  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return // 长按不重复触发一次性动作
      const h = this.handlers
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          h.onLeft?.()
          break
        case 'ArrowRight':
        case 'KeyD':
          h.onRight?.()
          break
        case 'ArrowUp':
        case 'KeyW':
        case 'Space':
          h.onJump?.()
          // 阻止空格滚动页面（游戏全屏场景下防御）
          if (e.code === 'Space') e.preventDefault()
          break
        case 'KeyP':
        case 'Escape':
          h.onPause?.()
          break
      }
    })
  }

  /** 触摸手势：滑动方向判定 + 轻点即跳 */
  _bindTouch() {
    const SWIPE_THRESHOLD = 28 // 滑动判定阈值（像素）
    let startX = 0
    let startY = 0

    window.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0]
      startX = t.clientX
      startY = t.clientY
    }, { passive: true })

    window.addEventListener('touchend', (e) => {
      // 忽略 UI 按钮（暂停/菜单等）上的触摸，避免误触发游戏动作
      if (e.target.closest?.('#ui-overlay')) return

      const t = e.changedTouches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      const h = this.handlers

      if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) {
        // 位移极小 → 轻点 = 跳跃
        h.onJump?.()
      } else if (Math.abs(dx) > Math.abs(dy)) {
        // 水平滑动 → 变道
        if (dx > 0) h.onRight?.()
        else h.onLeft?.()
      } else if (dy < 0) {
        // 上滑 → 跳跃（下滑暂不绑定动作）
        h.onJump?.()
      }
    }, { passive: true })
  }
}
