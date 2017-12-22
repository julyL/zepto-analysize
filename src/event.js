//     Zepto.js
//     (c) 2010-2016 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

;(function($){
  var _zid = 1, undefined,
      slice = Array.prototype.slice,
      isFunction = $.isFunction,
      isString = function(obj){ return typeof obj == 'string' },
      handlers = {},
      specialEvents={},
      focusinSupported = 'onfocusin' in window,
      focus = { focus: 'focusin', blur: 'focusout' },
      hover = { mouseenter: 'mouseover', mouseleave: 'mouseout' }

  specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = 'MouseEvents'

  function zid(element) {
    return element._zid || (element._zid = _zid++)
  }
  function findHandlers(element, event, fn, selector) {
    event = parse(event)
    if (event.ns) var matcher = matcherFor(event.ns)
    return (handlers[zid(element)] || []).filter(function(handler) {
      return handler
        && (!event.e  || handler.e == event.e)
        && (!event.ns || matcher.test(handler.ns))
        && (!fn       || zid(handler.fn) === zid(fn))
        && (!selector || handler.sel == selector)
    })
  }
  function parse(event) {
    var parts = ('' + event).split('.')     // "click.namespace1.namespace2"
    return {e: parts[0], ns: parts.slice(1).sort().join(' ')}   
    /*
      {
        e: "click",  事件名
        ns: ["namespace1","namespace2"]  排序后的命名空间数组
      }
    */
  }
  function matcherFor(ns) {
    return new RegExp('(?:^| )' + ns.replace(' ', ' .* ?') + '(?: |$)')
  }

  function eventCapture(handler, captureSetting) {
    return handler.del &&                   // 事件委托
      (!focusinSupported && (handler.e in focus)) ||    // focus事件不支持冒泡, 需要返回true
      !!captureSetting
  }

  function realEvent(type) {    // 返回事件名
    // 对mouseenter、mouseleave和 blur、focus 特殊处理
    return hover[type] || (focusinSupported && focus[type]) || type
  }
  /*
   handlers = [
      1:  [handler1,handler2...],   // handers的key由element决定,同一个element所绑定的所有事件都会放在一个数组里面   
      2:  [handler...]
   ]
   handle={
     del: 委托的事件,
     e: 事件名,
     fn: 绑定的事件,
     i: 当前handle在element所有绑定的事件数组中的位置,
     ns: 命名空间,
     proxy: 实际用进行addEventListener绑定时handle,
     sel: 进行筛选的选择器
   }
  
  */
  function add(element, events, fn, data, selector, delegator, capture){
    var id = zid(element), set = (handlers[id] || (handlers[id] = []))   // 同一个element的所绑定的事件都会放在同一个数组
    events.split(/\s/).forEach(function(event){     // 支持"click keydown"同时绑定多个事件
      if (event == 'ready') return $(document).ready(fn)
      var handler   = parse(event)  // 解析出事件名和命名空间
      handler.fn    = fn            // 绑定的事件
      handler.sel   = selector      // 进行事件委托的对象
      // emulate mouseenter, mouseleave
      if (handler.e in hover) fn = function(e){   // 绑定mouseenter mouseleave事件时的处理
        var related = e.relatedTarget
        if (!related || (related !== this && !$.contains(this, related)))
          return handler.fn.apply(this, arguments)
      }
      handler.del   = delegator           // 事件委托触发的事件
      var callback  = delegator || fn
      handler.proxy = function(e){        // 对绑定事件的事件进行了代理
        e = compatible(e)                 // 对原生event对象进行了扩展,使其支持isDefaultPrevented等方法
        if (e.isImmediatePropagationStopped()) return  // 
        e.data = data
        var result = callback.apply(element, e._args == undefined ? [e] : [e].concat(e._args))
        if (result === false) e.preventDefault(), e.stopPropagation()
        return result
      }
      handler.i = set.length
      set.push(handler)
      if ("addEventListener" in element) 
        // zepto对addEventListener的3个参数都做了处理
        element.addEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture));  
    })
  }
  function remove(element, events, fn, selector, capture){
    var id = zid(element)
    ;(events || '').split(/\s/).forEach(function(event){
      findHandlers(element, event, fn, selector).forEach(function(handler){
        delete handlers[id][handler.i]
      if ('removeEventListener' in element)
        element.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
      })
    })
  }

  $.event = { add: add, remove: remove }

  $.proxy = function(fn, context) {
    var args = (2 in arguments) && slice.call(arguments, 2)
    if (isFunction(fn)) {
      var proxyFn = function(){ return fn.apply(context, args ? args.concat(slice.call(arguments)) : arguments) }
      proxyFn._zid = zid(fn)
      return proxyFn
    } else if (isString(context)) {
      if (args) {
        args.unshift(fn[context], fn)
        return $.proxy.apply(null, args)
      } else {
        return $.proxy(fn[context], fn)
      }
    } else {
      throw new TypeError("expected function")
    }
  }

  $.fn.bind = function(event, data, callback){
    return this.on(event, data, callback)
  }
  $.fn.unbind = function(event, callback){
    return this.off(event, callback)
  }
  $.fn.one = function(event, selector, data, callback){
    return this.on(event, selector, data, callback, 1)
  }

  var returnTrue = function(){return true},
      returnFalse = function(){return false},
      ignoreProperties = /^([A-Z]|returnValue$|layer[XY]$|webkitMovement[XY]$)/,
      eventMethods = {
        preventDefault: 'isDefaultPrevented',
        stopImmediatePropagation: 'isImmediatePropagationStopped',
        stopPropagation: 'isPropagationStopped'
      }
  
  
  function compatible(event, source) { 
    if (source || !event.isDefaultPrevented) {  // 没有阻止默认行为
      source || (source = event)

      // 扩展event对象,添加isDefaultPrevented、isImmediatePropagationStopped、isPropagationStopped 3个方法
      // 分别用于标志eventMethods的key值对应的方法是否执行过
      
      // 为了方便说明,以preventDefalut为例  即name="preventDefault" predicate="isDefaultPrevented"
      $.each(eventMethods, function(name, predicate) {
        var sourceMethod = source[name]     // 存储原生preventDefalut方法
        event[name] = function(){           // 重写了preventDefalut方法 (进行了代理)
          this[predicate] = returnTrue      // preventDefalut方法被调用之后, isDefaultPrevented被设置为true
          return sourceMethod && sourceMethod.apply(source, arguments)  // 调用原生preventDefalut方法
        }
        event[predicate] = returnFalse      // 设置prevent
      })

      try {
        event.timeStamp || (event.timeStamp = Date.now())    // 添加timeStamp属性表示 事件执行时的时间戳
      } catch (ignored) { }

      
      // 下面是一些兼容代码,用一些原生方法检测如果event.preventDefalut已经执行则设置isDefaultPrevented为true
      if (source.defaultPrevented !== undefined ? source.defaultPrevented :  // // event.defalutPrevented为event原生属性,表示event.preventDefalut是否执行过了 (IE>8)
          'returnValue' in source ? source.returnValue === false :     // returnValue默认为true, 为false说明event.preventDefalut已经执行 (不推荐使用)
          source.getPreventDefault && source.getPreventDefault())      // event.getPreventDefault()为true表示event.preventDefalut已经执行(不推荐使用)
        event.isDefaultPrevented = returnTrue
    }
    return event
  }

  function createProxy(event) {
    var key, proxy = { originalEvent: event }   // 在originalEvent属性中存储原生的event对象
    for (key in event)
      if (!ignoreProperties.test(key) && event[key] !== undefined) proxy[key] = event[key]

    return compatible(proxy, event)
  }

  $.fn.delegate = function(selector, event, callback){
    return this.on(event, selector, callback)
  }
  $.fn.undelegate = function(selector, event, callback){
    return this.off(event, selector, callback)
  }

  $.fn.live = function(event, callback){
    $(document.body).delegate(this.selector, event, callback)
    return this
  }
  $.fn.die = function(event, callback){
    $(document.body).undelegate(this.selector, event, callback)
    return this
  }

  $.fn.on = function(event, selector, data, callback, one){
    var autoRemove, delegator, $this = this
    if (event && !isString(event)) {
      $.each(event, function(type, fn){
        $this.on(type, selector, data, fn, one)
      })
      return $this
    }

    if (!isString(selector) && !isFunction(callback) && callback !== false)
      callback = data, data = selector, selector = undefined
    if (callback === undefined || data === false)
      callback = data, data = undefined

    if (callback === false) callback = returnFalse

    return $this.each(function(_, element){
      if (one) autoRemove = function(e){
        remove(element, e.type, callback)
        return callback.apply(this, arguments)
      }
      // 事件委托: 将子节点的事件委托给父节点处理。当父节点触发事件时,父节点会根据e.target找到事件相应的处理函数(触发相应的子节点绑定的事件)       
      if (selector) delegator = function(e){ 
        var evt, match = $(e.target).closest(selector, element).get(0)    // 从e.target向上查找selector元素(必须是当前element的子节点) 也就是进行事件委托的元素
        if (match && match !== element) {
          evt = $.extend(createProxy(e), {currentTarget: match, liveFired: element})     // 对event进行修改和扩展
          // 事件委托的事件实际是绑定在父级上的,currentTarget是指向element. 需要对currentTarget进行修正,使得看上去事件就像绑定在子节点上,这点很重要!!
          // liveFired:存储实际绑定事件的元素
          return (autoRemove || callback).apply(match, [evt].concat(slice.call(arguments, 1)))
        }
      }

      add(element, event, callback, data, selector, delegator || autoRemove)
    })
  }
  $.fn.off = function(event, selector, callback){
    var $this = this
    if (event && !isString(event)) {
      $.each(event, function(type, fn){
        $this.off(type, selector, fn)
      })
      return $this
    }

    if (!isString(selector) && !isFunction(callback) && callback !== false)
      callback = selector, selector = undefined

    if (callback === false) callback = returnFalse

    return $this.each(function(){
      remove(this, event, callback, selector)
    })
  }

  $.fn.trigger = function(event, args){
    event = (isString(event) || $.isPlainObject(event)) ? $.Event(event) : compatible(event)
    event._args = args
    return this.each(function(){
      // focus、blur 事件 直接通过 el.focus() el.blur()触发
      if (event.type in focus && typeof this[event.type] == "function") this[event.type]()  
      // items in the collection might not be DOM elements
      else if ('dispatchEvent' in this) this.dispatchEvent(event)   // createEvent => initEvent => dispatchEvent 触发addEventListener绑定的事件
      else $(this).triggerHandler(event, args)                // 根据event从当前元素的事件数组中筛选出相应的事件并执行 eg: $(".a").trigger("click.b") 从$('.a')所有绑定的事件(handle)中筛选出事件类型为'click',命名空间为'b'的事件并执行
    })
  }

  // triggers event handlers on current element just as if an event occurred,
  // doesn't trigger an actual event, doesn't bubble
  $.fn.triggerHandler = function(event, args){
    var e, result
    this.each(function(i, element){
      e = createProxy(isString(event) ? $.Event(event) : event)
      e._args = args
      e.target = element
      $.each(findHandlers(element, event.type || event), function(i, handler){
        result = handler.proxy(e)
        if (e.isImmediatePropagationStopped()) return false
      })
    })
    return result
  }

  // shortcut methods for `.bind(event, fn)` for each event type
  ;('focusin focusout focus blur load resize scroll unload click dblclick '+
  'mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave '+
  'change select keydown keypress keyup error').split(' ').forEach(function(event) {
    $.fn[event] = function(callback) {
      return (0 in arguments) ?
        this.bind(event, callback) :
        this.trigger(event)
    }
  })

  $.Event = function(type, props) {
    if (!isString(type)) props = type, type = props.type
    var event = document.createEvent(specialEvents[type] || 'Events'), bubbles = true
    if (props) for (var name in props) (name == 'bubbles') ? (bubbles = !!props[name]) : (event[name] = props[name])
    event.initEvent(type, bubbles, true)
    return compatible(event)
  }

})(Zepto)
