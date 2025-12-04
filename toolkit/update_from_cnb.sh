#!/bin/bash
# shellcheck disable=SC2181
# init variable
clsDsName="tencent-cls-grafana-datasource"
targetDir="/var/lib/grafana/plugins/"
if [ "$1" ]
then
  targetDir=$1
fi
echo "targetDir: ${targetDir}"

filename="${clsDsName}.zip"
tmpFileName="/tmp/${filename}"
clsRemotePkg="https://cnb.cool/tencent/cloud/cls/frontend/cls-grafana-datasource/-/releases/latest/download/${filename}"


# download file
echo $tmpFileName
echo $clsRemotePkg
rm -rf $tmpFileName "/tmp/${clsDsName}"
curl -LJ $clsRemotePkg -o "$tmpFileName"

if [ $? -ne 0 ]; then
  echo "download failed!"
  exit
fi

# unzip and copy
unzip -d /tmp "/tmp/${clsDsName}"
if [ $? -ne 0 ]; then
  echo "unzip failed!"
  exit
fi
cp -r "/tmp/${clsDsName}" "$targetDir"
if [ $? -ne 0 ]; then
  echo "copy failed!"
  exit
else
  echo "copy success"
fi

echo "update success"


