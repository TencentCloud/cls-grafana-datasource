# 腾讯云日志服务Grafana插件 开发指南

## 本地开发

1. 环境准备
- [Docker](https://docs.docker.com/get-docker/)
- [Magefile](https://magefile.org/) >= 1.11
- [Go](https://golang.org/dl/) >=1.16
- [Node.js](https://nodejs.org/en/download/) >= 16

2. Fork 此项目后克隆到本地：
```bash
$ git clone https://github.com/${your-git-username}/cls-grafana-datasource.git
```

2. 安装依赖：
```bash
$ yarn
$ go mod vendor
$ go mod tidy
```

3. 启动前端开发环境：
```bash
$ npm run dev
```

4. 启动后端开发环境：
```bash
$ mage -v
```

5. 在命令行中运行：

```bash
$ npm run server
```
然后访问 (http://localhost:3001)。

6. 开发完成后通过 [Pull Request](https://github.com/TencentCloud/cls-grafana-datasource/pulls) 的方法提交代码请求合并。

## 提交代码规范

遵循 Converntional [提交信息规范](https://conventionalcommits.org/)。

提交格式如下：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

每次提交可以包含页眉(header)、正文(body)和页脚(footer)，每次提交必须包含页眉内容

每次提交的信息不超过100个字符

`type` 可为如下选择之一：

- build
- ci
- chore
- docs
- feat
- fix
- perf
- refactor
- revert
- style
- test
