import { DIRECTION_UP } from '../util/const'

export function pullUpMixin(BScroll) {
  BScroll.prototype._initPullUp = function () {
    // must watch scroll in real time
    // 必须将probeType设置为3，因为要实时监控scroller的位置，从而判断是否上拉加载
    this.options.probeType = 3

    this.pullupWatching = false
    // 在滚动过程中，观测是否滑动到底部
    this._watchPullUp()
  }

  BScroll.prototype._watchPullUp = function () {
    if (this.pullupWatching) {
      return
    }
    this.pullupWatching = true
    // 默认距离底部的阈值是0
    const {threshold = 0} = this.options.pullUpLoad

    this.on('scroll', checkToEnd)

    function checkToEnd(pos) {
      if (this.movingDirectionY === DIRECTION_UP && pos.y <= (this.maxScrollY + threshold)) {
        this.trigger('pullingUp')
        this.pullupWatching = false
        // 如果加载完成，移除scroll事件
        this.off('scroll', checkToEnd)
      }
    }
  }
  // 每次加载数据之后，应该调用finishPullUp来重新监听scroller的位置进行下一次上拉加载的探测
  BScroll.prototype.finishPullUp = function () {
    if (this.isInTransition) {
      this.once('scrollEnd', () => {
        this._watchPullUp()
      })
    } else {
      this._watchPullUp()
    }
  }
}
