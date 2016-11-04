const https = require('https')
const qs = require('querystring')

module.exports = class FB {
  constructor (id) { this.id = id }

  init (client_secret) {
    const client_id = this.id
    return new Promise((resolve, reject) => {
      const path = `/oauth/access_token?${qs.stringify({
        client_id, client_secret, 'grant_type': 'client_credentials'})}`
      this.api({ path })
        .then((token) => {
          this.token = token.split('access_token=')[1]
          resolve()
        })
    })
  }
  query (token, period) {
    if (!period) { console.error('no period') }
    return new Promise((resolve, reject) => {
      const access_token = this.token
      this.api(
        { path: `/v2.8/${this.id}/analytics_app_events_exports`, method: 'POST' },
        { access_token, 'start_ts': `${period.start}`, 'end_ts': `${period.end}` })
        .then((id) => this.poll(JSON.parse(id).id))
        .then((file) => resolve(file))
    })
  }
  api (opts, payload) {
    return new Promise((resolve, reject) => {
      opts.host || (opts.host = 'graph.facebook.com')
      opts.headers || (opts.headers = {})
      const req = https.request(opts, res => {
        var data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          if (data !== Error) {
            if (data && typeof data.status === 'number' && data.status < 600) {
              res.statusCode = data.status
            } else if (res.statusCode < 300) {
              resolve(data)
            } else { console.error(data, opts) }
          }
        })
      }).on('error', (err) => errorResponse(err, 'id', 'access_token', reject))
      payload && req.write(qs.stringify(payload))
      req.end()
    })
  }
  poll (id) {
    return new Promise((resolve, reject) => {
      let cnt = 0
      const access_token = this.token
      const api = this.api
      const tries = 60
      const interval = 120e3
      ;(function p () {
        api({ path: `/v2.8/${id}?access_token=${access_token}` })
          .then((result) => {
            result = JSON.parse(result)
            console.log(`query is ${result.status} for ${cnt * 2} mins`)
            if (result.status !== 'SCHEDULED' && result.status !== 'RUNNING') {
              const parameters = qs.stringify({access_token, id, filename: 'output.gz'})
              https.get({
                host: 'lookaside.fbsbx.com',
                path: `/analytics/app_events_export/download?${parameters}`,
                headers: {'user-agent': 'fb-export-api/'}
              }, (res) => resolve(res))
                .on('error', (e) => errorResponse(e, parameters, false, reject))
            } else if (cnt < tries) {
              if (result.status === 'RUNNING') cnt = 0
              cnt++
              setTimeout(p, interval)
            } else { reject('timed out for :' + arguments) }
          })
          .catch((err) => errorResponse(err, id, access_token, reject))
      })()
    })
  }
}

const errorResponse = (error, payload, opts, reject) => {
  const err = new Error(`fb error response from (${opts.path}) saying ${error}`)
  err.error = JSON.parse(error)
  err.opts = opts
  err.payload = payload
  console.log(error)
  reject(err)
}
