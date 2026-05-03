# 安全指南 - 防止 API Key 泄漏

## ⚠️ 重要提醒

**绝对不要将 `.env` 文件提交到 Git 仓库！** 这会导致 API Key 泄漏，造成严重的安全风险。

## 🔒 当前安全配置

### ✅ 已配置的保护措施

1. **`.gitignore` 配置**
   ```
   .env              # 忽略环境变量文件
   *.log             # 忽略日志文件
   ```

2. **Pre-commit Hook**
   - 自动检查敏感文件
   - 阻止提交包含敏感信息的文件
   - 检测可能的 API Key 模式

3. **安全检查脚本**
   - 脚本位置: `scripts/check-secrets.sh`
   - 运行命令: `bash scripts/check-secrets.sh`

4. **使用 `.env.example`**
   - 提供配置模板
   - 不包含真实 API Key
   - 可以安全提交到仓库

## 📝 正确的工作流程

### 1. 初始化项目

```bash
# 1. 复制 .env.example 为 .env
cp .env.example .env

# 2. 编辑 .env，填入真实的 API Key
# 使用你喜欢的编辑器
vim .env  # 或 code .env, nano .env 等

# 3. 确保 .env 在 .gitignore 中
cat .gitignore | grep "\.env"
# 应该看到: .env
```

### 2. 日常开发

```bash
# 正常提交代码
git add .
git commit -m "your commit message"
# pre-commit hook 会自动运行安全检查
git push
```

### 3. 提交前检查

```bash
# 1. 查看将要提交的文件
git status

# 2. 检查是否有 .env 文件
git ls-files | grep "\.env$"
# 应该没有输出

# 3. 运行安全检查脚本
bash scripts/check-secrets.sh

# 4. 如果一切正常，提交
git add .
git commit -m "safe commit"
git push
```

## 🚨 如果发现安全问题

### 场景 1: .env 被添加到暂存区

```bash
# 症状：git status 显示 .env
# 解决：

# 1. 从暂存区移除
git reset HEAD .env

# 2. 确认 .gitignore 包含 .env
echo ".env" >> .gitignore

# 3. 重新提交
git add .
git commit -m "fix: ensure .env is ignored"
```

### 场景 2: .env 已经被提交

```bash
# 症状：git log 显示 .env 在历史中
# 解决：

# 1. 立即从 git 中移除
git rm --cached .env

# 2. 提交删除
git commit -m "security: remove .env from tracking"

# 3. 推送
git push

# 4. 撤销历史记录中的 .env（重要！）
# 方法 A: 使用 BFG Repo-Cleaner
bfg --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force

# 方法 B: 使用 git-filter-repo
pip install git-filter-repo
git filter-repo --path .env --invert-paths
git push --force

# 注意：这会重写历史，需要通知所有团队成员重新 clone 仓库
```

### 场景 3: API Key 已泄露

```bash
# 1. 立即撤销所有泄露的 API Key
#    登录各个平台（OpenAI、Anthropic、Gemini 等）
#    删除或重新生成 API Key

# 2. 生成新的 API Key
#    并更新本地 .env 文件

# 3. 清理 Git 历史
#    参考场景 2 的步骤

# 4. 通知团队成员
#    告知他们需要重新生成和更新 API Key
```

## 🔍 安全检查

### 运行安全检查脚本

```bash
bash scripts/check-secrets.sh
```

该脚本会检查：
- ✅ .env 文件是否被 git 跟踪
- ✅ .gitignore 是否正确配置
- ✅ 历史记录中是否有敏感文件
- ✅ 代码中是否有硬编码的 API Key
- ✅ 其他敏感文件是否被跟踪

### 手动检查

```bash
# 检查当前被跟踪的文件
git ls-files | grep -i "\.env\|secret\|password\|key"

# 检查历史记录
git log --all --full-history -- "**/.env"

# 搜索可能的 API Key
git grep -E "sk-[a-zA-Z0-9]{32,}" -- '*.ts' '*.js' '*.json'

# 查看最近的提交
git log --oneline -10
```

## 📋 安全清单

在每次提交前，确认：

- [ ] `.env` 文件不在 `git status` 中
- [ ] `.env` 在 `.gitignore` 中
- [ ] 没有硬编码的 API Key 在代码中
- [ ] 运行了安全检查脚本（可选但推荐）
- [ ] 查看了将要提交的文件列表

## 🛡️ 最佳实践

### 1. 环境变量管理

```bash
# ✅ 好的做法
- 使用 .env.example 作为模板
- .env 包含真实的 API Key
- .env 在 .gitignore 中

# ❌ 不好的做法
- 硬编码 API Key 在代码中
- 提交 .env 到仓库
- 在公开的 issue 或评论中分享 API Key
```

### 2. 团队协作

```bash
# 1. 创建 .env.example
cp .env .env.example
# 编辑 .env.example，清空所有敏感值

# 2. 提交 .env.example
git add .env.example
git commit -m "chore: add .env.example template"
git push

# 3. 团队成员使用
git clone <repo>
cp .env.example .env
# 编辑 .env，填入自己的 API Key
```

### 3. CI/CD 环境

```bash
# 在 CI/CD 平台（GitHub Actions, GitLab CI 等）
# 使用平台提供的环境变量功能
# 不要在 .yml 或配置文件中硬编码 API Key

# GitHub Actions 示例
# Settings → Secrets and variables → Actions
# 添加 secret: OPENAI_API_KEY
```

## 📞 紧急联系

如果发现 API Key 泄漏：

1. **立即撤销** - 登录相应平台撤销 API Key
2. **生成新密钥** - 创建新的 API Key
3. **清理历史** - 从 Git 历史中移除敏感信息
4. **通知团队** - 告知所有相关人员
5. **审计访问** - 检查 API 使用日志，确认是否被滥用

## 🔗 相关资源

- [Git - git-ignore Documentation](https://git-scm.com/docs/gitignore)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [git-filter-repo](https://github.com/newren/git-filter-repo)
- [OWASP Secret Scanning](https://owasp.org/www-project-secrets-scanning/)

---

**记住：安全无小事，预防胜于治疗！** 🛡️
