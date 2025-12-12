import { getMfeJson } from "./config/config";
import { EPlaform } from "./config/enum";
import { createMpWeixinUniPlugin } from "./plugins/mp-weixin";

/**
 * 创建 Chagee Uni 插件
 * @description 根据配置文件和传入选项创建插件实例
 * @param {Object} options - 插件配置选项
 * @returns {Object} 插件实例
 * @example
 * const plugin = createPlugin({
 *   env: 'production',
 *   customOption: 'value'
 * });
 */
export default (options?: Record<string, any>) => {
  // 获取微前端配置
  const mfeJson = getMfeJson();
  // 合并配置选项，传入的 options 会覆盖默认配置
  const opt = { ...mfeJson, ...options };
  return mfeJson.platform === EPlaform.MP_WEIXIN
    ? createMpWeixinUniPlugin(opt)
    : [];
};
