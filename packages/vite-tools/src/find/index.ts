import path from "path";
import { getViteConfigFilePath } from "@dd-code/shared";
import {
  applyCopy,
  excuteCopy,
  removeDepFiles,
  findDepFiles,
  findDepFilesInstance,
} from "./server";

export const excuteDelete = async (options: { config: string }) => {
  let { config } = options;
  config = getViteConfigFilePath(config);
  removeDepFiles(config);
};

export const excuteFindDep = async (options: {
  fileName: string;
  config: string;
}) => {
  let { fileName, config } = options;
  config = getViteConfigFilePath(config);
  if (!fileName) {
    throw Error("请输入文件名称");
  }
  await findDepFiles({ fileName, config });
};

export const excuteCopyFiles = async (_targetPath: string) => {
  const targetPath = path.resolve(process.cwd(), _targetPath);
  if (!_targetPath) {
    throw Error("请输入文件名称");
  }
  await excuteCopy({ targetPath });
};

export const excuteCopyApply = async () => {
  return await applyCopy();
};

export const excuteGetFileDep = (ctx, { recursive }) => {
  function normalizeId(id) {
    // Remove query string (e.g., ?vue&type=script)
    if (!id) return id;
    const root = process.cwd();
    let base = id.split("?")[0];

    // Map uni-app virtual modules to real file paths when possible
    if (base.startsWith("uniPage://")) {
      const encoded = base.slice("uniPage://".length);
      try {
        const decoded = Buffer.from(encoded, "base64").toString("utf8");
        base = path.isAbsolute(decoded) ? decoded : path.resolve(root, decoded);
      } catch (e) {
        // keep original if decode fails
      }
    } else if (base.startsWith("uniComponent://")) {
      const compPath = base.slice("uniComponent://".length);
      // base = path.isAbsolute(compPath) ? compPath : path.resolve(root, compPath);
      try {
        const decoded = Buffer.from(compPath, "base64").toString("utf8");
        base = path.isAbsolute(decoded) ? decoded : path.resolve(root, decoded);
      } catch (e) {
        // keep original if decode fails
      }
    }

    return base;
  }

  function findImportersInRollupContext(pluginCtx, targetsAbs) {
    const targetList = Array.isArray(targetsAbs)
      ? targetsAbs.filter(Boolean)
      : [targetsAbs].filter(Boolean);
    const resolvedTargets = targetList.map((t) => path.resolve(normalizeId(t)));
    const targetCandidates = new Set();
    const importers = new Set();

    // Collect target module IDs (with and without query variants)
    const ids = Array.from(pluginCtx.getModuleIds());
    for (const id of ids) {
      const normalized = normalizeId(id);
      const resolvedNorm = path.resolve(normalized);
      if (resolvedTargets.some((t) => t === resolvedNorm)) {
        targetCandidates.add(id);
      }
    }

    if (targetCandidates.size === 0) {
      return { importers: [], graph: new Map() };
    }

    // Build graph: id -> importedIds
    const graph = new Map();
    for (const id of Array.from(pluginCtx.getModuleIds())) {
      const info = pluginCtx.getModuleInfo(id);
      if (!info) continue;
      graph.set(id, (info.importedIds || []).map(normalizeId));
    }

    // Find direct importers (any target)
    const targetNorms = new Set(
      Array.from(targetCandidates).map((x) => normalizeId(x))
    );
    const graphEntries = () => Array.from(graph.entries());
    for (const [modId, importedIds] of graphEntries()) {
      for (const imp of importedIds) {
        const impNorm = normalizeId(imp);
        const impResolved = path.resolve(impNorm);
        if (
          targetNorms.has(impNorm) ||
          resolvedTargets.some((t) => t === impResolved)
        ) {
          importers.add(modId);
          break;
        }
      }
    }

    if (!recursive) {
      return { importers: Array.from(importers), graph };
    }

    // BFS to find transitive importers (upstream)
    const allImporters = new Set(importers);
    const queue = Array.from(importers);
    while (queue.length) {
      const current = queue.shift();
      for (const [modId, importedIds] of graphEntries()) {
        if (allImporters.has(modId)) continue;
        if (importedIds.includes(normalizeId(current))) {
          allImporters.add(modId);
          queue.push(modId);
        }
      }
    }

    return { importers: Array.from(allImporters), graph };
  }
  return (targetAbs) => {
    const { importers } = findImportersInRollupContext(ctx, targetAbs);
    return Array.from(new Set(importers.map((i) => normalizeId(i))));
  };
};
