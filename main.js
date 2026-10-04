// The only script on the page: Bengaluru's local time, updated each minute.
(function () {
  var el = document.getElementById('clock');
  if (!el) return;
  var fmt = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
  function tick() {
    el.textContent = fmt.format(new Date()).replace(/\s?([ap])m/i, function (_, p) { return ' ' + p.toLowerCase() + '.m.'; });
  }
  tick();
  setInterval(tick, 20000);
})();
