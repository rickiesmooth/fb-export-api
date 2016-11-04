const id = process.env.APP_ID
const secret = process.env.APP_SECRET
const date = ~~(Date.now() / 1000)
const FB = require('../lib')
const fs = require('fs')

const account = new FB(id)

account.init(secret)
  .then((token) => account.query(token, { end: date, start: date - 86400 }))
  .then((res) => {
    console.log('writing file!', res)
    var output = fs.createWriteStream('./output.gz')
    res.pipe(output)
  })
