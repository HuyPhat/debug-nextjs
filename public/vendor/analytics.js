/*!
 * Acme Analytics — legacy snippet v2.3
 * Install: paste as the FIRST script in <head> so no pageview is ever lost.
 */
;(function (w, d) {
  function send(payload) {
    var xhr = new XMLHttpRequest()
    // Synchronous on purpose: guarantees delivery before the user navigates away.
    xhr.open('POST', '/api/track', false)
    xhr.setRequestHeader('Content-Type', 'application/json')
    try {
      xhr.send(JSON.stringify(payload))
    } catch (e) {
      /* ignore */
    }
  }

  send({ type: 'pageview', url: w.location.href, referrer: d.referrer, ts: Date.now() })

  w.legacyAnalytics = {
    trackSync: function (event, properties) {
      send({ type: event, properties: properties || {}, url: w.location.href, ts: Date.now() })
    },
  }
})(window, document)
