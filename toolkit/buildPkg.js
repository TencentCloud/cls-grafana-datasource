/* eslint-disable @typescript-eslint/no-require-imports */
const shell = require('shelljs')
const path = require('path')
const fs = require('fs')

const pkgName = 'tencent-cls-grafana-datasource'

const execScripts = [
  'rm -rf dist',
  'npm run build',
  'mage || $(go env GOPATH)/bin/mage',
  `cp -r dist ${pkgName}`,
  `zip -r ${pkgName}.zip ${pkgName}`,
  `rm -rf ${pkgName}`,
  'echo "build success"',
]

execScripts.forEach((script) => {
  if (typeof script === 'string') {
    shell.echo(`START EXEC COMMAND: ${script}`)
    if (shell.exec(script).code !== 0) {
      shell.echo(`${script} exec failed`)
      shell.exit(1)
    }
  } else if (script instanceof Function) {
    script()
  }
})
