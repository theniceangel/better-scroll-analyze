import { isWeChatDevTools } from './env'

let elementStyle = document.createElement('div').style
// 浏览器前缀的检测
let vendor = (() => {
  let transformNames = {
    webkit: 'webkitTransform',
    Moz: 'MozTransform',
    O: 'OTransform',
    ms: 'msTransform',
    standard: 'transform'
  }

  for (let key in transformNames) {
    if (elementStyle[transformNames[key]] !== undefined) {
      return key
    }
  }

  return false
})()
// 根据传入的css属性，加上对应的浏览器前缀，用在js当中
function prefixStyle(style) {
  if (vendor === false) {
    return false
  }

  if (vendor === 'standard') {
    return style
  }

  return vendor + style.charAt(0).toUpperCase() + style.substr(1)
}
// 给el添加自定义事件
// fn参数必须是function 或者是一个实现了 EventListener 接口的对象
// passive为false,表示fn不会调用preventDefault()
// capture,为true的话表示事件在捕获阶段就执行
export function addEvent(el, type, fn, capture) {
  el.addEventListener(type, fn, {passive: false, capture: !!capture})
}

export function removeEvent(el, type, fn, capture) {
  el.removeEventListener(type, fn, {passive: false, capture: !!capture})
}
// 返回元素距离body的left，top,left与top会计算元素的margin，而不会计算元素的paddding
export function offset(el) {
  let left = 0
  let top = 0

  while (el) {
    left -= el.offsetLeft
    top -= el.offsetTop
    el = el.offsetParent
  }

  return {
    left,
    top
  }
}

let transform = prefixStyle('transform')

export const hasPerspective = prefixStyle('perspective') in elementStyle
// fix issue #361
// 在微信开发者工具，'ontouchstart' in window 会返回null
export const hasTouch = 'ontouchstart' in window || isWeChatDevTools
// 判断是否支持transform
export const hasTransform = transform !== false
// 判断是否支持transition
export const hasTransition = prefixStyle('transition') in elementStyle
// 缓存浏览器支持的transition样式
export const style = {
  transform,
  // 过渡的计算方法,比如linear，ease，cubic-bezier(0.1, 0.7, 1.0, 0.1),steps(4, end)等等
  transitionTimingFunction: prefixStyle('transitionTimingFunction'),
  // 过渡持续的时间,
  transitionDuration: prefixStyle('transitionDuration'),
  // 需要进行过渡的css属性
  transitionProperty: prefixStyle('transitionProperty'),
  // 进行过渡需要delay的时间
  transitionDelay: prefixStyle('transitionDelay'),
  // 进行transform变换的中心点
  transformOrigin: prefixStyle('transformOrigin'),
  transitionEnd: prefixStyle('transitionEnd')
}

export const TOUCH_EVENT = 1
export const MOUSE_EVENT = 2
// 事件Map，touch事件都为1，mouse事件都为2
export const eventType = {
  touchstart: TOUCH_EVENT,
  touchmove: TOUCH_EVENT,
  touchend: TOUCH_EVENT,

  mousedown: MOUSE_EVENT,
  mousemove: MOUSE_EVENT,
  mouseup: MOUSE_EVENT
}
// 获取元素距离文档顶部的距离
export function getRect(el) {
  //  如果是svg
  if (el instanceof window.SVGElement) {
    var rect = el.getBoundingClientRect()
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    }
  } else {
    return {
      top: el.offsetTop,
      left: el.offsetLeft,
      width: el.offsetWidth,
      height: el.offsetHeight
    }
  }
}

export function preventDefaultException(el, exceptions) {
  for (let i in exceptions) {
    if (exceptions[i].test(el[i])) {
      return true
    }
  }
  return false
}
// 触发一个自定义的事件
export function tap(e, eventName) {
  let ev = document.createEvent('Event')
  ev.initEvent(eventName, true, true)
  ev.pageX = e.pageX
  ev.pageY = e.pageY
  e.target.dispatchEvent(ev)
}
// 派发click事件，同时给ev加入_constructed属性
export function click(e) {
  var target = e.target

  if (!(/(SELECT|INPUT|TEXTAREA)/i).test(target.tagName)) {
    let ev = document.createEvent(window.MouseEvent ? 'MouseEvents' : 'Event')
    // cancelable 设置为 false 是为了解决和 fastclick 冲突问题
    ev.initEvent('click', true, false)
    ev._constructed = true
    target.dispatchEvent(ev)
  }
}
// 将el 插入到target的第一个子节点当中
export function prepend(el, target) {
  if (target.firstChild) {
    before(el, target.firstChild)
  } else {
    target.appendChild(el)
  }
}

export function before(el, target) {
  target.parentNode.insertBefore(el, target)
}

export function removeChild(el, child) {
  el.removeChild(child)
}