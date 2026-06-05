# SearXNG 安装与配置指南

## 快速启动

### Windows 用户
1. 下载 SearXNG Docker 版本：
```bash
# 创建 SearXNG 目录
mkdir %USERPROFILE%\searxng
cd %USERPROFILE%\searxng

# 创建 docker-compose.yml
curl -o docker-compose.yml https://raw.githubusercontent.com/searxng/searxng-docker/master/docker-compose.yml

# 启动服务
docker-compose up -d
```

### macOS/Linux 用户
```bash
# 创建 SearXNG 目录
mkdir -p ~/searxng
cd ~/searxng

# 下载 docker-compose.yml
curl -o docker-compose.yml https://raw.githubusercontent.com/searxng/searxng-docker/master/docker-compose.yml

# 启动服务
docker-compose up -d
```

## 检查服务状态

启动后，打开浏览器访问：
- http://localhost:8080

如果看到 SearXNG 搜索界面，说明服务运行正常。

## 常见问题

### 1. Docker 未安装
访问 https://www.docker.com/products/docker-desktop 下载安装 Docker Desktop。

### 2. 端口冲突
如果 8080 端口被占用，修改 docker-compose.yml 中的端口映射：
```yaml
ports:
  - "8081:8080"  # 改为其他端口
```

然后在 AuraCommand 设置中将 SearXNG URL 改为 `http://localhost:8081`

### 3. 防火墙问题
确保防火墙允许 Docker 容器的网络访问。

## 验证连接

在 AuraCommand 中：
1. 打开设置面板
2. 点击 SearXNG URL 旁边的"测试连接"按钮
3. 如果显示绿色连接状态，说明配置成功

## 手动测试

可以使用 curl 测试 SearXNG API：
```bash
curl "http://localhost:8080/search?q=test&format=json"
```

如果返回 JSON 数据，说明 API 工作正常。