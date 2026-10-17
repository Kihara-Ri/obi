# ai-kit 项目配置（项目自己维护，升级不会覆盖）
SRC_DIRS="web/src"                       # 前端源码；server/ 是纯标准库后端，遵循 AGENTS.md 的后端规则
COMPONENT_DIRS="web/src/components"      # 需要头部注释（R11）的组件目录
LOG_TRIGGER_DIRS="web/src server"        # 这些目录有改动必须带 docs/log 日志（R7）
REGISTRY="web/src/components/REGISTRY.md"
MAX_LINES=200
LEGACY_FILE=".ai-kit/legacy.txt"         # 接入 ai-kit 之前就存在的、不满足新规则的文件，见 docs/DECISIONS.md D-001
PACKAGE_JSONS="web/package.json"
# 随产品发布的大文件（官方插件 ZIP、引擎 tarball）不受 R12 大文件/压缩包检查
HYGIENE_ALLOW="^plugins/album-engine/|^web/vendor/.*\.tgz$"
