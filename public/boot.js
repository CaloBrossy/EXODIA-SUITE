try {
  var t = localStorage.getItem('exodia.theme')
  var dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  if (dark) document.documentElement.classList.add('dark')
  if (localStorage.getItem('exodia.fx') === 'lite') document.documentElement.classList.add('fx-lite')
} catch (e) {}
