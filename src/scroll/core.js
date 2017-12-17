import {
  eventType,
  TOUCH_EVENT,
  preventDefaultException,
  tap,
  click,
  style,
  offset
} from '../util/dom'
import { ease } from '../util/ease'
import { momentum } from '../util/momentum'
import { requestAnimationFrame, cancelAnimationFrame } from '../util/raf'
import { getNow } from '../util/lang'
import { DIRECTION_DOWN, DIRECTION_UP, DIRECTION_LEFT, DIRECTION_RIGHT } from '../util/const'

export function coreMixin(BScroll) {
  // touchstart或mousedown事件触发该函数
  BScroll.prototype._start = function (e) {
    let _eventType = eventType[e.type]
    // 如果是鼠标事件，并且不是点击鼠标左键触发的，直接return
    if (_eventType !== TOUCH_EVENT) {
      if (e.button !== 0) {
        return
      }
    }
    if (!this.enabled || this.destroyed || (this.initiated && this.initiated !== _eventType)) {
      return
    }
    this.initiated = _eventType
    // 阻止click事件
    if (this.options.preventDefault && !preventDefaultException(e.target, this.options.preventDefaultException)) {
      e.preventDefault()
    }

    this.moved = false
    this.distX = 0
    this.distY = 0
    this.directionX = 0
    this.directionY = 0
    this.movingDirectionX = 0
    this.movingDirectionY = 0
    this.directionLocked = 0

    this._transitionTime()
    this.startTime = getNow()
    // 如果开启了picker的配置
    if (this.options.wheel) {
      this.target = e.target
    }

    this.stop()

    let point = e.touches ? e.touches[0] : e
    // 存储上次滚动的位置
    this.startX = this.x
    this.startY = this.y
    this.absStartX = this.x
    this.absStartY = this.y
    // 存储touchstart／mousedown时候的x，y坐标值
    this.pointX = point.pageX
    this.pointY = point.pageY
    // 触发beforeScrollStart的钩子
    this.trigger('beforeScrollStart')
  }
  // touchmove或mousemove事件触发该函数
  BScroll.prototype._move = function (e) {
    if (!this.enabled || this.destroyed || eventType[e.type] !== this.initiated) {
      return
    }

    if (this.options.preventDefault) {
      e.preventDefault()
    }
    // 存储滑动的距离（有正负之分）
    let point = e.touches ? e.touches[0] : e
    let deltaX = point.pageX - this.pointX
    let deltaY = point.pageY - this.pointY

    this.pointX = point.pageX
    this.pointY = point.pageY

    this.distX += deltaX
    this.distY += deltaY

    let absDistX = Math.abs(this.distX)
    let absDistY = Math.abs(this.distY)

    let timestamp = getNow()
    // 必须在momentumLimitTime时间内，滚动的距离大于momentumLimitDistance，才算滚动
    // We need to move at least momentumLimitDistance pixels for the scrolling to initiate
    if (timestamp - this.endTime > this.options.momentumLimitTime && (absDistY < this.options.momentumLimitDistance && absDistX < this.options.momentumLimitDistance)) {
      return
    }

    // If you are scrolling in one direction lock the other
    if (!this.directionLocked && !this.options.freeScroll) {
      // 如果水平滚动的距离小于垂直方向，这个时候认为是在垂直滚动，我们就锁住水平滚动
      if (absDistX > absDistY + this.options.directionLockThreshold) {
        this.directionLocked = 'h'		// lock horizontally
      } else if (absDistY >= absDistX + this.options.directionLockThreshold) {// 如果水平滚动的距离大于垂直方向，这个时候认为是在水平滚动，我们就锁住垂直滚动
        this.directionLocked = 'v'		// lock vertically
      } else {// 否则我们水平和垂直方向都滚动，这种滚动作者称之为freescroll，详见https://ustbhuangyi.github.io/better-scroll/#/examples/free-scroll/en
        this.directionLocked = 'n'		// no lock
      }
    }

    if (this.directionLocked === 'h') {
      // bs保留水平滚动，垂直滚动仍是原生滚动
      if (this.options.eventPassthrough === 'vertical') {
        e.preventDefault()
      } else if (this.options.eventPassthrough === 'horizontal') {// bs保留水平滚动，但是又想保持原生水平滚动，那么直接return
        this.initiated = false
        return
      }
      deltaY = 0
    } else if (this.directionLocked === 'v') {
      if (this.options.eventPassthrough === 'horizontal') {
        e.preventDefault()
      } else if (this.options.eventPassthrough === 'vertical') {
        this.initiated = false
        return
      }
      deltaX = 0
    }

    deltaX = this.hasHorizontalScroll ? deltaX : 0
    deltaY = this.hasVerticalScroll ? deltaY : 0
    // 判断此次滚动的方向，如果为正，说明手指向右或者向下，如果为0，说明未发生滚动
    this.movingDirectionX = deltaX > 0 ? DIRECTION_RIGHT : deltaX < 0 ? DIRECTION_LEFT : 0
    this.movingDirectionY = deltaY > 0 ? DIRECTION_DOWN : deltaY < 0 ? DIRECTION_UP : 0
    // 这次滚动的差值，与上次滚动的位置做合并，永远得到最新的this.scroller的位置
    let newX = this.x + deltaX
    let newY = this.y + deltaY

    // Slow down or stop if outside of the boundaries
    // 只要滑出来边界，无论是顶部溢出，还是底部溢出，这里都会修正一下this.scroller，并不会取手指实际滑动的距离
    // 而是如下所示，deltaX / 3
    if (newX > 0 || newX < this.maxScrollX) {
      if (this.options.bounce) {
        newX = this.x + deltaX / 3
      } else {
        newX = newX > 0 ? 0 : this.maxScrollX
      }
    }
    if (newY > 0 || newY < this.maxScrollY) {
      if (this.options.bounce) {
        newY = this.y + deltaY / 3
      } else {
        newY = newY > 0 ? 0 : this.maxScrollY
      }
    }
    // 触发开始滑动的钩子
    if (!this.moved) {
      this.moved = true
      this.trigger('scrollStart')
    }
    // 滑动到指定的位置
    this._translate(newX, newY)
    // 非实时地派发scroll的位置
    if (timestamp - this.startTime > this.options.momentumLimitTime) {
      this.startTime = timestamp
      this.startX = this.x
      this.startY = this.y

      if (this.options.probeType === 1) {
        this.trigger('scroll', {
          x: this.x,
          y: this.y
        })
      }
    }
    // 实时地派发scroll的位置
    if (this.options.probeType > 1) {
      this.trigger('scroll', {
        x: this.x,
        y: this.y
      })
    }

    let scrollLeft = document.documentElement.scrollLeft || window.pageXOffset || document.body.scrollLeft
    let scrollTop = document.documentElement.scrollTop || window.pageYOffset || document.body.scrollTop

    let pX = this.pointX - scrollLeft
    let pY = this.pointY - scrollTop

    if (pX > document.documentElement.clientWidth - this.options.momentumLimitDistance || pX < this.options.momentumLimitDistance || pY < this.options.momentumLimitDistance || pY > document.documentElement.clientHeight - this.options.momentumLimitDistance
    ) {
      this._end(e)
    }
  }
  // touchend,touchcancel或mouseup,mousecancel事件触发该函数
  BScroll.prototype._end = function (e) {
    if (!this.enabled || this.destroyed || eventType[e.type] !== this.initiated) {
      return
    }
    this.initiated = false

    if (this.options.preventDefault && !preventDefaultException(e.target, this.options.preventDefaultException)) {
      e.preventDefault()
    }

    this.trigger('touchEnd', {
      x: this.x,
      y: this.y
    })

    let preventClick = this.stopFromTransition
    this.stopFromTransition = false

    // if configure pull down refresh, check it first
    if (this.options.pullDownRefresh && this._checkPullDown()) {
      return
    }

    // reset if we are outside of the boundaries
    // 如果this.scroller越界，设置回弹效果
    if (this.resetPosition(this.options.bounceTime, ease.bounce)) {
      return
    }
    this.isInTransition = false
    // ensures that the last position is rounded
    let newX = Math.round(this.x)
    let newY = Math.round(this.y)

    // we scrolled less than 15 pixels
    if (!this.moved) {
      if (this.options.wheel) {
        if (this.target && this.target.className === this.options.wheel.wheelWrapperClass) {
          let index = Math.abs(Math.round(newY / this.itemHeight))
          let _offset = Math.round((this.pointY + offset(this.target).top - this.itemHeight / 2) / this.itemHeight)
          this.target = this.items[index + _offset]
        }
        this.scrollToElement(this.target, this.options.wheel.adjustTime || 400, true, true, ease.swipe)
      } else {
        if (!preventClick) {
          if (this.options.tap) {
            tap(e, this.options.tap)
          }

          if (this.options.click) {
            click(e)
          }
        }
      }
      this.trigger('scrollCancel')
      return
    }

    this.scrollTo(newX, newY)

    let deltaX = newX - this.absStartX
    let deltaY = newY - this.absStartY
    this.directionX = deltaX > 0 ? DIRECTION_RIGHT : deltaX < 0 ? DIRECTION_LEFT : 0
    this.directionY = deltaY > 0 ? DIRECTION_DOWN : deltaY < 0 ? DIRECTION_UP : 0

    this.endTime = getNow()

    let duration = this.endTime - this.startTime
    let absDistX = Math.abs(newX - this.startX)
    let absDistY = Math.abs(newY - this.startY)

    // flick
    if (this._events.flick && duration < this.options.flickLimitTime && absDistX < this.options.flickLimitDistance && absDistY < this.options.flickLimitDistance) {
      this.trigger('flick')
      return
    }

    let time = 0
    // start momentum animation if needed
    // 当快速在屏幕上滑动一段距离的时候，会根据滑动的距离和时间计算出动量，并生成滚动动画
    // 因为用户可能在某一个瞬间滚动一小段距离，所以这个时候应该是app native那种滚动一大段的动画，而不是再根据手指的位移来计算this.scroller的位置了
    if (this.options.momentum && duration < this.options.momentumLimitTime && (absDistY > this.options.momentumLimitDistance || absDistX > this.options.momentumLimitDistance)) {
      let momentumX = this.hasHorizontalScroll ? momentum(this.x, this.startX, duration, this.maxScrollX, this.options.bounce ? this.wrapperWidth : 0, this.options)
        : {destination: newX, duration: 0}
      let momentumY = this.hasVerticalScroll ? momentum(this.y, this.startY, duration, this.maxScrollY, this.options.bounce ? this.wrapperHeight : 0, this.options)
        : {destination: newY, duration: 0}
      newX = momentumX.destination
      newY = momentumY.destination
      time = Math.max(momentumX.duration, momentumY.duration)
      this.isInTransition = true
    } else {
      if (this.options.wheel) {
        newY = Math.round(newY / this.itemHeight) * this.itemHeight
        time = this.options.wheel.adjustTime || 400
      }
    }

    let easing = ease.swipe
    if (this.options.snap) {
      let snap = this._nearestSnap(newX, newY)
      this.currentPage = snap
      time = this.options.snapSpeed || Math.max(
          Math.max(
            Math.min(Math.abs(newX - snap.x), 1000),
            Math.min(Math.abs(newY - snap.y), 1000)
          ), 300)
      newX = snap.x
      newY = snap.y

      this.directionX = 0
      this.directionY = 0
      easing = ease.bounce
    }

    if (newX !== this.x || newY !== this.y) {
      // change easing function when scroller goes out of the boundaries
      if (newX > 0 || newX < this.maxScrollX || newY > 0 || newY < this.maxScrollY) {
        easing = ease.swipeBounce
      }
      this.scrollTo(newX, newY, time, easing)
      return
    }

    if (this.options.wheel) {
      this.selectedIndex = Math.round(Math.abs(this.y / this.itemHeight))
    }
    this.trigger('scrollEnd', {
      x: this.x,
      y: this.y
    })
  }

  BScroll.prototype._resize = function () {
    if (!this.enabled) {
      return
    }

    clearTimeout(this.resizeTimeout)
    this.resizeTimeout = setTimeout(() => {
      this.refresh()
    }, this.options.resizePolling)
  }

  BScroll.prototype._startProbe = function () {
    cancelAnimationFrame(this.probeTimer)
    this.probeTimer = requestAnimationFrame(probe)

    let me = this

    function probe() {
      if (!me.isInTransition) {
        return
      }
      let pos = me.getComputedPosition()
      me.trigger('scroll', pos)
      me.probeTimer = requestAnimationFrame(probe)
    }
  }
  // 设置需要进行css transition的css样式
  BScroll.prototype._transitionProperty = function (property = 'transform') {
    this.scrollerStyle[style.transitionProperty] = property
  }
  // 设置需要进行transition的时间
  BScroll.prototype._transitionTime = function (time = 0) {
    this.scrollerStyle[style.transitionDuration] = time + 'ms'
    // 如果是picker组件，循环给每个item加上持续时间
    if (this.options.wheel) {
      for (let i = 0; i < this.items.length; i++) {
        this.items[i].style[style.transitionDuration] = time + 'ms'
      }
    }
    // 如果开启了scrollBar
    if (this.indicators) {
      for (let i = 0; i < this.indicators.length; i++) {
        this.indicators[i].transitionTime(time)
      }
    }
  }

  BScroll.prototype._transitionTimingFunction = function (easing) {
    this.scrollerStyle[style.transitionTimingFunction] = easing

    if (this.options.wheel) {
      for (let i = 0; i < this.items.length; i++) {
        this.items[i].style[style.transitionTimingFunction] = easing
      }
    }

    if (this.indicators) {
      for (let i = 0; i < this.indicators.length; i++) {
        this.indicators[i].transitionTimingFunction(easing)
      }
    }
  }

  BScroll.prototype._transitionEnd = function (e) {
    // 如果当前targer不是scroller,或者transition过渡执行完了
    if (e.target !== this.scroller || !this.isInTransition) {
      return
    }
    // 设置需要进行transition的时间
    this._transitionTime()
    if (!this.pulling && !this.resetPosition(this.options.bounceTime, ease.bounce)) {
      this.isInTransition = false
      this.trigger('scrollEnd', {
        x: this.x,
        y: this.y
      })
    }
  }
  // 修改this.scroller的top、left或者translate，如果开启了scrollBar滚动条的配置，同时update它的位置
  BScroll.prototype._translate = function (x, y) {
    // 如果使用transform
    if (this.options.useTransform) {
      this.scrollerStyle[style.transform] = `translate(${x}px,${y}px)${this.translateZ}`
    } else {
      // 这里做了四舍五入处理,
      // 有可能left和top渲染必须是整数吧
      x = Math.round(x)
      y = Math.round(y)
      this.scrollerStyle.left = `${x}px`
      this.scrollerStyle.top = `${y}px`
    }
    // 如果开启了picker组件的配置
    if (this.options.wheel) {
      const {rotate = 25} = this.options.wheel
      for (let i = 0; i < this.items.length; i++) {
        let deg = rotate * (y / this.itemHeight + i)
        this.items[i].style[style.transform] = `rotateX(${deg}deg)`
      }
    }
    // 记录当前滚动的位置，向下滚动为负值，向上相反
    this.x = x
    this.y = y
    // 如果开启了scrollBar的配置
    if (this.indicators) {
      for (let i = 0; i < this.indicators.length; i++) {
        this.indicators[i].updatePosition()
      }
    }
  }
  // 为了兼容低版本的android机，采用requestAnimationFrame动态改变this.scroller的translate值
  // 因为会通过translateZ来开启GPU加速，会比用transition过渡要好一点
  // 一般情况下是用transition过渡，当然用户可以通过传入useTransition为false，
  BScroll.prototype._animate = function (destX, destY, duration, easingFn) {
    let me = this
    let startX = this.x
    let startY = this.y
    let startTime = getNow()
    let destTime = startTime + duration

    function step() {
      let now = getNow()

      if (now >= destTime) {
        me.isAnimating = false
        me._translate(destX, destY)

        if (!me.pulling && !me.resetPosition(me.options.bounceTime)) {
          me.trigger('scrollEnd', {
            x: me.x,
            y: me.y
          })
        }
        return
      }
      now = (now - startTime) / duration
      let easing = easingFn(now)
      let newX = (destX - startX) * easing + startX
      let newY = (destY - startY) * easing + startY

      me._translate(newX, newY)

      if (me.isAnimating) {
        me.animateTimer = requestAnimationFrame(step)
      }

      if (me.options.probeType === 3) {
        me.trigger('scroll', {
          x: me.x,
          y: me.y
        })
      }
    }

    this.isAnimating = true
    cancelAnimationFrame(this.animateTimer)
    step()
  }

  BScroll.prototype.scrollBy = function (x, y, time = 0, easing = ease.bounce) {
    x = this.x + x
    y = this.y + y

    this.scrollTo(x, y, time, easing)
  }

  BScroll.prototype.scrollTo = function (x, y, time = 0, easing = ease.bounce) {
    // 设置isInTransition的值，会触发_watchTransition函数里面对isInTransition的响应式，进而对this.scroller的子元素的point-events做处理
    this.isInTransition = this.options.useTransition && time > 0 && (x !== this.x || y !== this.y)
    
    // 如果time为0或者支持transition属性
    if (!time || this.options.useTransition) {
      // 设置需要进行css transition的css样式
      this._transitionProperty()

      // 过渡的计算方法,比如linear，ease，cubic-bezier(0.1, 0.7, 1.0, 0.1),steps(4, end)等等
      this._transitionTimingFunction(easing.style)

      // 设置需要进行transition的时间
      this._transitionTime(time)

      // 处理transform: translate，这个是bs的核心，也是为啥你手指拨动几下，就可以实现滑动
      // 其实就是this.wrapper是一个有固定宽度或者高度的父元素，并且overflow为hidden,而this.scroller作为this.wrapper的子元素
      // 不断的改变this.scroller的transform:translate,这样给人的视觉就和浏览器的滚动一样
      this._translate(x, y)

      if (time && this.options.probeType === 3) {
        this._startProbe()
      }

      if (this.options.wheel) {
        if (y > 0) {
          this.selectedIndex = 0
        } else if (y < this.maxScrollY) {
          this.selectedIndex = this.items.length - 1
        } else {
          this.selectedIndex = Math.round(Math.abs(y / this.itemHeight))
        }
      }
    } else {
      // 如果不支持transition属性
      this._animate(x, y, time, easing.fn)
    }
  }
  // 滚动到某个dom元素
  BScroll.prototype.scrollToElement = function (el, time, offsetX, offsetY, easing) {
    if (!el) {
      return
    }
    el = el.nodeType ? el : this.scroller.querySelector(el)

    if (this.options.wheel && el.className !== this.options.wheel.wheelItemClass) {
      return
    }

    let pos = offset(el)
    pos.left -= this.wrapperOffset.left
    pos.top -= this.wrapperOffset.top

    // if offsetX/Y are true we center the element to the screen
    if (offsetX === true) {
      offsetX = Math.round(el.offsetWidth / 2 - this.wrapper.offsetWidth / 2)
    }
    if (offsetY === true) {
      offsetY = Math.round(el.offsetHeight / 2 - this.wrapper.offsetHeight / 2)
    }

    pos.left -= offsetX || 0
    pos.top -= offsetY || 0
    pos.left = pos.left > 0 ? 0 : pos.left < this.maxScrollX ? this.maxScrollX : pos.left
    pos.top = pos.top > 0 ? 0 : pos.top < this.maxScrollY ? this.maxScrollY : pos.top

    if (this.options.wheel) {
      pos.top = Math.round(pos.top / this.itemHeight) * this.itemHeight
    }

    this.scrollTo(pos.left, pos.top, time, easing)
  }
  // 如果this.scroller超过了边界，假如是垂直滚动，即this.y > 0 || this.y < this.maxScrollY，所以执行回弹的逻辑
  BScroll.prototype.resetPosition = function (time = 0, easeing = ease.bounce) {
    let x = this.x
    if (!this.hasHorizontalScroll || x > 0) {
      x = 0
    } else if (x < this.maxScrollX) {
      x = this.maxScrollX
    }

    let y = this.y
    if (!this.hasVerticalScroll || y > 0) {
      y = 0
    } else if (y < this.maxScrollY) {
      y = this.maxScrollY
    }

    if (x === this.x && y === this.y) {
      return false
    }

    this.scrollTo(x, y, time, easeing)

    return true
  }
  // 返回this.scroller的translateX，translateY或者left，top
  BScroll.prototype.getComputedPosition = function () {
    let matrix = window.getComputedStyle(this.scroller, null)
    let x
    let y

    if (this.options.useTransform) {
      matrix = matrix[style.transform].split(')')[0].split(', ')
      x = +(matrix[12] || matrix[4])
      y = +(matrix[13] || matrix[5])
    } else {
      x = +matrix.left.replace(/[^-\d.]/g, '')
      y = +matrix.top.replace(/[^-\d.]/g, '')
    }

    return {
      x,
      y
    }
  }
  // 如果上次的过渡还没完成，强制使其完成
  // 比如用户向下滚动了100px，但是在滚动50px的时候，又向上滚动一段距离，所以在滚动到50px的时候，强制执行向上的逻辑
  BScroll.prototype.stop = function () {
    // 如果使用了transition并且当前scroller正在动画
    if (this.options.useTransition && this.isInTransition) {
      this.isInTransition = false
      // 返回this.scroller的translateX，translateY或者left，top
      let pos = this.getComputedPosition()
      // 修改this.scroller的translateX，translateY或者left，top
      this._translate(pos.x, pos.y)
      // 如果开启了picker组件
      if (this.options.wheel) {
        this.target = this.items[Math.round(-pos.y / this.itemHeight)]
      } else {
        this.trigger('scrollEnd', {
          x: this.x,
          y: this.y
        })
      }
      this.stopFromTransition = true
    } else if (!this.options.useTransition && this.isAnimating) {
      //如果用户使用的是requestAnimationframe来改变this.scroller的位置，走到这恶个分支
      this.isAnimating = false
      this.trigger('scrollEnd', {
        x: this.x,
        y: this.y
      })
      this.stopFromTransition = true
    }
  }
  // 销毁BS,移除事件
  BScroll.prototype.destroy = function () {
    this.destroyed = true
    this.trigger('destroy')

    this._removeDOMEvents()
    // remove custom events
    this._events = {}
  }
}