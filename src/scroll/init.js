import {
  hasPerspective,
  hasTransition,
  hasTransform,
  hasTouch,
  style,
  offset,
  addEvent,
  removeEvent,
  getRect,
  preventDefaultException
} from '../util/dom'

import { extend } from '../util/lang'

const DEFAULT_OPTIONS = {
  startX: 0,
  startY: 0,
  scrollX: false,
  scrollY: true,
  freeScroll: false,
  directionLockThreshold: 5,
  eventPassthrough: '',
  click: false,
  tap: false,
  bounce: true,
  bounceTime: 700,
  momentum: true,
  momentumLimitTime: 300,
  momentumLimitDistance: 15,
  swipeTime: 2500,
  swipeBounceTime: 500,
  deceleration: 0.001,
  flickLimitTime: 200,
  flickLimitDistance: 100,
  resizePolling: 60,
  probeType: 0,
  preventDefault: true,
  preventDefaultException: {
    tagName: /^(INPUT|TEXTAREA|BUTTON|SELECT)$/
  },
  HWCompositing: true,
  useTransition: true,
  useTransform: true,
  bindToWrapper: false,
  disableMouse: hasTouch,
  disableTouch: !hasTouch,
  observeDOM: true,
  /**
   * for picker
   * wheel: {
   *   selectedIndex: 0,
   *   rotate: 25,
   *   adjustTime: 400
   *   wheelWrapperClass: 'wheel-scroll',
   *   wheelItemClass: 'wheel-item'
   * }
   */
  wheel: false,
  /**
   * for slide
   * snap: {
   *   loop: false,
   *   el: domEl,
   *   threshold: 0.1,
   *   stepX: 100,
   *   stepY: 100,
   *   listenFlick: true
   * }
   */
  snap: false,
  /**
   * for scrollbar
   * scrollbar: {
   *   fade: true
   * }
   */
  scrollbar: false,
  /**
   * for pull down and refresh
   * pullDownRefresh: {
   *   threshold: 50,
   *   stop: 20
   * }
   */
  pullDownRefresh: false,
  /**
   * for pull up and load
   * pullUpLoad: {
   *   threshold: 50
   * }
   */
  pullUpLoad: false
}

export function initMixin(BScroll) {
  // 初始化BScroll
  BScroll.prototype._init = function (el, options) {
    // 主要是处理传入BScroll构造函数的el和options参数
    this._handleOptions(options)

    // init private custom events
    // 利用空对象来做事件的存储系统
    // 比如 new BScroll().on('scroll', function scrollCb () {})
    /* 
    this._events = {
        scroll: [[scrollCb, context]]
    } 
    */
    this._events = {}

    this.x = 0
    this.y = 0
    this.directionX = 0
    this.directionY = 0
    // 给this.wrapper注册对应的dom事件
    this._addDOMEvents()

    this._initExtFeatures()

    this._watchTransition()

    if (this.options.observeDOM) {
      // 利用MutationObserver或者轮询去动态refresh
      // 因为数据this.wrapper里面的子元素发生改变，bs是需要重新计算高度的
      this._initDOMObserver()
    }
    // 计算this.scroller的高度
    this.refresh()
    // snap是为了初始化slider才会用到的，默认为false，如果需要初始化slider，snap需要配置一个对象
    // 详见https://ustbhuangyi.github.io/better-scroll/doc/zh-hans/options-advanced.html#snap
    if (!this.options.snap) {
      this.scrollTo(this.options.startX, this.options.startY)
    }

    this.enable()
  }

  BScroll.prototype._handleOptions = function (options) {
    this.options = extend({}, DEFAULT_OPTIONS, options)

    this.translateZ = this.options.HWCompositing && hasPerspective ? ' translateZ(0)' : ''

    this.options.useTransition = this.options.useTransition && hasTransition
    this.options.useTransform = this.options.useTransform && hasTransform

    this.options.preventDefault = !this.options.eventPassthrough && this.options.preventDefault

    // If you want eventPassthrough I have to lock one of the axes
    this.options.scrollX = this.options.eventPassthrough === 'horizontal' ? false : this.options.scrollX
    this.options.scrollY = this.options.eventPassthrough === 'vertical' ? false : this.options.scrollY

    // With eventPassthrough we also need lockDirection mechanism
    this.options.freeScroll = this.options.freeScroll && !this.options.eventPassthrough
    this.options.directionLockThreshold = this.options.eventPassthrough ? 0 : this.options.directionLockThreshold

    if (this.options.tap === true) {
      this.options.tap = 'tap'
    }
  }

  BScroll.prototype._addDOMEvents = function () {
    let eventOperation = addEvent
    // 绑定一些事件
    this._handleDOMEvents(eventOperation)
  }

  BScroll.prototype._removeDOMEvents = function () {
    let eventOperation = removeEvent
    this._handleDOMEvents(eventOperation)
  }

  BScroll.prototype._handleDOMEvents = function (eventOperation) {
    let target = this.options.bindToWrapper ? this.wrapper : window
    // 只要eventOperation第三个参数是一个对象，则会执行对象的handleEvent方法
    eventOperation(window, 'orientationchange', this)
    eventOperation(window, 'resize', this)
    // 如果click为true,给this.wrapper增加click事件，不过属于捕获事件
    if (this.options.click) {
      // 这里传true的原因，是为了在捕获阶段就阻止事件的冒泡
      // 有很多在用better-scroll库的人一直好奇，为什么在移动端bs库不能绑定点击事件
      // 因为对于移动端来说，只要绑定了touch事件,并且在touch事件的回调函数去preventDefault
      // 就能阻止所有的click事件
      // 而bs就是利用了这个特性，但是只要使用者在初始化BS库的时候传入click:true
      // bs会通过createEvent，派发一个click事件，并且这个事件对象的_constructed为true
      // 上面说到移动端可以通过touch事件去preventDefault，从而阻止click事件，但是在pc端，是无法阻止click事件
      // 这就是为什么有些人在pc端使用这个插件会执行两次click，是因为先执行了自己绑定的click，并且还执行了bs派发的click
      // 所以下面这行代码，是为了在捕获阶段就阻止掉pc的click事件，放行bs自己派发的click事件
      // BScroll.prototype.handleEvent这个函数体里面，当case为click，并且_constructed为false，就阻止pc的click事件
      eventOperation(this.wrapper, 'click', this, true)
    }
    // 如果不支持touch事件，绑定对应的鼠标事件
    if (!this.options.disableMouse) {
      eventOperation(this.wrapper, 'mousedown', this)
      eventOperation(target, 'mousemove', this)
      eventOperation(target, 'mousecancel', this)
      eventOperation(target, 'mouseup', this)
    }
    // 如果支持touch事件，绑定对应的touch事件
    if (hasTouch && !this.options.disableTouch) {
      eventOperation(this.wrapper, 'touchstart', this)
      eventOperation(target, 'touchmove', this)
      eventOperation(target, 'touchcancel', this)
      eventOperation(target, 'touchend', this)
    }
    // 监听this.scroller的transitionend事件
    // style.transitionEnd这个地方有bug，如果没有浏览器的前缀，css过渡结束的事件名应该是transitionend
    // 而style.transitionEnd会是transitionEnd
    eventOperation(this.scroller, style.transitionEnd, this)
  }
  // 配置一些高级特性，比如slider(轮播图)，scrollbar(用div模拟的滚动条)，pullUpLoad(上拉加载)，pullDownRefresh(下拉刷新）
  BScroll.prototype._initExtFeatures = function () {
    // 如果要开启对应的特性，snap，scrollbar，pullUpLoad等必须是一个对象
    // 对象对应的key/value，黄老板给了对应的参考值，DEFAULT_OPTIONS
    if (this.options.snap) {
      this._initSnap()
    }
    if (this.options.scrollbar) {
      this._initScrollbar()
    }
    if (this.options.pullUpLoad) {
      this._initPullUp()
    }
    if (this.options.pullDownRefresh) {
      this._initPullDown()
    }
    if (this.options.wheel) {
      this._initWheel()
    }
  }
  // watch this.scroller是否还在执行css过渡
  BScroll.prototype._watchTransition = function () {
    // 如果不支持Object.defineProperty（ie9以下）,
    if (typeof Object.defineProperty !== 'function') {
      return
    }
    let me = this
    let isInTransition = false
    Object.defineProperty(this, 'isInTransition', {
      get() {
        return isInTransition
      },
      set(newVal) {
        isInTransition = newVal
        // fix issue #359
        let el = me.scroller.children.length ? me.scroller.children : [me.scroller]
        // 如果this.scroller还在执行css过渡，利用css3 的pointer-events属性禁止事件
        let pointerEvents = isInTransition ? 'none' : 'auto'
        for (let i = 0; i < el.length; i++) {
          el[i].style.pointerEvents = pointerEvents
        }
      }
    })
  }

  BScroll.prototype._initDOMObserver = function () {
    // 如果支持MutationObserver
    if (typeof MutationObserver !== 'undefined') {
      let timer
      let observer = new MutationObserver((mutations) => {
        // don't do any refresh during the transition, or outside of the boundaries
        if (this._shouldNotRefresh()) {
          return
        }
        let immediateRefresh = false
        let deferredRefresh = false
        for (let i = 0; i < mutations.length; i++) {
          const mutation = mutations[i]
          if (mutation.type !== 'attributes') {
            immediateRefresh = true
            break
          } else {
            if (mutation.target !== this.scroller) {
              deferredRefresh = true
              break
            }
          }
        }
        if (immediateRefresh) {
          this.refresh()
        } else if (deferredRefresh) {
          // attributes changes too often
          clearTimeout(timer)
          timer = setTimeout(() => {
            this.refresh()
          }, 60)
        }
      })
      const config = {
        attributes: true,
        childList: true,
        subtree: true
      }
      observer.observe(this.scroller, config)

      this.on('destroy', () => {
        observer.disconnect()
      })
    } else {
      // 如果不支持MutationObserver，那么只能采用轮询的方法
      this._checkDOMUpdate()
    }
  }

  BScroll.prototype._shouldNotRefresh = function () {
    let outsideBoundaries = this.x > 0 || this.x < this.maxScrollX || this.y > 0 || this.y < this.maxScrollY

    return this.isInTransition || this.stopFromTransition || outsideBoundaries
  }
  // 如果不支持MutationObserver,1s轮询一次，来diff width或者height的变化，来动态的refresh
  BScroll.prototype._checkDOMUpdate = function () {
    let scrollerRect = getRect(this.scroller)
    let oldWidth = scrollerRect.width
    let oldHeight = scrollerRect.height

    function check() {
      if (this.destroyed) {
        return
      }
      scrollerRect = getRect(this.scroller)
      let newWidth = scrollerRect.width
      let newHeight = scrollerRect.height

      if (oldWidth !== newWidth || oldHeight !== newHeight) {
        this.refresh()
      }
      oldWidth = newWidth
      oldHeight = newHeight

      next.call(this)
    }

    function next() {
      setTimeout(() => {
        check.call(this)
      }, 1000)
    }

    next.call(this)
  }

  BScroll.prototype.handleEvent = function (e) {
    switch (e.type) {
      case 'touchstart':
      case 'mousedown':
        this._start(e)
        break
      case 'touchmove':
      case 'mousemove':
        this._move(e)
        break
      case 'touchend':
      case 'mouseup':
      case 'touchcancel':
      case 'mousecancel':
        this._end(e)
        break
      case 'orientationchange':
      case 'resize':
        this._resize()
        break
      case 'transitionend':
      case 'webkitTransitionEnd':
      case 'oTransitionEnd':
      case 'MSTransitionEnd':
        this._transitionEnd(e)
        break
      case 'click':
        // 如果可以滚动并且_constructed为undefined
        if (this.enabled && !e._constructed) {
          // 如果e.target不是input，select，button，阻止默认行为以及冒泡
          if (!preventDefaultException(e.target, this.options.preventDefaultException)) {
            e.preventDefault()
            e.stopPropagation()
          }
        }
        break
    }
  }

  BScroll.prototype.refresh = function () {
    let wrapperRect = getRect(this.wrapper)
    this.wrapperWidth = wrapperRect.width
    this.wrapperHeight = wrapperRect.height

    let scrollerRect = getRect(this.scroller)
    this.scrollerWidth = scrollerRect.width
    this.scrollerHeight = scrollerRect.height

    const wheel = this.options.wheel
    // 如果开启了picker 组件的配置
    if (wheel) {
      this.items = this.scroller.children
      this.options.itemHeight = this.itemHeight = this.items.length ? this.scrollerHeight / this.items.length : 0
      if (this.selectedIndex === undefined) {
        this.selectedIndex = wheel.selectedIndex || 0
      }
      this.options.startY = -this.selectedIndex * this.itemHeight
      this.maxScrollX = 0
      this.maxScrollY = -this.itemHeight * (this.items.length - 1)
    } else {
      // this.scroller最大滚动的范围
      this.maxScrollX = this.wrapperWidth - this.scrollerWidth
      this.maxScrollY = this.wrapperHeight - this.scrollerHeight
    }
    // 是否开启了水平滚动
    this.hasHorizontalScroll = this.options.scrollX && this.maxScrollX < 0
    // 是否开启了垂直滚动
    this.hasVerticalScroll = this.options.scrollY && this.maxScrollY < 0
    // 如果未开启水平滚动
    if (!this.hasHorizontalScroll) {
      this.maxScrollX = 0
      this.scrollerWidth = this.wrapperWidth
    }
    // 如果未开启垂直滚动  
    if (!this.hasVerticalScroll) {
      this.maxScrollY = 0
      this.scrollerHeight = this.wrapperHeight
    }

    this.endTime = 0
    this.directionX = 0
    this.directionY = 0
    this.wrapperOffset = offset(this.wrapper)

    this.trigger('refresh')

    this.resetPosition()
  }

  BScroll.prototype.enable = function () {
    this.enabled = true
  }

  BScroll.prototype.disable = function () {
    this.enabled = false
  }
}