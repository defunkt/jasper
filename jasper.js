var Jasper = (function(global) {
  this.globalObject = global

  // entrance
  function jasper(input) {
    return jevalForms(this, parse(input))
  }
  jasper.debug = false

  // jasper eval
  function jeval(context, stream) {
    if (emptyp(stream)) return null

    if (stream.constructor == Array) {
      if (emptyp(car(stream))) return null

      if (car(stream).constructor == Array && emptyp(cdr(stream))) {
        return jeval(context, car(stream))
      } else {
        return apply(context, car(stream), cdr(stream))
      }
    } else {
      return valueOfToken(context, stream)
    }
  }

  // important!
  function jevalForms(context, forms) {
    var ret
    for (var key in forms) ret = jeval(context, forms[key])
    return ret
  }

  // evaluate a token
  function valueOfToken(context, token) {
    if (/^([\"0-9].*|true|false|null|undefined)$/.test(token)) {
      // numbers and strings eval to themselves
      return eval(token)
    } else if (/^\'/.test(token)) {
      // quote literal
      return token.slice(1, token.length)
    } else if (typeof token == 'function') {
      return token
    } else {
      // it's a symbol - look it up
      return symbolLookup(context, token)
    }
  }

  // call a function or macro
  function apply(context, name, rest) {
    var result, args = [], form

    form = symbolLookup(context, name)

    if (!form) throw "Form undefined: " + name

    if (form.special || form.macro) {
      args = rest
    } else {
      for (var key in rest) args.push(jeval(context, rest[key]))
    }

    debug('funcall: ' + name + '; args: ' + args.toString())
    result = form.apply(context, args)
    if (result) debug('funcall: ' + name + '; result: ' + result.toString())
    return form.macro ? jeval(context, result) : result
  }

  function symbolLookup(context, target) {
    while (context) {
      if (typeof context[target] != 'undefined') return context[target]
      context = context.parentContext
    }
    throw "Can't find " + target
  }

  // our two parsing methods
  function parse(input) {
    var token, tokens = tokenize(input), stack = []

    while (tokens.length > 0) {
      token = tokens.shift()

      if (token == '(') {
        stack.push(parse(tokens))
      } else if (token == ')') {
        return stack
      } else {
        stack.push(token)
      }
    }

    return stack
  }

  function tokenize(input) {
    if (input.constructor == Array) return input
    var match, token, regexp = /\s*(\(|\)|".+?"|[^\s()]+|$)/g, tokens = []

    while ((match = input.match(regexp)).length > 1) {
      input = input.replace(match[0], '')
      tokens.push( match[0].replace( /^\s+|\s+$/g, '' ) )
    }

    return tokens
  }

  // debug
  this['puts'] = function(string) {
    if (globalObject['console']) return console.log(string)
    if (globalObject['Ruby']) return Ruby.puts(string)
    if (globalObject['print']) return print(string)
  }

  this['debug'] = function(string) {
    if (jasper.debug) puts(string)
  }

  // everyone's favorites - list building blocks
  this['cons'] = function(a, b) {
    return append([a], b)
  }

  this['car'] = function(sexp) {
    return sexp[0]
  }

  this['cdr'] = function(sexp) {
    return sexp.slice(1, sexp.length)
  }

  // essentials
  this['if'] = function(sif, sthen, selse) {
    return jeval(this, sif) ? jeval(this, sthen) : jevalForms(this, [selse])
  }
  this['if'].special = true

  this['empty?'] = function(sexp) {
    return !sexp || sexp.length == 0
  }
  // alias
  var emptyp = this['empty?']

  this['list'] = function() {
    var i, arr = []
    for (i = 0; i < arguments.length; i++) arr.push(arguments[i])
    return arr
  }

  this['append'] = function() {
    var i, j, arr = []
    for (i = 0; i < arguments.length; i++)
      for (j = 0; j < arguments[i].length; j++)
        arr.push(arguments[i][j])
    return arr
  }

  this['progn'] = function() {
    var i, ret
    for (i = 0; i < arguments.length; i++) ret = jeval(this, arguments[i])
    return ret
  }

  // λ
  this['lambda'] = function(params, rest) {
    rest = Array.prototype.slice.call(arguments, 1, arguments.length)
    return function() {
      var i, context = {}
      context.parentContext = this

      if (params.length > 0) {
        // bind variables
        for (i = 0; i < params.length; i++) {
          if (params[i] == '&rest') {
            i++
            context[params[i]] = Array.prototype.slice.call(arguments, (i-1), arguments.length)
          } else {
            context[params[i]] = arguments[i]
          }
        }
      }

      return jevalForms(context, rest)
    }
  }
  this['lambda'].special = true

  // basic assignment
  this['='] = function(symbol, value) {
    this[symbol] = jeval(this, value)
  }
  this['='].special = true

  // basic comparison
  this['=='] = function(a, b) {
    return a == b
  }

  // can't write this in jasper, you can't apply eval
  this['js'] = function(string) {
    return eval(string)
  }

  // creation of macros
  this['defmacro'] = function(name, args, rest) {
    rest = Array.prototype.slice.call(arguments, 2, arguments.length)
    this[name] = lambda.call(this, args, rest)
    this[name].macro = true
    return null
  }
  this['defmacro'].special = true

  // math primitives
  this['+'] = function() {
    var i, sum = 0

    for (i = 0; i < arguments.length; i++)
      sum += arguments[i]

    return sum
  }

  this['-'] = function() {
    var i, diff = arguments[0]

    for (i = 1; i < arguments.length; i++)
      diff -= arguments[i]

    return diff
  }

  this['*'] = function() {
    var i, product = arguments[0]

    for (i = 1; i < arguments.length; i++)
      product *= arguments[i]

    return product
  }

  this['/'] = function() {
    var i, quotient = arguments[0]

    for (i = 1; i < arguments.length; i++)
      quotient /= arguments[i]

    return quotient
  }

  this['<']  = function(a, b) { return a < b }
  this['<='] = function(a, b) { return a <= b }
  this['>']  = function(a, b) { return a > b }
  this['>='] = function(a, b) { return a >= b }

  // loading files
  this['load'] = function(file) {
    if (!/\.jr$/.test(file))
      file = file + ".jr"

    if ('Ruby' in globalObject) {
      jasper( Ruby.File.read(file) )
    } else if ('XMLHttpRequest' in globalObject) {
      var xhr = new XMLHttpRequest
      xhr.open('GET', file, false)
      xhr.send(null)
      jasper( xhr.responseText )
    } else {
      throw "Can't load " + file
    }
  }

  // dirt simple api
  jasper.scope = this

  // Jasper(string)
  return jasper
})(this);

Jasper.init = function() {
  Jasper.scope.load('core.jr')
}
