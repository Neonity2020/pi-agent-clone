#!/bin/bash

# ============================================================================
# 安全检查脚本 - 检查是否有敏感信息被提交到仓库
# ============================================================================

echo "🔍 开始安全检查..."
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查计数
errors=0
warnings=0

# 1. 检查 .env 文件是否被跟踪
echo "📋 检查 1: .env 文件是否被 git 跟踪"
if git ls-files | grep -q "^\.env$"; then
    echo -e "${RED}❌ 危险: .env 文件被 git 跟踪！${NC}"
    echo "   请立即执行: git rm --cached .env"
    errors=$((errors + 1))
else
    echo -e "${GREEN}✅ 通过: .env 文件未被跟踪${NC}"
fi
echo ""

# 2. 检查 .gitignore 是否包含 .env
echo "📋 检查 2: .gitignore 是否包含 .env"
if grep -q "^\.env$" .gitignore 2>/dev/null; then
    echo -e "${GREEN}✅ 通过: .gitignore 包含 .env${NC}"
else
    echo -e "${YELLOW}⚠️  警告: .gitignore 可能缺少 .env${NC}"
    warnings=$((warnings + 1))
fi
echo ""

# 3. 检查是否有 .env 文件存在
echo "📋 检查 3: .env 文件是否存在"
if [ -f ".env" ]; then
    echo -e "${GREEN}✅ .env 文件存在（本地配置）${NC}"
else
    echo -e "${YELLOW}⚠️  .env 文件不存在${NC}"
fi
echo ""

# 4. 检查历史记录中是否有敏感文件
echo "📋 检查 4: 历史记录中是否有 .env 文件"
if git log --all --full-history --source -- "**/.env" | grep -q "commit"; then
    echo -e "${RED}❌ 危险: 历史记录中存在 .env 文件！${NC}"
    echo "   请使用 BFG Repo-Cleaner 或 git-filter-repo 清除"
    errors=$((errors + 1))
else
    echo -e "${GREEN}✅ 通过: 历史记录中没有 .env 文件${NC}"
fi
echo ""

# 5. 检查代码中是否有硬编码的 API Key
echo "📋 检查 5: 代码中是否有硬编码的 API Key"
SENSITIVE_PATTERNS=(
    "sk-[a-zA-Z0-9]{32,}"
    "xai-[a-zA-Z0-9]{32,}"
    "claude-[a-zA-Z0-9]{32,}"
    "AIza[a-zA-Z0-9_-]{35}"
    "[a-zA-Z0-9]{32,}\.[a-zA-Z0-9_-]{4,}\.[a-zA-Z0-9_-]{4,}"
)

found_secrets=false
for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if git grep -E "$pattern" -- '*.ts' '*.js' '*.json' '*.md' 2>/dev/null | grep -v ".env.example" | grep -v "node_modules" | head -1; then
        found_secrets=true
        break
    fi
done

if [ "$found_secrets" = true ]; then
    echo -e "${RED}❌ 危险: 发现可能的 API Key！${NC}"
    errors=$((errors + 1))
else
    echo -e "${GREEN}✅ 通过: 未发现硬编码的 API Key${NC}"
fi
echo ""

# 6. 检查其他敏感文件
echo "📋 检查 6: 其他敏感文件是否被跟踪"
SENSITIVE_FILES=(
    ".env.local"
    ".env.production"
    ".env.development"
    ".env.test"
    "*.pem"
    "*.key"
    "secrets.yaml"
    "secrets.json"
)

for file in "${SENSITIVE_FILES[@]}"; do
    if git ls-files | grep -q "$file"; then
        echo -e "${RED}❌ 危险: 敏感文件 $file 被跟踪！${NC}"
        errors=$((errors + 1))
    fi
done

if [ $errors -eq 0 ] && [ $warnings -eq 0 ]; then
    echo -e "${GREEN}✅ 所有检查通过！${NC}"
fi
echo ""

# 总结
echo "=========================================="
echo "检查结果:"
echo -e "  错误: ${RED}$errors${NC}"
echo -e "  警告: ${YELLOW}$warnings${NC}"
echo "=========================================="
echo ""

if [ $errors -gt 0 ]; then
    echo -e "${RED}⚠️  发现安全问题，请立即修复！${NC}"
    exit 1
elif [ $warnings -gt 0 ]; then
    echo -e "${YELLOW}⚠️  发现一些警告，建议检查${NC}"
    exit 0
else
    echo -e "${GREEN}🎉 安全检查通过！${NC}"
    exit 0
fi
