#!/bin/bash

# 只发布子包，不发布根目录
for package in packages/*/; do
  if [ -f "$package/package.json" ]; then
    echo "Publishing $package..."
    cd "$package"
    npm publish --access public
    cd ../..
    echo "Finished publishing $package"
    echo "---"
  fi
done

echo "All sub-packages published!"

# 或者使用 pnpm 命令（推荐）：
# pnpm -r --filter="./packages/*" publish --access public --no-git-checks
