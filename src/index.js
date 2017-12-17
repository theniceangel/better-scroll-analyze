import { eventMixin } from './scroll/event'
import { initMixin } from './scroll/init'
import { coreMixin } from './scroll/core'
import { snapMixin } from './scroll/snap'
import { wheelMixin } from './scroll/wheel'
import { scrollbarMixin } from './scroll/scrollbar'
import { pullDownMixin } from './scroll/pulldown'
import { pullUpMixin } from './scroll/pullup'

import { warn } from './util/debug'

// 构造函数
function BScroll(el, options) {
  // 如果传的是字符串，根据字符串去匹配dom，或者直接传入dom元素
  // 这个dom必须是有固定高度的，一般都是绝对定位或者固定定位
  this.wrapper = typeof el === 'string' ? document.querySelector(el) : el
  if (!this.wrapper) {
    warn('can not resolve the wrapper dom')
  }
  // 这个dom是拥有实际高度的，比如this.wrapper的高度限定为400px，this.scroller的高度肯定是大于400
  // 只是this.wrapper设置了overflow:hidden
  // 而better-scroll的核心就在于改变this.wrapper的transformX(水平方向),transformY(垂直方向)，
  // 给你的错觉就是在滚动而已
  this.scroller = this.wrapper.children[0]
  if (!this.scroller) {
    warn('the wrapper need at least one child element to be scroller')
  }
  // cache style for better performance
  // 缓存this.scrolller.style
  this.scrollerStyle = this.scroller.style
  // 调用原型对象上的_init方法
  this._init(el, options)
}

// 给BScroll的原型对象上挂载如下方法
// _init,_handleOptions,_addDOMEvents,_removeDOMEvents,
// _handleDOMEvents,_initExtFeatures,_watchTransition
// _initDOMObserver,_shouldNotRefresh,_checkDOMUpdate
// handleEvent, refresh, enable, disable
initMixin(BScroll)
coreMixin(BScroll)
eventMixin(BScroll)
snapMixin(BScroll)
wheelMixin(BScroll)
scrollbarMixin(BScroll)
pullDownMixin(BScroll)
pullUpMixin(BScroll)

BScroll.Version = '1.5.5'

export default BScroll

