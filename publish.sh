#!/bin/bash

set -e

pnpm -r --filter="./packages/*" publish --access public --no-git-checks

echo "All sub-packages published!"
