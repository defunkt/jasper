Jasper.REPL = {
  eval: function() {
    var obuffer = '', textarea = document.getElementById('jasper-out')

    Jasper.scope.puts = function(string) {
      obuffer += string
      obuffer += "\n"
    }

    var out = Jasper(document.getElementById('jasper-in').value)
    textarea.value = (textarea.value ? textarea.value + "\n" : '') + obuffer + '=> ' + out
    textarea.scrollTop = textarea.scrollHeight
  },

  init: function() {
    Jasper.load('/defunkt/jasper/raw/master/core.jr')
  }
}