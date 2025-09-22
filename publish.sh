for dir in packages/*/; do (cd "$dir" && npm publish --access public); done

# pnpm -r publish --access public
